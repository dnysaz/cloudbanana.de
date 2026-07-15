"""
BananaBrowser - Playwright/Firefox browser engine.
Runs a headless Firefox instance controlled via WebSocket.
Renders pages as PNG screenshots streamed to the frontend.
"""
import asyncio
import base64
import json
import logging
from typing import Optional

from playwright.async_api import async_playwright, Browser, Page

logger = logging.getLogger("cloudbanana.browser")

class BrowserEngine:
    """Manages a single headless Firefox instance with screenshot streaming."""

    def __init__(self):
        self.playwright = None
        self.browser: Optional[Browser] = None
        self.page: Optional[Page] = None
        self.width = 1280
        self.height = 720

    async def start(self):
        """Launch Firefox browser."""
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.firefox.launch(
            headless=True,
            args=["--no-sandbox"],
        )
        self.page = await self.browser.new_page()
        await self.page.set_viewport_size({"width": self.width, "height": self.height})
        # Set a realistic User-Agent to avoid bot detection
        await self.page.set_extra_http_headers({
            "User-Agent": ("Mozilla/5.0 (X11; Linux x86_64; rv:128.0) "
                          "Gecko/20100101 Firefox/128.0"),
            "Accept-Language": "en-US,en;q=0.9",
        })
        logger.info("Browser engine started (Firefox)")

    async def navigate(self, url: str) -> dict:
        """Navigate to URL and return page info + screenshot."""
        try:
            resp = await self.page.goto(url, wait_until="domcontentloaded", timeout=30000)
            # Wait for network idle but don't fail if it takes too long
            try:
                await self.page.wait_for_load_state("networkidle", timeout=10000)
            except Exception:
                logger.debug("Wait for network idle timed out, continuing...")
            # Extra wait for JS rendering
            await asyncio.sleep(1)

            title = await self.page.title()
            current_url = self.page.url
            screenshot = await self._capture()

            return {
                "type": "navigated",
                "url": current_url,
                "title": title,
                "screenshot": screenshot,
                "status": resp.status if resp else 0,
            }
        except Exception as e:
            logger.error(f"Navigation error: {e}")
            screenshot = await self._capture()
            return {
                "type": "error",
                "url": url,
                "title": "Error",
                "screenshot": screenshot,
                "error": str(e),
            }

    async def click(self, x: int, y: int) -> dict:
        """Click at coordinates and return updated screenshot."""
        try:
            await self.page.mouse.click(x, y)
            await asyncio.sleep(0.5)
            try:
                await self.page.wait_for_load_state("networkidle", timeout=8000)
            except Exception:
                logger.debug("Wait for network idle timed out, continuing...")
            await asyncio.sleep(0.3)
        except Exception as e:
            logger.error(f"Click error: {e}")

        current_url = self.page.url
        title = await self.page.title()
        screenshot = await self._capture()
        return {
            "type": "updated",
            "url": current_url,
            "title": title,
            "screenshot": screenshot,
        }

    async def type_text(self, text: str) -> dict:
        """Type text at current focus and return updated screenshot."""
        try:
            await self.page.keyboard.type(text)
            await asyncio.sleep(0.3)
        except Exception as e:
            logger.error(f"Type error: {e}")

        screenshot = await self._capture()
        return {
            "type": "updated",
            "url": self.page.url,
            "title": await self.page.title(),
            "screenshot": screenshot,
        }

    async def key_press(self, key: str) -> dict:
        """Press a key (Enter, Escape, etc.) and return updated screenshot."""
        try:
            await self.page.keyboard.press(key)
            await asyncio.sleep(0.5)
            try:
                await self.page.wait_for_load_state("networkidle", timeout=8000)
            except Exception:
                logger.debug("Wait for network idle timed out, continuing...")
            await asyncio.sleep(0.3)
        except Exception as e:
            logger.error(f"Key press error: {e}")

        screenshot = await self._capture()
        return {
            "type": "updated",
            "url": self.page.url,
            "title": await self.page.title(),
            "screenshot": screenshot,
        }

    async def scroll(self, delta_x: int, delta_y: int) -> dict:
        """Scroll the page and return updated screenshot."""
        try:
            await self.page.mouse.wheel(delta_x, delta_y)
            await asyncio.sleep(0.3)
        except Exception as e:
            logger.error(f"Scroll error: {e}")

        screenshot = await self._capture()
        return {
            "type": "updated",
            "url": self.page.url,
            "title": await self.page.title(),
            "screenshot": screenshot,
        }

    async def resize(self, width: int, height: int) -> dict:
        """Resize viewport and return updated screenshot."""
        self.width = width
        self.height = height
        try:
            await self.page.set_viewport_size({"width": width, "height": height})
        except Exception as e:
            logger.error(f"Resize error: {e}")

        screenshot = await self._capture()
        return {
            "type": "updated",
            "url": self.page.url,
            "title": await self.page.title(),
            "screenshot": screenshot,
        }

    async def _capture(self) -> str:
        """Capture screenshot and return as base64 PNG."""
        try:
            png_bytes = await self.page.screenshot(type="png", full_page=False)
            return base64.b64encode(png_bytes).decode("utf-8")
        except Exception as e:
            logger.error(f"Screenshot error: {e}")
            return ""

    async def close(self):
        """Clean up browser resources."""
        try:
            if self.page:
                await self.page.close()
            if self.browser:
                await self.browser.close()
            if self.playwright:
                await self.playwright.stop()
        except Exception as e:
            logger.error(f"Close error: {e}")

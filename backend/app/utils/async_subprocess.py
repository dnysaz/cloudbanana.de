"""
Async subprocess helpers for CloudBanana DE.
Wraps synchronous subprocess.run() in asyncio.to_thread() so it never blocks the event loop.
All async endpoint handlers should use these instead of direct subprocess.run() calls.
"""
import asyncio
import subprocess
import shlex
import logging
import os
import tempfile
from typing import Any

logger = logging.getLogger("cloudbanana.async_subprocess")


async def run(
    cmd: list[str],
    input: bytes | str | None = None,
    capture_output: bool = True,
    text: bool = True,
    timeout: int = 30,
    cwd: str | None = None,
    **kwargs: Any,
) -> subprocess.CompletedProcess:
    """Run a subprocess asynchronously — never blocks the event loop.

    Wraps subprocess.run() in loop.run_in_executor() via asyncio.to_thread().
    All arguments are forwarded to subprocess.run().
    """
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        None,
        lambda: subprocess.run(
            cmd,
            input=input,
            capture_output=capture_output,
            text=text,
            timeout=timeout,
            cwd=cwd,
            **kwargs,
        ),
    )


async def sudo_exists(path: str, flag: str = "-e", timeout: int = 5) -> bool:
    """Async version of _sudo_exists — check if a path exists using sudo."""
    try:
        result = await run(
            ["sudo", "bash", "-c", f"test {flag} {shlex.quote(path)}"],
            timeout=timeout,
        )
        return result.returncode == 0
    except (subprocess.TimeoutExpired, subprocess.CalledProcessError, Exception) as e:
        logger.warning(f"sudo_exists check failed for {path}: {e}")
        return False


async def sudo_read(path: str, timeout: int = 15) -> str:
    """Async version of _sudo_read — read file content via sudo cat."""
    result = await run(
        ["sudo", "bash", "-c", f"cat {shlex.quote(path)}"],
        timeout=timeout,
    )
    if result.returncode != 0:
        raise FileNotFoundError(f"File not found or not readable: {path}")
    return result.stdout


async def sudo_write(path: str, content: str, timeout: int = 10) -> None:
    """Async version of _sudo_write — write file content via sudo."""
    import os as _os, tempfile
    # Use unique temp file to prevent collisions between concurrent writes
    fd, tmp = tempfile.mkstemp(prefix="cb_write_")
    _os.close(fd)
    try:
        with open(tmp, "w") as f:
            f.write(content)
        await run(
            ["sudo", "bash", "-c", f"cp {shlex.quote(tmp)} {shlex.quote(path)}"],
            timeout=timeout,
        )
    finally:
        try:
            _os.unlink(tmp)
        except Exception:
            pass


async def sudo_unlink(path: str, timeout: int = 10) -> None:
    """Async version of _sudo_unlink — remove file via sudo."""
    await run(
        ["sudo", "bash", "-c", f"rm -f {shlex.quote(path)}"],
        timeout=timeout,
    )


async def sudo_symlink(target: str, link: str, timeout: int = 10) -> None:
    """Async version of _sudo_symlink — create symlink via sudo."""
    await run(
        ["sudo", "bash", "-c", f"ln -sf {shlex.quote(target)} {shlex.quote(link)}"],
        timeout=timeout,
    )

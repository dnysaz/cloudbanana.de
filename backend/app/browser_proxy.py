"""
BananaBrowser - Web proxy for CloudBanana DE's built-in browser.
Rewrite HTML to proxy all URLs and inject minimal anti-frame-busting JS.

Key design goals:
- Avoid triggering Google reCAPTCHA by using minimal, subtle overrides
- Support complex sites like YouTube by handling <base> tag carefully
- Persist cookies across requests for login sessions
- Spoof real Chrome user-agent for maximum compatibility
"""
import re
import html
import httpx
import time
import ipaddress
import threading
from urllib.parse import urlparse, quote, urlunparse
from fastapi import HTTPException
from fastapi.responses import Response

PRIVATE_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),    # loopback
    ipaddress.ip_network("::1/128"),        # IPv6 loopback
    ipaddress.ip_network("0.0.0.0/8"),      # current network
    ipaddress.ip_network("10.0.0.0/8"),     # RFC 1918
    ipaddress.ip_network("172.16.0.0/12"),  # RFC 1918
    ipaddress.ip_network("192.168.0.0/16"), # RFC 1918
    ipaddress.ip_network("169.254.0.0/16"), # link-local
    ipaddress.ip_network("fe80::/10"),      # IPv6 link-local
    ipaddress.ip_network("fc00::/7"),       # IPv6 unique local
]
PROXY_BLOCKED_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "::1"}

def _is_private_host(host: str) -> bool:
    """Check if a hostname resolves to a private/internal IP."""
    if host in PROXY_BLOCKED_HOSTS:
        return True
    try:
        addr = ipaddress.ip_address(host)
        return any(addr in net for net in PRIVATE_NETWORKS)
    except ValueError:
        return False
# Internal loop prevention: auto-populated with own origin at startup
SELF_ORIGINS: set[str] = set()

BP = "/api/v1/proxy"

# Sites known to break with injected <base> tag (YouTube, etc.)
NO_BASE_TAG_DOMAINS: set[str] = {"youtube.com", "www.youtube.com", "m.youtube.com",
                                   "youtu.be", "accounts.youtube.com",
                                   "google.com", "www.google.com", "accounts.google.com",
                                   "mail.google.com", "drive.google.com"}

# Real Chrome user-agent for best compatibility
CHROME_UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
             "Chrome/125.0.0.0 Safari/537.36")

# Per-session cookie jars for persistence
_cookie_jars: dict[str, dict] = {}  # domain -> {client, last_used}
_cookie_jars_lock = threading.Lock()
_COOKIE_JAR_MAX_AGE = 3600  # 1 hour idle cleanup
_COOKIE_JAR_MAX_SIZE = 50   # max domains before cleanup


import logging
_logger = logging.getLogger("cloudbanana.proxy")

def _cleanup_cookie_jars():
    """Remove stale cookie jars to prevent memory leak."""
    now = time.time()
    with _cookie_jars_lock:
        stale = [d for d, info in list(_cookie_jars.items())
                 if now - info.get("last_used", 0) > _COOKIE_JAR_MAX_AGE]
        for d in stale:
            try:
                info = _cookie_jars.pop(d, None)
                if info and "client" in info:
                    import asyncio
                    try:
                        loop = asyncio.get_event_loop()
                        if loop.is_running():
                            loop.create_task(info["client"].aclose())
                    except RuntimeError:
                        _logger.warning(f"Event loop not available when closing client for {d}")
            except Exception:
                _logger.exception(f"Error closing client for {d}")
        if len(_cookie_jars) > _COOKIE_JAR_MAX_SIZE:
            sorted_domains = sorted(_cookie_jars.keys(),
                                    key=lambda d: _cookie_jars[d].get("last_used", 0))
            for d in sorted_domains[:len(_cookie_jars) - _COOKIE_JAR_MAX_SIZE]:
                try:
                    info = _cookie_jars.pop(d, None)
                    if info and "client" in info:
                        import asyncio
                        try:
                            loop = asyncio.get_event_loop()
                            if loop.is_running():
                                loop.create_task(info["client"].aclose())
                        except RuntimeError:
                            _logger.warning(f"Event loop not available when closing client for {d}")
                except Exception:
                    _logger.exception(f"Error closing client for {d}")


def _youtube_watch_to_embed(url: str) -> str:
    """Convert YouTube /watch?v=ID to /embed/ID for better iframe compatibility."""
    from urllib.parse import urlparse, parse_qs, urlunparse
    parsed = urlparse(url)
    host = parsed.hostname or ""
    # Only convert for YouTube domains
    is_yt = any(d in host for d in ["youtube.com", "youtu.be"])
    if not is_yt:
        return url
    # Regular watch URL: /watch?v=VIDEO_ID
    if parsed.path in ("/watch", "/watch/"):
        qs = parse_qs(parsed.query)
        v = qs.get("v", [None])[0]
        if v:
            # Preserve list and other params
            extra_params = {k: v[0] for k, v in qs.items() if k != "v"}
            if extra_params:
                return f"https://www.youtube.com/embed/{v}?{'&'.join(f'{k}={v}' for k, v in extra_params.items())}"
            return f"https://www.youtube.com/embed/{v}"
    # Short URL: youtu.be/VIDEO_ID
    if host == "youtu.be":
        video_id = parsed.path.strip("/")
        if video_id:
            return f"https://www.youtube.com/embed/{video_id}"
    return url


def _abs_url(url: str, base: str) -> str:
    if not url:
        return base
    if url.startswith("http://") or url.startswith("https://"):
        return url
    if url.startswith("//"):
        return "https:" + url
    if url.startswith("/"):
        parsed = urlparse(base)
        return f"{parsed.scheme}://{parsed.netloc}{url}"
    parsed = urlparse(base)
    path = parsed.path.rstrip("/")
    if "/" in path.lstrip("/"):
        path = path[:path.rfind("/")]
    return f"{parsed.scheme}://{parsed.netloc}{path}/{url}"


def _proxy_url(url: str, base: str) -> str:
    if not url or url.startswith("data:") or url.startswith("blob:") or url.startswith("javascript:") or url.startswith("#") or url.startswith(BP):
        return url
    abs_u = _abs_url(url, base)
    # Convert YouTube /watch?v= to /embed/ for better iframe compatibility
    abs_u = _youtube_watch_to_embed(abs_u)
    return f'{BP}/view/{quote(quote(abs_u, safe=""), safe="")}'


def _should_skip_base_tag(target_url: str) -> bool:
    """Check if we should skip injecting <base> tag for this URL."""
    parsed = urlparse(target_url)
    host = parsed.hostname or ""
    for domain in NO_BASE_TAG_DOMAINS:
        if host == domain or host.endswith("." + domain):
            return True
    return False


def rewrite_html(html: str, base_url: str, proxy_base: str | None = None) -> bytes:
    """
    Rewrite HTML: inject <base> tag (except for known-breaking sites),
    proxy all URLs, inject minimal anti-frame-busting JS.
    """
    import json as _json
    parsed = urlparse(base_url)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    pb = proxy_base or f'{BP}/view/{quote(base_url, safe="")}'

    # Strip XFO/CSP/Referrer meta tags (prevents frame-blocking & Referer stripping)
    # Using raw strings for regex patterns to avoid SyntaxWarning
    xfo_pattern = re.compile(r'<meta[^>]*http-equiv=["\']X-Frame-Options["\'][^>]*>', re.IGNORECASE)
    csp_pattern = re.compile(r'<meta[^>]*http-equiv=["\']Content-Security-Policy["\'][^>]*>', re.IGNORECASE)
    csp_report_pattern = re.compile(r'<meta[^>]*http-equiv=["\']Content-Security-Policy-Report-Only["\'][^>]*>', re.IGNORECASE)
    referrer_pattern = re.compile(r'<meta[^>]*name=["\']referrer["\'][^>]*>', re.IGNORECASE)

    html = xfo_pattern.sub('', html)
    html = csp_pattern.sub('', html)
    html = csp_report_pattern.sub('', html)
    html = referrer_pattern.sub('', html)

    # Rewrite src, href, action, data-src, poster, formaction
    def _rewrite_attr(m):
        attr = m.group(1)
        q = m.group(2)[0]
        val = m.group(3) or ""
        if not val or val.startswith("data:") or val.startswith("blob:") or val.startswith("javascript:") or val.startswith("#") or val.startswith(BP):
            return m.group(0)
        return f'{attr}={q}{_proxy_url(val, base_url)}{q}'

    html = re.sub(
        r'\b(src|href|action|data-src|poster|formaction)\s*=\s*("([^"]*)"|\'([^\']*)\')',
        _rewrite_attr, html, flags=re.IGNORECASE
    )

    # Rewrite srcset
    def _rewrite_srcset(m):
        attr = m.group(1)
        q = m.group(2)[0]
        val = m.group(3) or ""
        parts = []
        for piece in val.split(","):
            piece = piece.strip()
            if not piece:
                continue
            segs = piece.split()
            if segs:
                u = segs[0]
                if not u.startswith("data:") and not u.startswith(BP):
                    segs[0] = _proxy_url(u, base_url)
                piece = " ".join(segs)
            parts.append(piece)
        return f'{attr}={q}{" , ".join(parts)}{q}'

    html = re.sub(
        r'\b(srcset)\s*=\s*("([^"]*)"|\'([^\']*)\')',
        _rewrite_srcset, html, flags=re.IGNORECASE
    )

    # Inject/replace <base> tag so ALL relative URLs resolve through the proxy.
    # First, REMOVE any existing <base> tag (only the first <base> is used per HTML spec).
    # Without this, if the page already has a <base> tag, our injected one would be ignored.
    skip_base = _should_skip_base_tag(base_url)
    if not skip_base:
        html = re.sub(r'<base[^>]*>', '', html, count=1, flags=re.IGNORECASE)
        base_tag = f'<base href="{pb}">'
        # Case-insensitive <head> insertion
        head_pos = html.lower().find("<head>")
        if head_pos != -1:
            html = html[:head_pos] + f"<head>{base_tag}" + html[head_pos + 6:]
        else:
            html = f"<head>{base_tag}</head>{html}"

    # Minimal anti-frame-busting + URL rewriting JS
    # IMPORTANT: Do NOT override window.top/parent/frameElement — this triggers reCAPTCHA.
    # Do NOT override Location.prototype.href setter — this also triggers detection.
    # Instead, we rely on <base> tag for most relative URL resolution and only intercept
    # what's absolutely necessary: window.open, fetch, XHR (for API calls), and link clicks.
    # NOTE: form.action and anchor.href resolve to absolute URLs due to <base> tag,
    # so we use includes() not startsWith() when checking for already-proxied URLs.
    js = f"""<script>
(function(){{
var baseUrl = {_json.dumps(base_url)};
var proxyPrefix = '{BP}/view/';

function isProxied(u){{
  return u && typeof u==='string' && (u.startsWith(proxyPrefix) || u.includes(proxyPrefix));
}}

function youtubeToEmbed(u){{
  // Convert YouTube /watch?v=ID to /embed/ID for better iframe playback
  try{{
    var p=new URL(u);
    if(p.hostname.includes('youtube.com')&&(p.pathname==='/watch'||p.pathname==='/watch/')){{
      var v=p.searchParams.get('v');
      if(v){{ return 'https://www.youtube.com/embed/'+v; }}
    }}
    if(p.hostname==='youtu.be'){{
      var id=p.pathname.replace(/^\\//,'').replace(/\\/$/,'');
      if(id){{ return 'https://www.youtube.com/embed/'+id; }}
    }}
  }}catch(e){{}}
  return u;
}}

function proxyUrl(u){{
  if(!u||typeof u!=='string')return u;
  if(u.startsWith('data:')||u.startsWith('blob:')||u.startsWith('javascript:')||u.startsWith('#')||isProxied(u))return u;
  try{{ u=new URL(u,baseUrl).href; }}catch(e){{ return u; }}
  u=youtubeToEmbed(u);
  return proxyPrefix+encodeURIComponent(encodeURIComponent(u));
}}

// Intercept window.location and location.href via Proxy on the Location object.
// Proxy catches location.href = '...', location.pathname = '...', location.assign(), etc.
// Using Proxy avoids modifying Location.prototype (which triggers reCAPTCHA detection).
try{{
  var _loc = window.location;
  var _locProxy = new Proxy(_loc, {{
    set: function(target, prop, value) {{
      if (typeof value === 'string') {{
        target[prop] = proxyUrl(value);
      }} else {{
        target[prop] = value;
      }}
      try{{ window.parent.postMessage({{type:'proxy_nav',url:target.href}},'*'); }}catch(ee){{}}
      return true;
    }}
  }});
  Object.defineProperty(window, 'location', {{
    get: function() {{ return _locProxy; }},
    set: function(v) {{ if (typeof v === 'string') _locProxy.href = v; }}
  }});
  // Also intercept location.assign / replace (safe — not detected by reCAPTCHA)
  window.location.assign = function(u) {{ _locProxy.href = u; }};
  window.location.replace = function(u) {{ _locProxy.href = u; }};
}}catch(e){{}}

// Intercept window.open
try{{
  var _open=window.open;
  window.open=function(u,n,f){{ return _open(proxyUrl(u),n,f); }};
}}catch(e){{}}

// Intercept fetch API calls
var of=window.fetch.bind(window);
window.fetch=function(u,o){{
  if(typeof u==='string'){{ u=proxyUrl(u); }}
  return of(u,o);
}};

// Intercept XMLHttpRequest
var OXHRP=XMLHttpRequest.prototype;
var oo=OXHRP.open;
OXHRP.open=function(m,u){{
  return oo.apply(this,[m,proxyUrl(u)].concat([].slice.call(arguments,2)));
}};

// Intercept <a> clicks for cross-origin navigation
document.addEventListener('click',function(e){{
  var t=e.target.closest('a');
  if(!t||!t.href||t.target==='_blank')return;
  if(isProxied(t.href)||t.href.startsWith('javascript:')||t.href.startsWith('#')||t.href.startsWith('data:'))return;
  var p=proxyUrl(t.href);
  if(p!==t.href){{
    e.preventDefault();
    window.location.href=p;
    try{{ window.parent.postMessage({{type:'proxy_nav',url:p}},'*'); }}catch(ee){{}}
  }}
}});

// Intercept form submissions
document.addEventListener('submit',function(e){{
  var form=e.target;
  if(!form||!form.action)return;
  if(isProxied(form.action))return;
  var p=proxyUrl(form.action);
  if(p!==form.action){{
    e.preventDefault();
    var fd=new FormData(form);
    var params=new URLSearchParams();
    for(var [k,v] of fd){{ params.append(k,v); }}
    var sep=p.includes('?')?'&':'?';
    window.location.href=p+sep+params.toString();
  }}
}});

// Intercept History API for SPA navigation
try{{
  var _push=history.pushState;
  history.pushState=function(s,u,t){{
    if(t){{ var p=proxyUrl(t); if(p!==t){{ _push.call(this,s,u,p); }} }}
    var r=_push.apply(this,arguments);
    try{{ window.parent.postMessage({{type:'proxy_nav',url:window.location.href}},'*'); }}catch(ee){{}}
    return r;
  }};
  var _rep=history.replaceState;
  history.replaceState=function(s,u,t){{
    if(t){{ var p=proxyUrl(t); if(p!==t){{ _rep.call(this,s,u,p); }} }}
    var r=_rep.apply(this,arguments);
    try{{ window.parent.postMessage({{type:'proxy_nav',url:window.location.href}},'*'); }}catch(ee){{}}
    return r;
  }};
}}catch(e){{}}

// Notify parent on new page load
try{{ window.parent.postMessage({{type:'proxy_nav',url:window.location.href}},'*'); }}catch(e){{}}
}})();
</script>"""

    idx = html.lower().find("</head>")
    if idx != -1:
        html = html[:idx] + js + html[idx:]
    else:
        html = js + html

    return html.encode("utf-8")


def _get_client(target_url: str) -> httpx.AsyncClient:
    """Get or create a cookie-preserving HTTP client for the target domain."""
    parsed = urlparse(target_url)
    domain = parsed.hostname or "unknown"

    with _cookie_jars_lock:
        if domain in _cookie_jars:
            _cookie_jars[domain]["last_used"] = time.time()
            return _cookie_jars[domain]["client"]

        # Run cleanup periodically (every 5th new domain, or if > 40 jars)
        if len(_cookie_jars) % 5 == 4 or len(_cookie_jars) >= 40:
            _cleanup_cookie_jars()

        _cookie_jars[domain] = {
            "client": httpx.AsyncClient(
                follow_redirects=True,
                timeout=30.0,
                cookies={},
                headers={
                    "User-Agent": CHROME_UA,
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9",
                    "Accept-Encoding": "gzip, deflate",
                    "Sec-Ch-Ua": '"Not/A)Brand";v="99", "Google Chrome";v="125", "Chromium";v="125"',
                    "Sec-Ch-Ua-Mobile": "?0",
                    "Sec-Ch-Ua-Platform": '"Linux"',
                    "Sec-Fetch-Dest": "document",
                    "Sec-Fetch-Mode": "navigate",
                    "Sec-Fetch-Site": "none",
                    "Sec-Fetch-User": "?1",
                    "Upgrade-Insecure-Requests": "1",
                    "DNT": "1",
                }
            ),
            "last_used": time.time(),
        }
    return _cookie_jars[domain]["client"]


async def _proxy_request(request, target_url: str):
    """Core proxy logic: fetch target URL, rewrite HTML, return Response."""
    from urllib.parse import urlparse, urlencode, parse_qs

    # Default to https if no scheme
    if not target_url.startswith(("http://", "https://")):
        target_url = "https://" + target_url

    # Convert YouTube /watch?v= to /embed/ before fetching
    # This way the proxy fetches the embed page (better iframe compatibility)
    target_url = _youtube_watch_to_embed(target_url)

    # Block internal/hostile hosts
    parsed = urlparse(target_url)
    host = parsed.hostname or ""
    if _is_private_host(host):
        raise HTTPException(status_code=403, detail="Access to this host is blocked")

    try:
        client = _get_client(target_url)
        method = request.method.lower()

        # Forward relevant headers but override with Chrome UA
        req_headers = {
            "User-Agent": CHROME_UA,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": request.headers.get("accept-language", "en-US,en;q=0.9"),
        }

        # Forward referer if available
        ref = request.headers.get("referer", "")
        if ref:
            req_headers["Referer"] = ref

        req_body = await request.body() if request.method in ("POST", "PUT", "PATCH") else None

        resp = await client.request(method, target_url, headers=req_headers, content=req_body)

        content = resp.content
        content_type = resp.headers.get("content-type", "").split(";")[0]

        # Rewrite HTML to proxy all URLs
        if content_type == "text/html":
            from urllib.parse import urlunparse
            clean_url = urlunparse(urlparse(target_url)._replace(query="", fragment=""))
            content = rewrite_html(
                content.decode("utf-8", errors="replace"),
                target_url,
                proxy_base=proxy_view_url(clean_url)
            )

        # Strip frame-blocking headers
        out_headers = {}
        for k, v in resp.headers.items():
            kl = k.lower()
            if kl in ("x-frame-options", "content-security-policy", "content-security-policy-report-only",
                      "strict-transport-security", "content-encoding", "transfer-encoding", "connection",
                      "content-length"):
                continue
            out_headers[k] = v

        resp_obj = Response(content=content, status_code=resp.status_code,
                            headers=out_headers, media_type=resp.headers.get("content-type"))

        # Set cookie so catch-all route can redirect back if navigation escapes proxy
        # This is a server-side safety net for SPA navigations that bypass our JS interceptors
        from urllib.parse import quote as _q
        resp_obj.set_cookie(
            key="cb_target",
            value=_q(target_url),
            httponly=False,
            samesite="strict",
            max_age=3600,  # 1 hour
            path="/",
        )

        return resp_obj

    except httpx.TimeoutException:
        return _error_html_page(504, "Request Timed Out", f"The proxy timed out while trying to reach {target_url}. The site may be slow or unreachable.", target_url)
    except httpx.ConnectError:
        return _error_html_page(502, "Connection Failed", f"Could not connect to {target_url}. The site may be down or the address is incorrect.", target_url)
    except Exception as e:
        return _error_html_page(502, "Proxy Error", str(e), target_url)


def _error_html_page(status_code: int, title: str, message: str, target_url: str = "") -> Response:
    """Return a styled HTML error page instead of JSON for proxy errors."""
    safe_title = html.escape(title)
    safe_msg = html.escape(message)
    error_html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Proxy Error - {safe_title}</title>
<style>
  body {{ font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#1a1a2e; color:#e0e0e0; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; }}
  .box {{ text-align:center; max-width:440px; padding:2rem; }}
  .code {{ font-size:3rem; font-weight:700; color:#4fc3f7; line-height:1; margin-bottom:0.5rem; }}
  h2 {{ font-size:1.1rem; font-weight:600; margin:0 0 0.5rem; }}
  p {{ font-size:0.85rem; color:#a0a8c0; line-height:1.5; margin:0 0 1.2rem; }}
  .btn {{ display:inline-block; padding:0.5rem 1.2rem; background:#0f3460; color:#4fc3f7; border:1px solid #4fc3f7; border-radius:6px; text-decoration:none; font-size:0.85rem; cursor:pointer; transition:all 0.15s; font-family:inherit; }}
  .btn:hover {{ background:#4fc3f7; color:#1a1a2e; }}
</style>
</head>
<body>
<div class="box">
  <div class="code">{status_code}</div>
  <h2>{safe_title}</h2>
  <p>{safe_msg}</p>
  <button class="btn" onclick="window.location.reload()">Retry</button>
</div>
</body>
</html>"""
    return Response(content=error_html.encode("utf-8"), status_code=status_code, media_type="text/html")


# These functions are imported by main.py
def proxy_view_url(target_url: str) -> str:
    """Convert a target URL to a proxy view path (with trailing / for <base> tag)."""
    from urllib.parse import quote, urlparse
    parsed = urlparse(target_url)
    if not parsed.query and not parsed.fragment and not target_url.endswith("/"):
        target_url += "/"
    return f"{BP}/view/{quote(quote(target_url, safe=''), safe='')}"


def extract_target_from_view(path: str) -> str | None:
    """Extract the target URL from a proxy view path."""
    from urllib.parse import unquote
    prefix = f"{BP}/view/"
    if path.startswith(prefix):
        return unquote(path[len(prefix):])
    return None

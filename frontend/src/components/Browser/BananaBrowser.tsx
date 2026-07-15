import { useState, useRef, useCallback, useEffect } from 'react';
import { Globe, ArrowLeft, ArrowRight, RotateCw, X, Search, ExternalLink, Home } from 'lucide-react';
import { useDesktopStore } from '../../store/desktopStore';

interface Props {
  winId?: string;
  winData?: Record<string, unknown>;
}

const PROXY_PREFIX = '/api/v1/proxy/view/';
const BRAVE_SEARCH = 'https://search.brave.com/search?q=';

function isSearchQuery(input: string): boolean {
  if (input.includes(' ')) return true;
  if (/^[\w-]+(\.[\w-]+)+/.test(input)) return false;
  if (/^https?:\/\//i.test(input)) return false;
  return true;
}

function toProxyUrl(target: string): string {
  if (!target.startsWith('http://') && !target.startsWith('https://')) {
    target = 'https://' + target;
  }
  // Double-encode to prevent browser from decoding ? and = into query string
  return PROXY_PREFIX + encodeURIComponent(encodeURIComponent(target));
}

function extractTarget(proxyUrl: string): string {
  const idx = proxyUrl.indexOf(PROXY_PREFIX);
  if (idx === -1) return proxyUrl;
  try {
    // Decode twice to handle double-encoded URLs
    let s = proxyUrl.slice(idx + PROXY_PREFIX.length);
    s = decodeURIComponent(s);
    s = decodeURIComponent(s);
    return s;
  } catch {
    return proxyUrl;
  }
}

export default function Browser({ winData, winId }: Props) {
  const { closeWindow } = useDesktopStore();
  const [url, setUrl] = useState((winData?.url as string) || 'https://search.brave.com');
  const [currentUrl, setCurrentUrl] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const navLockRef = useRef(false);
  const mountedRef = useRef(false);

  // Navigate to Brave Search on mount if no initial URL
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    if (!winData?.url) {
      navigate('https://search.brave.com');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for postMessage from proxy-injected JS inside iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type !== 'proxy_nav') return;
      const targetUrl = extractTarget(e.data.url);
      if (!targetUrl || targetUrl === currentUrl) return;

      setCurrentUrl(targetUrl);
      setUrl(targetUrl);
      setError('');
      setLoading(false);
      navLockRef.current = false;
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [currentUrl]);

  const navigate = useCallback((target: string) => {
    if (!target) return;
    if (isSearchQuery(target)) {
      target = BRAVE_SEARCH + encodeURIComponent(target);
    } else if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = 'https://' + target;
    }
    // Prevent infinite mirror: block loading same origin in iframe
    try {
      const targetOrigin = new URL(target).origin;
      if (targetOrigin === window.location.origin) {
        setError(`Cannot load "${target}" inside BananaBrowser — this is the CloudBanana DE itself. Loading it would cause infinite recursion.`);
        setLoading(false);
        return;
      }
    } catch {}
    setError('');
    setLoading(true);
    setUrl(target);
    setCurrentUrl(target);
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIdx + 1);
      if (newHistory[newHistory.length - 1] !== target) {
        newHistory.push(target);
        setHistoryIdx(newHistory.length - 1);
      }
      return newHistory;
    });
  }, [historyIdx]);

  const handleGo = () => {
    if (!url.trim()) return;
    navigate(url.trim());
  };

  const handleBack = () => {
    if (historyIdx > 0) {
      const idx = historyIdx - 1;
      setHistoryIdx(idx);
      const target = history[idx];
      setUrl(target);
      setCurrentUrl(target);
      setError('');
      setLoading(true);
      navLockRef.current = true;
    }
  };

  const handleForward = () => {
    if (historyIdx < history.length - 1) {
      const idx = historyIdx + 1;
      setHistoryIdx(idx);
      const target = history[idx];
      setUrl(target);
      setCurrentUrl(target);
      setError('');
      setLoading(true);
      navLockRef.current = true;
    }
  };

  const handleReload = () => {
    if (currentUrl) {
      setLoading(true);
      if (iframeRef.current) {
        iframeRef.current.src = toProxyUrl(currentUrl);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleGo();
  };

  const handleHome = useCallback(() => {
    navigate('https://search.brave.com');
  }, [navigate]);

  const openInNewTab = useCallback((targetUrl: string) => {
    if (!targetUrl) return;
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }
    window.open(targetUrl, '_blank');
  }, []);

  const iframeSrc = currentUrl ? toProxyUrl(currentUrl) : '';

  return (
    <div className="br">
      {showDisclaimer && (
        <div className="br-disclaimer-overlay">
          <div className="br-disclaimer-modal">
            <Globe size={36} />
            <h2>BananaBrowser — Early Development</h2>
            <p>This browser is still in early development.</p>
            <ul>
              <li>Heavy JavaScript sites may not work properly</li>
              <li>Login to Google or other accounts is not yet supported</li>
              <li>Some sites may not render correctly</li>
            </ul>
            <button className="br-disclaimer-btn" onClick={() => setShowDisclaimer(false)}>
              Agree &amp; Continue
            </button>
          </div>
        </div>
      )}
      <div className="br-toolbar">
        <button className="br-nav" onClick={handleHome} title="Home">
          <Home size={14} />
        </button>
        <button className="br-nav" onClick={handleBack} disabled={historyIdx <= 0} title="Back">
          <ArrowLeft size={14} />
        </button>
        <button className="br-nav" onClick={handleForward} disabled={historyIdx >= history.length - 1} title="Forward">
          <ArrowRight size={14} />
        </button>
        <button className="br-nav" onClick={handleReload} disabled={!currentUrl} title="Reload">
          <RotateCw size={14} className={loading ? 'br-spin' : ''} />
        </button>
        <div className="br-address">
          <Search size={13} />
          <input type="text" value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter URL or search..." />
          <button className="br-go" onClick={handleGo} title="Go">Go</button>
        </div>
        <button className="br-nav" onClick={() => openInNewTab(currentUrl || url)} title="Open in new tab">
          <ExternalLink size={13} />
        </button>
        <button className="br-close" onClick={() => { if (winId) closeWindow(winId); }} title="Close">
          <X size={14} />
        </button>
      </div>

      {/* Loading overlay — only on first load */}
      {loading && !currentUrl && (
        <div className="br-loading-overlay">
          <div className="br-loading-spinner" />
          <span>Loading...</span>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="br-error-overlay">
          <Globe size={48} />
          <span className="br-error-title">Page Error</span>
          <span className="br-error-desc">{error}</span>
          <button className="br-error-btn" onClick={handleReload}>
            <RotateCw size={14} /> Retry
          </button>
        </div>
      )}

      {/* iframe for proxy rendering */}
      <div className="br-canvas-wrap">
        {currentUrl ? (
          <iframe
            ref={iframeRef}
            key={currentUrl}
            src={iframeSrc}
            className="br-canvas"
            onLoad={() => { setLoading(false); setError(''); }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            title={currentUrl}
          />
        ) : (
          <div className="br-empty">
            <Globe size={52} />
            <span className="br-empty-title">BananaBrowser</span>
            <span className="br-empty-hint">Enter a URL or search query above</span>
          </div>
        )}
      </div>

      {/* Status bar */}
      {currentUrl && (
        <div className="br-statusbar">
          <span className="br-status-dot" />
          <span className="br-status-text">{currentUrl}</span>
        </div>
      )}
    </div>
  );
}

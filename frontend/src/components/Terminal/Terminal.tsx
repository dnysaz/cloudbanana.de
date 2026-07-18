import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from 'xterm';
import { getWsUrl } from '../../api';
import { Terminal as TermIcon, Plus, PanelRight, Sun, Moon, Type, X } from 'lucide-react';
import { useDesktopStore } from '../../store/desktopStore';

interface Tab {
  id: number;
  title: string;
}

const TERMINAL_FONTS = [
  "'Menlo','Monaco','DejaVu Sans Mono','Liberation Mono','Courier New',monospace",
  "'Fira Code','Cascadia Code','JetBrains Mono',monospace",
  "'Source Code Pro','Ubuntu Mono','IBM Plex Mono',monospace",
  "'monospace'",
];

const FONT_LABELS: Record<string, string> = {
  "'Menlo','Monaco','DejaVu Sans Mono','Liberation Mono','Courier New',monospace": 'Menlo',
  "'Fira Code','Cascadia Code','JetBrains Mono',monospace": 'Fira Code',
  "'Source Code Pro','Ubuntu Mono','IBM Plex Mono',monospace": 'Source Code Pro',
  "'monospace'": 'monospace',
};

let tabCounter = 1;

function createTerminalSession(
  container: HTMLDivElement,
  fontFamily: string,
  fontSize: number,
  theme: 'dark' | 'light',
  onConnected: () => void,
  onDisconnected: () => void,
): { term: XTerm; ws: WebSocket; cleanup: () => void } {
  const isDark = theme === 'dark';
  const bg = isDark ? '#0d0d0d' : '#f5f5f5';
  const fg = isDark ? '#e0e0e0' : '#1a1a1a';
  const cursor = isDark ? '#f59e0b' : '#2563eb';

  const term = new XTerm({
    cursorBlink: true,
    cursorStyle: 'block',
    fontSize,
    fontFamily,
    allowTransparency: false,
    cols: 80,
    rows: 24,
    theme: {
      background: bg,
      foreground: fg,
      cursor,
      selectionBackground: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
      black: isDark ? '#2e3436' : '#2e3436',
      red: isDark ? '#cc0000' : '#cc0000',
      green: isDark ? '#4e9a06' : '#4e9a06',
      yellow: isDark ? '#c4a000' : '#c4a000',
      blue: isDark ? '#3465a4' : '#3465a4',
      magenta: isDark ? '#75507b' : '#75507b',
      cyan: isDark ? '#06989a' : '#06989a',
      white: isDark ? '#d3d7cf' : '#d3d7cf',
      brightBlack: isDark ? '#555753' : '#555753',
      brightRed: isDark ? '#ef2929' : '#ef2929',
      brightGreen: isDark ? '#8ae234' : '#8ae234',
      brightYellow: isDark ? '#fce94f' : '#fce94f',
      brightBlue: isDark ? '#729fcf' : '#729fcf',
      brightMagenta: isDark ? '#ad7fa8' : '#ad7fa8',
      brightCyan: isDark ? '#34e2e2' : '#34e2e2',
      brightWhite: isDark ? '#eeeeee' : '#eeeeee',
    },
  });

  term.open(container);

  const ws = new WebSocket(getWsUrl());
  ws.binaryType = 'arraybuffer';

  ws.onopen = () => {
    onConnected();
    const cmd = useDesktopStore.getState().pendingTerminalCommand;
    if (cmd) {
      setTimeout(() => {
        term.write(cmd + '\r\n');
        ws.send(new TextEncoder().encode(cmd + '\n'));
        useDesktopStore.getState().setPendingTerminalCommand(null);
      }, 300);
    }
    term.focus();
  };

  ws.onmessage = (e) => {
    term.write(new Uint8Array(e.data));
  };

  // Mutable reference to current WebSocket (allows reconnect to swap it)
  let currentWs = ws;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 3;

  const tryReconnect = () => {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;
    reconnectAttempts++;
    const delay = Math.min(2000 * reconnectAttempts, 10000);
    term.write(`\r\n\x1b[33m[Reconnecting in ${Math.round(delay / 1000)}s...]\x1b[0m\r\n`);
    setTimeout(() => {
      if (currentWs.readyState === WebSocket.OPEN || currentWs.readyState === WebSocket.CONNECTING) return;
      const newWs = new WebSocket(getWsUrl());
      newWs.binaryType = 'arraybuffer';
      newWs.onopen = () => {
        reconnectAttempts = 0;
        onConnected();
        term.focus();
        term.write('\r\n\x1b[32m[Reconnected]\x1b[0m\r\n');
      };
      newWs.onmessage = (e) => term.write(new Uint8Array(e.data));
      newWs.onclose = () => {
        onDisconnected();
        term.write('\r\n\x1b[31m[Connection closed]\x1b[0m\r\n');
        tryReconnect();
      };
      newWs.onerror = () => onDisconnected();
      currentWs = newWs;  // Swap reference — onData will use the new WS
    }, delay);
  };

  currentWs.onclose = () => {
    onDisconnected();
    term.write('\r\n\x1b[31m[Connection closed]\x1b[0m\r\n');
    tryReconnect();
  };

  currentWs.onerror = () => {
    onDisconnected();
  };

  term.onData((data) => {
    if (currentWs.readyState === WebSocket.OPEN) {
      currentWs.send(new TextEncoder().encode(data));
    }
  });

  const cleanup = () => {
    currentWs.close();
    term.dispose();
  };

  return { term, ws: currentWs, cleanup };
}

export default function Terminal(_props: { winId?: string }) {
  const { openWindow } = useDesktopStore();
  const [tabs, setTabs] = useState<Tab[]>([{ id: tabCounter, title: 'bash' }]);
  const [activeTab, setActiveTab] = useState(tabCounter);
  const [connected, setConnected] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return document.documentElement.classList.contains('theme-dark') ? 'dark' : 'light';
  });
  const [fontFamily, setFontFamily] = useState(() => {
    return localStorage.getItem('cb-term-font') || TERMINAL_FONTS[0];
  });
  const [fontSize] = useState(13);

  const sessionsRef = useRef<Map<number, { term: XTerm; ws: WebSocket; cleanup: () => void }>>(new Map());
  const containersRef = useRef<Map<number, HTMLDivElement>>(new Map());

  const initSession = useCallback((tabId: number) => {
    const container = containersRef.current.get(tabId);
    if (!container || sessionsRef.current.has(tabId)) return;

    const session = createTerminalSession(
      container,
      fontFamily,
      fontSize,
      theme,
      () => setConnected(true),
      () => setConnected(false),
    );
    sessionsRef.current.set(tabId, session);

    const ro = new ResizeObserver(() => {
      resizeTerm(tabId);
    });
    ro.observe(container);
    (session as any)._ro = ro;
  }, [fontFamily, fontSize, theme]);

  const resizeTerm = (tabId: number) => {
    const container = containersRef.current.get(tabId);
    const session = sessionsRef.current.get(tabId);
    if (!container || !session) return;
    const charWid = 8.5;
    const charHei = 18;
    const cols = Math.max(40, Math.floor(container.clientWidth / charWid));
    const rows = Math.max(8, Math.floor(container.clientHeight / charHei));
    session.term.resize(cols, rows);
    if (session.ws.readyState === WebSocket.OPEN) {
      session.ws.send(new TextEncoder().encode(`\x1b[8;${rows};${cols}t`));
    }
  };

  const addTab = useCallback(() => {
    tabCounter++;
    const newTab: Tab = { id: tabCounter, title: `bash ${tabCounter}` };
    setTabs((prev) => [...prev, newTab]);
    setActiveTab(tabCounter);

    setTimeout(() => {
      initSession(tabCounter);
    }, 50);
  }, [initSession]);

  const closeTab = useCallback((tabId: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const session = sessionsRef.current.get(tabId);
    if (session) {
      session.cleanup();
      const ro = (session as any)._ro;
      if (ro) ro.disconnect();
      sessionsRef.current.delete(tabId);
    }
    containersRef.current.delete(tabId);

    setTabs((prev) => {
      const updated = prev.filter((t) => t.id !== tabId);
      if (updated.length === 0) {
        const id = tabCounter + 1;
        tabCounter++;
        const newTab: Tab = { id, title: 'bash' };
        setTimeout(() => initSession(id), 50);
        return [newTab];
      }
      if (activeTab === tabId) {
        const idx = prev.findIndex((t) => t.id === tabId);
        const next = updated[Math.min(idx, updated.length - 1)];
        setTimeout(() => setActiveTab(next.id), 0);
      }
      return updated;
    });
  }, [activeTab, initSession]);

  useEffect(() => {
    initSession(activeTab);
  }, [activeTab, initSession]);

  useEffect(() => {
    return () => {
      sessionsRef.current.forEach((s) => {
        s.cleanup();
        const ro = (s as any)._ro;
        if (ro) ro.disconnect();
      });
      sessionsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const themeListener = () => {
      const isDark = document.documentElement.classList.contains('theme-dark');
      setTheme(isDark ? 'dark' : 'light');
    };
    document.addEventListener('theme-change', themeListener);
    return () => document.removeEventListener('theme-change', themeListener);
  }, []);

  const changeFont = (font: string) => {
    setFontFamily(font);
    localStorage.setItem('cb-term-font', font);
    sessionsRef.current.forEach((s) => {
      s.term.options.fontFamily = font;
    });
  };

  const toggleTermTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    sessionsRef.current.forEach((s) => {
      const isDark = newTheme === 'dark';
      s.term.options.theme = {
        background: isDark ? '#0d0d0d' : '#f5f5f5',
        foreground: isDark ? '#e0e0e0' : '#1a1a1a',
        cursor: isDark ? '#f59e0b' : '#2563eb',
        selectionBackground: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
      };
    });
  };

  const openNewWindow = () => {
    openWindow('terminal-' + Date.now(), 'Terminal');
  };

  return (
    <div className="term-container" style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: theme === 'dark' ? '#0d0d0d' : '#fafafa',
      borderRadius: 'var(--radius-lg)', overflow: 'hidden',
    }}>
      {/* Toolbar */}
      <div className="term-toolbar" style={{
        display: 'flex', alignItems: 'center',
        padding: '0.25rem 0.4rem', gap: '0.25rem',
        background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
        borderBottom: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
        minHeight: '32px', userSelect: 'none',
      }}>
        <div className="term-tabs" style={{
          display: 'flex', alignItems: 'center', gap: '2px', flex: 1, overflow: 'hidden',
        }}>
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <div
                key={tab.id}
                className={`term-tab${isActive ? ' active' : ''}`}
                onClick={() => {
                  setActiveTab(tab.id);
                  setTimeout(() => initSession(tab.id), 50);
                }}
                onMouseDown={(e) => e.button === 1 && closeTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.25rem',
                  padding: '0.2rem 0.5rem', cursor: 'pointer',
                  fontSize: '0.68rem', fontWeight: isActive ? 600 : 400,
                  borderRadius: '6px',
                  background: isActive
                    ? (theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')
                    : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                  transition: 'all 0.15s',
                  border: '1px solid transparent',
                  borderColor: isActive
                    ? (theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)')
                    : 'transparent',
                  whiteSpace: 'nowrap',
                  maxWidth: '120px',
                }}>
                <TermIcon size={10} style={{ flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{tab.title}</span>
                <button
                  className="term-tab-close"
                  onClick={(e) => closeTab(tab.id, e)}
                  title="Close tab"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '1px', margin: 0, lineHeight: 1,
                    color: 'var(--text-muted)', opacity: 0.5,
                    transition: 'opacity 0.15s',
                    display: 'flex', alignItems: 'center',
                    borderRadius: '3px',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '0.5'}
                >
                  <X size={9} />
                </button>
              </div>
            );
          })}
          <button
            className="term-tab-add"
            onClick={addTab}
            title="New tab"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '0.2rem 0.3rem',
              color: 'var(--text-muted)', opacity: 0.6,
              transition: 'all 0.15s', borderRadius: '4px',
              display: 'flex', alignItems: 'center',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.background = 'none'; }}
          >
            <Plus size={12} />
          </button>
        </div>

        <div className="term-toolbar-right" style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
          <button
            className="term-tb-btn"
            onClick={toggleTermTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '0.2rem 0.35rem', borderRadius: '4px',
              color: 'var(--text-muted)', opacity: 0.7,
              transition: 'all 0.15s',
              display: 'flex', alignItems: 'center',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.background = 'none'; }}
          >
            {theme === 'dark' ? <Sun size={11} /> : <Moon size={11} />}
          </button>

          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.2rem',
            padding: '0.1rem 0.3rem',
            borderRadius: '4px',
            fontSize: '0.62rem',
            color: 'var(--text-muted)',
          }}>
            <Type size={9} style={{ opacity: 0.6 }} />
            <select
              value={fontFamily}
              onChange={(e) => changeFont(e.target.value)}
              title="Terminal font"
              style={{
                background: 'none', border: 'none',
                color: 'var(--text-secondary)', cursor: 'pointer',
                fontSize: '0.62rem', padding: '1px',
                outline: 'none',
                maxWidth: '70px',
              }}
            >
              {TERMINAL_FONTS.map((f) => (
                <option key={f} value={f}>{FONT_LABELS[f] || f}</option>
              ))}
            </select>
          </div>

          <button
            className="term-tb-btn"
            onClick={addTab}
            title="New tab"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '0.2rem 0.35rem', borderRadius: '4px',
              color: 'var(--text-muted)', opacity: 0.7,
              transition: 'all 0.15s',
              display: 'flex', alignItems: 'center',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.background = 'none'; }}
          >
            <Plus size={11} />
          </button>
          <button
            className="term-tb-btn"
            onClick={openNewWindow}
            title="New window"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '0.2rem 0.35rem', borderRadius: '4px',
              color: 'var(--text-muted)', opacity: 0.7,
              transition: 'all 0.15s',
              display: 'flex', alignItems: 'center',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.background = 'none'; }}
          >
            <PanelRight size={11} />
          </button>
        </div>
      </div>

      {/* Terminal body */}
      <div className="term-body" style={{
        flex: 1, position: 'relative', overflow: 'hidden',
      }}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            ref={(el) => {
              if (el) containersRef.current.set(tab.id, el);
              else containersRef.current.delete(tab.id);
            }}
            className={`term-xterm-wrap${tab.id === activeTab ? ' active' : ''}`}
            style={{
              position: 'absolute', inset: 0,
              display: tab.id === activeTab ? 'block' : 'none',
            }}
          />
        ))}
      </div>

      {/* Status bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.3rem',
        padding: '0.15rem 0.5rem',
        fontSize: '0.6rem',
        color: connected ? '#22c55e' : 'var(--text-muted)',
        background: theme === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
        borderTop: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
        userSelect: 'none',
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: connected ? '#22c55e' : 'var(--text-muted)',
          boxShadow: connected ? '0 0 4px rgba(34,197,94,0.5)' : 'none',
          transition: 'all 0.3s',
        }} />
        <span style={{ fontWeight: connected ? 600 : 400 }}>
          {connected ? 'Connected' : 'Disconnected'}
        </span>
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', opacity: 0.5 }}>
          {tabs.length} tab{tabs.length > 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}

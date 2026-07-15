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
    <div className="term-container">
      <div className="term-toolbar">
        <div className="term-tabs">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`term-tab${tab.id === activeTab ? ' active' : ''}`}
              onClick={() => {
                setActiveTab(tab.id);
                setTimeout(() => initSession(tab.id), 50);
              }}
              onMouseDown={(e) => e.button === 1 && closeTab(tab.id)}
            >
              <TermIcon size={11} />
              <span>{tab.title}</span>
              <button
                className="term-tab-close"
                onClick={(e) => closeTab(tab.id, e)}
                title="Close tab"
              >
                <X size={10} />
              </button>
            </div>
          ))}
          <button className="term-tab-add" onClick={addTab} title="New tab">
            <Plus size={13} />
          </button>
        </div>

        <div className="term-toolbar-right">
          <div className="term-toolbar-group">
            <button
              className="term-tb-btn"
              onClick={toggleTermTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
            </button>
          </div>

          <div className="term-toolbar-group term-font-selector">
            <Type size={11} />
            <select
              value={fontFamily}
              onChange={(e) => changeFont(e.target.value)}
              title="Terminal font"
            >
              {TERMINAL_FONTS.map((f) => (
                <option key={f} value={f}>{FONT_LABELS[f] || f}</option>
              ))}
            </select>
          </div>

          <div className="term-toolbar-group">
            <button className="term-tb-btn" onClick={addTab} title="New tab">
              <Plus size={13} />
            </button>
            <button className="term-tb-btn" onClick={openNewWindow} title="New window">
              <PanelRight size={13} />
            </button>
          </div>
        </div>
      </div>

      <div className="term-body">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            ref={(el) => {
              if (el) containersRef.current.set(tab.id, el);
              else containersRef.current.delete(tab.id);
            }}
            className={`term-xterm-wrap${tab.id === activeTab ? ' active' : ''}`}
          />
        ))}
      </div>

      <div className="term-status-bar">
        <span className={`term-status-dot ${connected ? 'connected' : ''}`} />
        <span>{connected ? 'Connected' : 'Disconnected'}</span>
      </div>
    </div>
  );
}

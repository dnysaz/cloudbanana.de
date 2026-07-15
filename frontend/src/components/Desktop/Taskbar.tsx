import { useEffect, useState, useRef, useCallback } from 'react';
import { useDesktopStore } from '../../store/desktopStore';
import { useAuthStore } from '../../store/authStore';
import type { WinState } from '../../types';
import {
  Terminal, Folder, Grid, Trash2, Monitor, Maximize2,
  Settings, FileText, GitBranch, Database, Globe, Download, Gamepad2, Film, Package, Container, Shield,
  Pin, X, Minus, Circle,
} from 'lucide-react';
import LaravelIcon from '../LaravelWizard/LaravelIcon';

interface TbCtxMenu {
  x: number;
  y: number;
  appId: string;
  title: string;
  isRunning: boolean;
  isPinned: boolean;
  winIds: string[];
}

const DOCK_APP_COLORS: Record<string, string> = {
  applications: 'linear-gradient(135deg, #8e8e93, #aeaeb2)',
  www: 'linear-gradient(135deg, #007aff, #5856d6)',
  taskmgr: 'linear-gradient(135deg, #007aff, #00b4d8)',
  terminal: 'linear-gradient(135deg, #1a1a2e, #2d2d44)',
  trash: 'linear-gradient(135deg, #8e8e93, #636366)',
  settings: 'linear-gradient(135deg, #8e8e93, #636366)',
  bnote: 'linear-gradient(135deg, #ff9500, #ffcc02)',
  gitcloner: 'linear-gradient(135deg, #ff6b35, #f7931e)',
  sqleditor: 'linear-gradient(135deg, #007aff, #5856d6)',
  bananabrowser: 'linear-gradient(135deg, #34aadc, #5ac8fa)',
  subdomain: 'linear-gradient(135deg, #00c7be, #30d158)',
  wget: 'linear-gradient(135deg, #34c759, #30d158)',
  bplayer: 'linear-gradient(135deg, #af52de, #bf5af2)',
  snake: 'linear-gradient(135deg, #30d158, #34c759)',
  pingpong: 'linear-gradient(135deg, #ff3b30, #ff453a)',
  dockermanager: 'linear-gradient(135deg, #0d7cff, #2496ed)',
  apps: 'linear-gradient(135deg, #af52de, #7c3aed)',
  appinstaller: 'linear-gradient(135deg, #5856d6, #7c3aed)',
  bweb: 'linear-gradient(135deg, #34aadc, #5ac8fa)',
  media: 'linear-gradient(135deg, #af52de, #bf5af2)',
  'nginx-editor': 'linear-gradient(135deg, #007aff, #00b4d8)',
  'php-editor': 'linear-gradient(135deg, #8892bf, #4f5b93)',
  'host-editor': 'linear-gradient(135deg, #f97316, #fb923c)',
  cron: 'linear-gradient(135deg, #22c55e, #4ade80)',
  ssl: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
  pm2: 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
  'db-editor': 'linear-gradient(135deg, #ef4444, #f87171)',
  'laravel-wizard': 'linear-gradient(135deg, #f59e0b, #f97316)',
  'laravel-management': 'linear-gradient(135deg, #f59e0b, #f97316)',
};

const APP_ICONS: Record<string, typeof Terminal> = {
  applications: Grid,
  www: Folder,
  taskmgr: Monitor,
  terminal: Terminal,
  trash: Trash2,
  settings: Settings,
  bnote: FileText,
  gitcloner: GitBranch,
  sqleditor: Database,
  bananabrowser: Globe,
  subdomain: Globe,
  wget: Download,
  bplayer: Film,
  media: Film,
  snake: Gamepad2,
  pingpong: Gamepad2,
  dockermanager: Container,
  apps: Package,
  appinstaller: Package,
  bweb: Globe,
  'nginx-editor': FileText,
  'php-editor': FileText,
  'host-editor': FileText,
  cron: FileText,
  ssl: Shield,
  pm2: Container,
  'db-editor': Database,
  'laravel-wizard': LaravelIcon,
  'laravel-management': LaravelIcon,
};

function getAppId(windowId: string): string {
  if (windowId === 'applications' || windowId === 'taskmgr' || windowId === 'settings' || windowId === 'widgets') return windowId;
  if (windowId.startsWith('fm-')) return 'www';
  if (windowId.startsWith('terminal-')) return 'terminal';
  if (windowId.startsWith('bnote-')) return 'bnote';
  if (windowId.startsWith('git-')) return 'gitcloner';
  if (windowId.startsWith('media-') || windowId.startsWith('bplayer-')) return 'bplayer';
  if (windowId.startsWith('web-')) return 'bweb';
  if (windowId.startsWith('snake-')) return 'snake';
  if (windowId.startsWith('pingpong-')) return 'pingpong';
  for (const key of Object.keys(APP_ICONS)) {
    if (windowId === key || windowId.startsWith(key + '-')) return key;
  }
  return windowId;
}

function getAppTitle(appId: string): string {
  const map: Record<string, string> = {
    applications: 'Applications',
    www: 'File Manager',
    taskmgr: 'Task Manager',
    terminal: 'Terminal',
    trash: 'Trash',
    settings: 'Settings',
    bnote: 'BNote',
    gitcloner: 'Git Clone',
    sqleditor: 'SQLite Editor',
    bananabrowser: 'Banana Browser',
    subdomain: 'Subdomain',
    wget: 'Download',
    bplayer: 'Media Player',
    snake: 'Snake',
    pingpong: 'Ping Pong',
    dockermanager: 'Docker',
    apps: 'Software Center',
    appinstaller: 'App Installer',
    bweb: 'WebView',
    media: 'Media',
    'nginx-editor': 'Nginx Editor',
    'php-editor': 'PHP Editor',
    'host-editor': 'Hosts Editor',
    cron: 'Cron Manager',
    ssl: 'SSL Certificates',
    pm2: 'PM2 Manager',
    'db-editor': 'Database Editor',
    'laravel-wizard': 'Laravel Installer',
    'laravel-management': 'Laravel Manager',
  };
  return map[appId] || appId;
}

function getIcon(appId: string): typeof Terminal {
  return APP_ICONS[appId] || Terminal;
}

function getColor(appId: string): string {
  return DOCK_APP_COLORS[appId] || 'linear-gradient(135deg, #636366, #8e8e93)';
}

export default function Taskbar() {
  const store = useDesktopStore();
  const { windows, focusWindow, closeWindow, openWindow, closeStartMenu, minimizeWindow } = store;
  const { tbPinned, tbPinnedOrder, isTbPinned, pinToTb, unpinFromTb, reorderTb } = store;
  const user = useAuthStore((s) => s.user);
  const trashDir = '/etc/cloudbanana/trash/' + (user?.username || 'root');

  const [clock, setClock] = useState('');
  const [date, setDate] = useState('');
  const [showCal, setShowCal] = useState(false);
  const [bigClock, setBigClock] = useState('');
  const [bigDate, setBigDate] = useState('');
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const calRef = useRef<HTMLDivElement>(null);
  const [ctxMenu, setCtxMenu] = useState<TbCtxMenu | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const [clockTz] = useState(() => localStorage.getItem('cb-timezone') || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [clockHour12] = useState(() => (localStorage.getItem('cb-clock-format') || '24h') === '12h');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: clockTz, hour12: clockHour12 }));
      setDate(now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', timeZone: clockTz }));
      setBigClock(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: clockTz, hour12: clockHour12 }));
      setBigDate(now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: clockTz }));
    };
    update();
    const ci = setInterval(update, 1000);
    return () => clearInterval(ci);
  }, [clockTz, clockHour12]);

  useEffect(() => {
    if (!showCal) return;
    const handleClick = (e: MouseEvent) => {
      const clockEl = document.getElementById('tb-clock');
      if (clockEl && clockEl.contains(e.target as Node)) return;
      if (calRef.current && !calRef.current.contains(e.target as Node)) setShowCal(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showCal]);

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [ctxMenu]);

  const today = new Date();
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const calRows: (number | null)[][] = [];
  let row: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) row.push(null);
  for (let d = 1; d <= daysInMonth; d++) { row.push(d); if (row.length === 7) { calRows.push(row); row = []; } }
  if (row.length > 0) { while (row.length < 7) row.push(null); calRows.push(row); }
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  // Build the display list
  const buildItems = useCallback(() => {
    const pinnedSet = new Set(tbPinned);
    const ordered = tbPinnedOrder.filter(id => pinnedSet.has(id));
    const pinnedWithoutOrder = tbPinned.filter(id => !tbPinnedOrder.includes(id));
    const pinnedList = [...ordered, ...pinnedWithoutOrder];

    const runningMap = new Map<string, { ids: string[]; wins: WinState[] }>();
    for (const [wid, w] of Object.entries(windows)) {
      if (wid === 'widgets') continue;
      const appId = getAppId(wid);
      if (!runningMap.has(appId)) runningMap.set(appId, { ids: [], wins: [] });
      runningMap.get(appId)!.ids.push(wid);
      runningMap.get(appId)!.wins.push(w);
    }

    const items: { appId: string; isPinned: boolean; winIds: string[]; wins: WinState[] }[] = [];

    for (const appId of pinnedList) {
      const run = runningMap.get(appId);
      items.push({
        appId,
        isPinned: true,
        winIds: run?.ids || [],
        wins: run?.wins || [],
      });
      if (run) runningMap.delete(appId);
    }

    for (const [appId, { ids, wins }] of runningMap) {
      items.push({ appId, isPinned: false, winIds: ids, wins });
    }

    return items;
  }, [tbPinned, tbPinnedOrder, windows]);

  const items = buildItems();

  const handleItemClick = (appId: string, isPinned: boolean, winIds: string[], wins: WinState[]) => {
    if (appId === 'trash') {
      const existing = Object.keys(windows).find(wid => wid.startsWith('fm-') && windows[wid].data?.trash);
      if (existing && !windows[existing].minimized) {
        closeWindow(existing);
      } else if (existing && windows[existing].minimized) {
        openWindow(existing, windows[existing].title, { path: trashDir, trash: true });
      } else {
        openWindow('fm-' + Date.now(), 'Trash', { path: trashDir, trash: true });
      }
      return;
    }

    if (winIds.length === 0) {
      // Not running — open it
      openApp(appId);
      return;
    }

    const hasMinimized = wins.some(w => w.minimized);
    if (hasMinimized) {
      const minimized = wins.find(w => w.minimized);
      if (minimized) openWindow(minimized.id, minimized.title);
    } else {
      const last = wins[wins.length - 1];
      if (winIds.length === 1) {
        minimizeWindow(last.id);
      } else {
        focusWindow(last.id);
      }
    }
  };

  const openApp = (appId: string) => {
    switch (appId) {
      case 'applications': openWindow('applications', 'Applications'); break;
      case 'www': {
        const home = user?.home || (user?.username === 'root' ? '/root' : '/home/' + (user?.username || ''));
        openWindow('fm-' + Date.now(), 'File Manager', { path: home });
        break;
      }
      case 'taskmgr': openWindow('taskmgr', 'System Monitor'); break;
      case 'terminal': openWindow('terminal-' + Date.now(), 'Terminal'); break;
      case 'settings': openWindow('settings', 'Settings'); break;
      case 'bnote': openWindow('bnote-' + Date.now(), 'BNote'); break;
      case 'gitcloner': openWindow('gitcloner', 'Git Clone'); break;
      case 'sqleditor': openWindow('sqleditor', 'SQLite Editor'); break;
      case 'bananabrowser': openWindow('bananabrowser', 'Banana Browser'); break;
      case 'subdomain': openWindow('subdomain', 'Subdomain'); break;
      case 'wget': openWindow('wget', 'Download'); break;
      case 'bplayer': openWindow('bplayer-' + Date.now(), 'Media Player'); break;
      case 'snake': openWindow('snake', 'Snake'); break;
      case 'pingpong': openWindow('pingpong', 'Ping Pong'); break;
      case 'dockermanager': openWindow('dockermanager', 'Docker'); break;
      case 'apps': openWindow('apps', 'Software Center'); break;
      case 'appinstaller': openWindow('appinstaller', 'App Installer'); break;
      case 'nginx-editor': openWindow('nginx-editor', 'Nginx Editor'); break;
      case 'php-editor': openWindow('php-editor', 'PHP Editor'); break;
      case 'host-editor': openWindow('host-editor', 'Hosts Editor'); break;
      case 'cron': openWindow('cron', 'Cron Manager'); break;
      case 'ssl': openWindow('ssl', 'SSL Certificates'); break;
      case 'pm2': openWindow('pm2', 'PM2 Manager'); break;
      case 'db-editor': openWindow('db-editor', 'Database Editor'); break;
      case 'laravel-wizard': openWindow('laravel-wizard', 'Laravel Installer'); break;
      case 'laravel-management': openWindow('laravel-management', 'Laravel Manager'); break;
      default: openWindow(appId + '-' + Date.now(), getAppTitle(appId)); break;
    }
  };

  const handleContext = (e: React.MouseEvent, appId: string, isPinned: boolean, winIds: string[]) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, appId, title: getAppTitle(appId), isRunning: winIds.length > 0, isPinned, winIds });
  };

  const ctxCloseAll = () => {
    if (!ctxMenu) return;
    for (const wid of ctxMenu.winIds) closeWindow(wid);
    setCtxMenu(null);
  };

  const ctxMinimize = () => {
    if (!ctxMenu) return;
    for (const wid of ctxMenu.winIds) {
      const w = windows[wid];
      if (w && !w.minimized) minimizeWindow(wid);
    }
    setCtxMenu(null);
  };

  const ctxOpen = () => {
    if (!ctxMenu) return;
    openApp(ctxMenu.appId);
    setCtxMenu(null);
  };

  // Drag and drop
  const handleDragStart = (appId: string) => setDragId(appId);
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = (targetAppId: string) => {
    if (!dragId || dragId === targetAppId) { setDragId(null); return; }
    const current = tbPinnedOrder.filter(id => tbPinned.includes(id));
    const srcIdx = current.indexOf(dragId);
    const tgtIdx = current.indexOf(targetAppId);
    if (srcIdx === -1 && tgtIdx === -1) { setDragId(null); return; }
    if (srcIdx === -1) {
      // drag item isn't pinned, can't reorder it
      setDragId(null);
      return;
    }
    const newOrder = [...current];
    newOrder.splice(srcIdx, 1);
    const insertAt = newOrder.indexOf(targetAppId);
    if (insertAt === -1) {
      newOrder.push(dragId);
    } else {
      newOrder.splice(insertAt, 0, dragId);
    }
    reorderTb(newOrder);
    setDragId(null);
  };

  return (
    <>
      <div id="taskbar" onClick={() => closeStartMenu()}>
        <div id="dock-left" />

        <div id="dock-center">
          <div id="dock-items">
            {items.map(({ appId, isPinned, winIds, wins }) => {
              const Icon = getIcon(appId);
              const color = getColor(appId);
              const isOpen = winIds.length > 0;
              const hasOpen = isOpen && wins.some(w => !w.minimized);
              const isDragging = dragId === appId;

              return (
                <button
                  key={appId}
                  draggable={isPinned}
                  className={`dock-item${hasOpen ? ' open' : ''}${isDragging ? ' dragging' : ''}`}
                  title={getAppTitle(appId)}
                  onClick={() => handleItemClick(appId, isPinned, winIds, wins)}
                  onContextMenu={(e) => handleContext(e, appId, isPinned, winIds)}
                  onDragStart={() => handleDragStart(appId)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(appId)}
                >
                  <div className="dock-icon-wrap" style={{ background: color }}>
                    <Icon size={20} />
                  </div>
                  {isOpen && <div className="dock-dot" />}
                </button>
              );
            })}
          </div>
        </div>

        <div id="dock-right">
          <button className="dock-icon-btn" title="Fullscreen"
            onClick={() => {
              if (document.fullscreenElement) {
                document.exitFullscreen();
                localStorage.setItem('cb-fullscreen', 'false');
              } else {
                document.documentElement.requestFullscreen();
                localStorage.setItem('cb-fullscreen', 'true');
              }
            }}>
            <Maximize2 size={14} />
          </button>
          <div id="tb-clock" onClick={() => setShowCal(!showCal)}>
            <span id="tb-time">{clock}</span>
            <span id="tb-date">{date}</span>
          </div>
        </div>

        {showCal && (
          <div id="tb-cal" ref={calRef}>
            <div id="tb-cal-time">{bigClock}</div>
            <div id="tb-cal-date">{bigDate}</div>
            <div id="tb-cal-divider" />
            <div id="tb-cal-month">
              <button className="tb-cal-nav" onClick={(e) => { e.stopPropagation(); if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); } else { setCalMonth(calMonth - 1); } }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <span id="tb-cal-month-label">{MONTHS[calMonth]} {calYear}</span>
              <button className="tb-cal-nav" onClick={(e) => { e.stopPropagation(); if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); } else { setCalMonth(calMonth + 1); } }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
            <div id="tb-cal-grid">
              {DAYS.map(d => <div key={d} className="tb-cal-weekday">{d}</div>)}
              {calRows.flat().map((d, i) => (
                <div key={i} className={`tb-cal-day${d === null ? ' muted' : ''}${d !== null && d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear() ? ' today' : ''}`}>
                  {d !== null ? d : ''}
                </div>
              ))}
            </div>
          </div>
        )}

        {ctxMenu && (
          <div className="ctx-menu tb-ctx-menu"
            style={{ left: ctxMenu.x, top: ctxMenu.y, position: 'fixed', zIndex: 1000 }}
            onClick={(e) => e.stopPropagation()}>
            <div className="ctx-item" style={{ fontWeight: 600, cursor: 'default', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {ctxMenu.title}
            </div>
            <div className="ctx-sep" />
            {!ctxMenu.isRunning && (
              <button className="ctx-item" onClick={(e) => { e.stopPropagation(); ctxOpen(); }}>
                <Circle size={14} /> Open
              </button>
            )}
            {ctxMenu.isRunning && ctxMenu.winIds.length === 1 && (
              <button className="ctx-item" onClick={(e) => { e.stopPropagation(); const w = windows[ctxMenu.winIds[0]]; if (w && !w.minimized) { minimizeWindow(ctxMenu.winIds[0]); } else { openWindow(ctxMenu.winIds[0], w?.title || ctxMenu.title); } setCtxMenu(null); }}>
                <Minus size={14} /> {windows[ctxMenu.winIds[0]]?.minimized ? 'Restore' : 'Minimize'}
              </button>
            )}
            {ctxMenu.isRunning && ctxMenu.winIds.length > 1 && (
              <button className="ctx-item" onClick={(e) => { e.stopPropagation(); ctxMinimize(); }}>
                <Minus size={14} /> Minimize All
              </button>
            )}
            {ctxMenu.isRunning && (
              <button className="ctx-item" onClick={(e) => { e.stopPropagation(); ctxCloseAll(); }}>
                <X size={14} /> Close {ctxMenu.winIds.length > 1 ? `All (${ctxMenu.winIds.length})` : ''}
              </button>
            )}
            <div className="ctx-sep" />
            {ctxMenu.isPinned ? (
              <button className="ctx-item" onClick={(e) => { e.stopPropagation(); unpinFromTb(ctxMenu.appId); setCtxMenu(null); }}>
                <Pin size={14} /> Unpin from Taskbar
              </button>
            ) : (
              <button className="ctx-item" onClick={(e) => { e.stopPropagation(); pinToTb(ctxMenu.appId); setCtxMenu(null); }}>
                <Pin size={14} /> Pin to Taskbar
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

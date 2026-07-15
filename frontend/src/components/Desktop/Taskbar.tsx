import { useEffect, useState, useRef } from 'react';
import { useDesktopStore } from '../../store/desktopStore';
import { useAuthStore } from '../../store/authStore';
import { Trash2, Monitor, Maximize2 } from 'lucide-react';
import type { WinState } from '../../types';
import {
  Terminal, Folder, Grid,
  Settings, FileText, GitBranch, Database, Globe, Download, Gamepad2, Film, Package, Container, Shield,
} from 'lucide-react';
import LaravelIcon from '../LaravelWizard/LaravelIcon';

interface DockApp {
  id: string;
  title: string;
  icon: typeof Terminal;
  action: () => void;
  color: string; // macOS-style gradient/color for icon background
}

// macOS-style app icon colors for the dock
const DOCK_APP_COLORS: Record<string, string> = {
  applications: 'linear-gradient(135deg, #8e8e93, #aeaeb2)',
  www: 'linear-gradient(135deg, #007aff, #5856d6)',
  taskmgr: 'linear-gradient(135deg, #007aff, #00b4d8)',
  terminal: 'linear-gradient(135deg, #1a1a2e, #2d2d44)',
  trash: 'linear-gradient(135deg, #8e8e93, #636366)',
};

// Same vibrant colors as Applications Launchpad
const RUNNING_APP_COLORS: Record<string, string> = {
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
  'cron': 'linear-gradient(135deg, #22c55e, #4ade80)',
  'ssl': 'linear-gradient(135deg, #3b82f6, #60a5fa)',
  'pm2': 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
  'db-editor': 'linear-gradient(135deg, #ef4444, #f87171)',
  'laravel-wizard': 'linear-gradient(135deg, #f59e0b, #f97316)',
  'laravel-management': 'linear-gradient(135deg, #f59e0b, #f97316)',
};

// Same icons as Applications Launchpad — matches APP_COLORS colors
const RUNNING_APP_ICONS: Record<string, typeof Terminal> = {
  settings: Settings,
  bnote: FileText,
  'bnote-': FileText,
  gitcloner: GitBranch,
  'git-': GitBranch,
  sqleditor: Database,
  bananabrowser: Globe,
  subdomain: Globe,
  wget: Download,
  bplayer: Film,
  'media-': Film,
  'bplayer-': Film,
  snake: Gamepad2,
  pingpong: Gamepad2,
  dockermanager: Container,
  apps: Package,
  appinstaller: Package,
  bweb: Globe,
  'web-': Globe,
  media: Film,
  'nginx-editor': FileText,
  'php-editor': FileText,
  'host-editor': FileText,
  'cron': FileText,
  'ssl': Shield,
  'pm2': Container,
  'db-editor': Database,
  'laravel-wizard': LaravelIcon,
  'laravel-management': LaravelIcon,
};

export default function Taskbar() {
  const { windows, focusWindow, closeWindow, openWindow, closeStartMenu } = useDesktopStore();
  const [clock, setClock] = useState('');
  const [date, setDate] = useState('');
  const [showCal, setShowCal] = useState(false);
  const [bigClock, setBigClock] = useState('');
  const [bigDate, setBigDate] = useState('');
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const calRef = useRef<HTMLDivElement>(null);

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
      if (calRef.current && !calRef.current.contains(e.target as Node)) {
        setShowCal(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showCal]);

  const today = new Date();
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  const calRows: (number | null)[][] = [];
  let row: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) {
    row.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    row.push(d);
    if (row.length === 7) {
      calRows.push(row);
      row = [];
    }
  }
  if (row.length > 0) {
    while (row.length < 7) row.push(null);
    calRows.push(row);
  }

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  const handleItemClick = (id: string, w: WinState) => {
    if (w.minimized) {
      openWindow(id, w.title);
    } else {
      focusWindow(id);
    }
  };

  const user = useAuthStore((s) => s.user);
  const homeDir = user?.home || (user?.username === 'root' ? '/root' : '/home/' + (user?.username || 'root')) || '/root';
  const trashDir = '/etc/cloudbanana/trash/' + (user?.username || 'root');

  // Helper: toggle dock app — click to open, click again to close
  const toggleDockApp = (id: string) => {
    if (id === 'applications') {
      if (windows['applications'] && !windows['applications'].minimized) {
        closeWindow('applications');
      } else {
        openWindow('applications', 'Applications');
      }
      return;
    }
    if (id === 'www') {
      const existing = Object.keys(windows).find(wid => wid === 'www' || wid.startsWith('fm-'));
      if (existing && !windows[existing].minimized) {
        Object.keys(windows).filter(wid => wid === 'www' || wid.startsWith('fm-')).forEach(wid => closeWindow(wid));
      } else if (existing && windows[existing].minimized) {
        openWindow(existing, windows[existing].title, { path: user?.home || '/home/' + (user?.username || '') });
      } else {
        const home = user?.home || (user?.username === 'root' ? '/root' : '/home/' + (user?.username || ''));
        openWindow('fm-' + Date.now(), 'File Manager', { path: home });
      }
      return;
    }
    if (id === 'taskmgr') {
      if (windows['taskmgr'] && !windows['taskmgr'].minimized) {
        closeWindow('taskmgr');
      } else {
        openWindow('taskmgr', 'System Monitor');
      }
      return;
    }
    if (id === 'terminal') {
      const existing = Object.keys(windows).find(wid => wid === 'terminal' || wid.startsWith('terminal-'));
      if (existing && !windows[existing].minimized) {
        Object.keys(windows).filter(wid => wid === 'terminal' || wid.startsWith('terminal-')).forEach(wid => closeWindow(wid));
      } else if (existing && windows[existing].minimized) {
        openWindow(existing, windows[existing].title);
      } else {
        openWindow('terminal-' + Date.now(), 'Terminal');
      }
      return;
    }
    if (id === 'trash') {
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
  };

  // macOS dock with colorful icons
  const dockApps: DockApp[] = [
    {
      id: 'applications',
      title: 'Applications',
      icon: Grid,
      color: DOCK_APP_COLORS['applications'],
      action: () => toggleDockApp('applications'),
    },
    {
      id: 'www',
      title: 'File Manager',
      icon: Folder,
      color: DOCK_APP_COLORS['www'],
      action: () => toggleDockApp('www'),
    },
    {
      id: 'taskmgr',
      title: 'Task Manager',
      icon: Monitor,
      color: DOCK_APP_COLORS['taskmgr'],
      action: () => toggleDockApp('taskmgr'),
    },
    {
      id: 'terminal',
      title: 'Terminal',
      icon: Terminal,
      color: DOCK_APP_COLORS['terminal'],
      action: () => toggleDockApp('terminal'),
    },
    {
      id: 'trash',
      title: 'Trash',
      icon: Trash2,
      color: DOCK_APP_COLORS['trash'],
      action: () => toggleDockApp('trash'),
    },
  ];

  const isDockAppOpen = (id: string) => {
    if (id === 'www') {
      return Object.keys(windows).some(wid => wid === 'www' || wid.startsWith('fm-'));
    }
    if (id === 'terminal') {
      return Object.keys(windows).some(wid => wid === 'terminal' || wid.startsWith('terminal-'));
    }
    if (id === 'trash') {
      return Object.keys(windows).some(wid => wid.startsWith('fm-') && windows[wid].data?.trash);
    }
    return !!windows[id];
  };

  const activeWindows = Object.entries(windows || {}).filter(([id]) => id !== 'widgets');

  return (
    <>
      <div id="taskbar" onClick={() => closeStartMenu()}>
        <div id="dock-left" />

        {/* Center: Dock */}
        <div id="dock-center">
          <div id="dock-items">
            {dockApps.map((app) => {
              const isOpen = isDockAppOpen(app.id);
              return (
                <button
                  key={app.id}
                  className={`dock-item${isOpen ? ' open' : ''}`}
                  title={app.title}
                  onClick={app.action}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    if (app.id === 'www') {
                      Object.keys(windows).filter(wid => wid === 'www' || wid.startsWith('fm-')).forEach(wid => closeWindow(wid));
                    } else if (app.id === 'terminal') {
                      Object.keys(windows).filter(wid => wid === 'terminal' || wid.startsWith('terminal-')).forEach(wid => closeWindow(wid));
                    } else {
                      closeWindow(app.id);
                    }
                  }}
                >
                  <div className="dock-icon-wrap" style={{ background: app.color }}>
                    <app.icon size={20} />
                  </div>
                  {isOpen && <div className="dock-dot" />}
                </button>
              );
            })}

            {/* Divider */}
            {activeWindows.length > 0 && <div className="dock-divider" />}

            {/* Running app windows — same colorful icons as Launchpad */}
            {activeWindows.map(([id, w]) => {
              if (id === 'applications' || id === 'www' || id === 'taskmgr' ||
                  id === 'terminal' || id.startsWith('fm-') || id.startsWith('terminal-')) return null;

              // Find matching icon and color
              let Icon: typeof Terminal | undefined;
              for (const [key, Ico] of Object.entries(RUNNING_APP_ICONS)) {
                if (id === key || id.startsWith(key)) { Icon = Ico; break; }
              }
              const color = RUNNING_APP_COLORS[id] || RUNNING_APP_COLORS[id.replace(/-\d+$/, '')] || 'linear-gradient(135deg, #636366, #8e8e93)';

              return (
                <button
                  key={id}
                  className={`dock-item${!w.minimized ? ' open' : ''}`}
                  title={w.title}
                  onClick={() => handleItemClick(id, w)}
                  onContextMenu={(e) => { e.preventDefault(); closeWindow(id); }}
                >
                  <div className="dock-icon-wrap" style={{ background: color }}>
                    {Icon ? <Icon size={20} /> : <span className="dock-fallback-icon">{w.title.charAt(0).toUpperCase()}</span>}
                  </div>
                  {!w.minimized && <div className="dock-dot" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Clock, Fullscreen */}
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
      </div>
    </>
  );
}

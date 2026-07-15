import { useState, useMemo, useEffect } from 'react';
import { useDesktopStore } from '../../store/desktopStore';
import { useAuthStore } from '../../store/authStore';
import {
  Terminal, Settings, LogOut, Search, User, Power, Pin, X, Grid, FileText,
} from 'lucide-react';
import LaravelIcon from '../LaravelWizard/LaravelIcon';

interface AppItem {
  id: string;
  title: string;
  icon: typeof Terminal;
  desc: string;
}

const REGULAR: AppItem[] = [
  { id: 'terminal', title: 'Terminal', icon: Terminal, desc: 'Command line shell' },
  { id: 'taskmgr', title: 'Task Manager', icon: Terminal, desc: 'System resources' },
  { id: 'settings', title: 'Settings', icon: Settings, desc: 'System preferences' },
  { id: 'bnote', title: 'BNote', icon: Terminal, desc: 'Text & code editor' },
  { id: 'www', title: 'File Manager', icon: Terminal, desc: 'Browse files' },
  { id: 'gitcloner', title: 'Git Clone', icon: Terminal, desc: 'Clone repos' },
  { id: 'sqleditor', title: 'SQLite Editor', icon: Terminal, desc: 'Browse databases' },
  { id: 'bananabrowser', title: 'Banana Browser', icon: Terminal, desc: 'Web browser' },
  { id: 'subdomain', title: 'Subdomain', icon: Terminal, desc: 'Manage subdomains' },
  { id: 'wget', title: 'Download', icon: Terminal, desc: 'Download files' },
  { id: 'bplayer', title: 'Media Player', icon: Terminal, desc: 'Media player' },
  { id: 'snake', title: 'Snake', icon: Terminal, desc: 'Classic snake game' },
  { id: 'pingpong', title: 'Ping Pong', icon: Terminal, desc: 'Table tennis' },
  { id: 'dockermanager', title: 'Docker', icon: Terminal, desc: 'Manage containers' },
  { id: 'apps', title: 'Software Center', icon: Terminal, desc: 'Install apps' },
  { id: 'appinstaller', title: 'App Installer', icon: Terminal, desc: 'Install HTML apps' },
  { id: 'nginx-editor', title: 'Nginx Editor', icon: FileText, desc: 'Edit nginx configs' },
  { id: 'php-editor', title: 'PHP Editor', icon: FileText, desc: 'Edit PHP configs' },
  { id: 'host-editor', title: 'Hosts Editor', icon: FileText, desc: 'Edit /etc/hosts' },
  { id: 'cron', title: 'Cron Manager', icon: FileText, desc: 'Manage cron jobs' },
  { id: 'ssl', title: 'SSL Certificates', icon: FileText, desc: 'View SSL certs' },
  { id: 'pm2', title: 'PM2 Manager', icon: FileText, desc: 'Manage PM2 processes' },
  { id: 'db-editor', title: 'Database Editor', icon: FileText, desc: 'Query MySQL/PostgreSQL' },
  { id: 'laravel-wizard', title: 'Laravel Installer', icon: LaravelIcon, desc: 'Install Laravel projects' },
  { id: 'laravel-management', title: 'Laravel Management', icon: LaravelIcon, desc: 'Monitor Laravel projects' },
];

export default function StartMenu() {
  const store = useDesktopStore();
  const { closeStartMenu, openWindow, setTbSearchQuery, pinApp, unpinApp } = store;
  const startMenuOpen = store.startMenuOpen ?? false;
  const tbSearchQuery = store.tbSearchQuery ?? '';
  const pinnedApps = store.pinnedApps ?? [];
  const { user, logout } = useAuthStore();
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; id: string; title: string } | null>(null);

  useEffect(() => {
    if (!startMenuOpen) {
      setTbSearchQuery('');
      setCtxMenu(null);
    }
  }, [startMenuOpen, setTbSearchQuery]);

  // Close context menu on outside click
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [ctxMenu]);

  // Pinned apps data
  const pinnedData = useMemo(() => {
    return pinnedApps
      .map(id => REGULAR.find(a => a.id === id))
      .filter(Boolean) as AppItem[];
  }, [pinnedApps]);

  const handleRightClick = (e: React.MouseEvent, id: string, title: string) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, id, title });
  };

  const handlePin = (id: string) => {
    pinApp(id);
    setCtxMenu(null);
  };

  const handleUnpin = (id: string) => {
    unpinApp(id);
    setCtxMenu(null);
  };

  const isPinned = (id: string) => pinnedApps.includes(id);

  if (!startMenuOpen) return null;

  return (
    <div id="start-menu" onClick={() => setCtxMenu(null)}>
      {/* ===== Top Bar: Avatar + Search ===== */}
      <div id="sm-topbar">
        <div id="sm-user-info">
          <div className="sm-avatar">
            {user?.avatar && !avatarFailed ? (
              <img src={`/api/v1/auth/avatar/${user.id}`} alt=""
                style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%' }}
                onError={() => setAvatarFailed(true)} />
            ) : (
              <User size={16} />
            )}
          </div>
          <span className="sm-username">{user?.username || 'User'}</span>
        </div>
        <div id="sm-search-compact">
          <Search size={13} />
          <input type="text" placeholder="Search" autoFocus
            value={tbSearchQuery}
            onChange={(e) => setTbSearchQuery(e.target.value)}
            onClick={(e) => e.stopPropagation()} />
        </div>
      </div>

      {/* ===== Body: Pinned Apps + Applications Button ===== */}
      <div id="sm-body-simple">
        {/* Pinned section */}
        <div className="sm-pinned-section">
          <div className="sm-pinned-header">
            <Pin size={12} />
            <span>Pinned</span>
          </div>
          <div className="sm-pinned-grid">
            {pinnedData.length === 0 ? (
              <div className="sm-pinned-empty">
                <span>Right-click an app to pin it here</span>
              </div>
            ) : (
              pinnedData.map(({ id, title, icon: Icon, desc }) => (
                <div key={id} className="sm-pinned-tile-wrap"
                  onContextMenu={(e) => handleRightClick(e, id, title)}>
                  <button className="sm-pinned-tile"
                    onClick={() => { closeStartMenu(); openWindow(id, title); }}
                    title={desc}>
                    <div className="sm-pinned-tile-icon"><Icon size={18} /></div>
                    <span className="sm-pinned-tile-title">{title}</span>
                    <button className="sm-pinned-unpin"
                      onClick={(e) => { e.stopPropagation(); unpinApp(id); }}
                      title="Unpin from Start">
                      <X size={10} />
                    </button>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Applications button */}
        <button className="sm-apps-btn" onClick={() => {
          closeStartMenu();
          openWindow('applications', 'Applications');
        }}>
          <Grid size={16} />
          <span>Applications</span>
        </button>
      </div>

      {/* ===== Bottom Bar: Actions ===== */}
      <div id="sm-bottombar">
        <button className="sm-bot-btn" title="Settings"
          onClick={() => { closeStartMenu(); openWindow('settings', 'Settings'); }}>
          <Settings size={14} /> Settings
        </button>
        <div id="sm-bot-right">
          <button className="sm-bot-btn" title="Power"
            onClick={() => { closeStartMenu(); }}>
            <Power size={14} />
          </button>
          <button className="sm-bot-btn" title="Log Out"
            onClick={() => { closeStartMenu(); logout(); }}>
            <LogOut size={14} />
          </button>
        </div>
      </div>

      {/* ===== Right-Click Context Menu ===== */}
      {ctxMenu && (
        <div className="sm-context-menu"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onClick={(e) => e.stopPropagation()}>
          {isPinned(ctxMenu.id) ? (
            <button className="sm-ctx-item" onClick={() => handleUnpin(ctxMenu.id)}>
              <X size={14} /> Unpin from Start
            </button>
          ) : (
            <button className="sm-ctx-item" onClick={() => handlePin(ctxMenu.id)}>
              <Pin size={14} /> Pin to Start
            </button>
          )}
        </div>
      )}
    </div>
  );
}

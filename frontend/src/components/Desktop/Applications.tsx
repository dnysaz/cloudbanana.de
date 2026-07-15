import { useState, useMemo, useEffect, useCallback } from 'react';
import { useDesktopStore } from '../../store/desktopStore';
import { api } from '../../api';
import {
  Terminal, Monitor, Settings, FileText, GitBranch, Database, Globe, Download,
  Gamepad2, Film, Folder, Package, Container, Search, X,
} from 'lucide-react';
import LaravelIcon from '../LaravelWizard/LaravelIcon';

interface AppItem {
  id: string;
  title: string;
  icon: typeof Terminal;
  desc: string;
  category?: string;
  path?: string;
}

interface InstalledAppInfo {
  name: string;
  title: string;
  description: string;
  html_path: string;
  icon_path: string | null;
}

// Vibrant macOS-style gradient colors for each app
const APP_COLORS: Record<string, string> = {
  terminal: 'linear-gradient(135deg, #1a1a2e, #16213e)',
  taskmgr: 'linear-gradient(135deg, #007aff, #00b4d8)',
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
  www: 'linear-gradient(135deg, #007aff, #5856d6)',
  dockermanager: 'linear-gradient(135deg, #0d7cff, #2496ed)',
  apps: 'linear-gradient(135deg, #af52de, #7c3aed)',
  appinstaller: 'linear-gradient(135deg, #5856d6, #7c3aed)',
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

const ALL_APPS: AppItem[] = [
  { id: 'terminal', title: 'Terminal', icon: Terminal, desc: 'Command line shell', category: 'sys' },
  { id: 'taskmgr', title: 'Task Manager', icon: Monitor, desc: 'System resources and processes', category: 'sys' },
  { id: 'settings', title: 'Settings', icon: Settings, desc: 'System preferences', category: 'sys' },
  { id: 'bnote', title: 'BNote', icon: FileText, desc: 'Text & code editor', category: 'dev' },
  { id: 'gitcloner', title: 'Git Clone', icon: GitBranch, desc: 'Clone git repositories', category: 'dev' },
  { id: 'sqleditor', title: 'SQLite Editor', icon: Database, desc: 'Browse SQLite databases', category: 'dev' },
  { id: 'bananabrowser', title: 'Banana Browser', icon: Globe, desc: 'Web browser with proxy', category: 'internet' },
  { id: 'subdomain', title: 'Subdomain', icon: Globe, desc: 'Manage subdomains', category: 'internet' },
  { id: 'wget', title: 'Download', icon: Download, desc: 'Download files from URL', category: 'internet' },
  { id: 'bplayer', title: 'Media Player', icon: Film, desc: 'Media player', category: 'media' },
  { id: 'snake', title: 'Snake', icon: Gamepad2, desc: 'Classic snake game', category: 'media' },
  { id: 'pingpong', title: 'Ping Pong', icon: Gamepad2, desc: 'Table tennis arcade', category: 'media' },
  { id: 'www', title: 'File Manager', icon: Folder, desc: 'Browse files and folders', category: 'other' },
  { id: 'dockermanager', title: 'Docker', icon: Container, desc: 'Manage Docker containers', category: 'other' },
  { id: 'apps', title: 'Software Center', icon: Package, desc: 'Install and manage apps', category: 'other' },
  { id: 'appinstaller', title: 'App Installer', icon: Package, desc: 'Install custom HTML apps', category: 'other' },
  { id: 'nginx-editor', title: 'Nginx Editor', icon: FileText, desc: 'Edit nginx configuration files', category: 'sys' },
  { id: 'php-editor', title: 'PHP Editor', icon: FileText, desc: 'Edit PHP configuration files', category: 'sys' },
  { id: 'host-editor', title: 'Hosts Editor', icon: FileText, desc: 'Edit /etc/hosts', category: 'sys' },
  { id: 'cron', title: 'Cron Manager', icon: FileText, desc: 'Manage scheduled jobs', category: 'sys' },
  { id: 'ssl', title: 'SSL Certificates', icon: FileText, desc: 'View SSL certificate details', category: 'sys' },
  { id: 'pm2', title: 'PM2 Manager', icon: FileText, desc: 'Manage PM2 processes', category: 'sys' },
  { id: 'db-editor', title: 'Database Editor', icon: FileText, desc: 'Query MySQL/PostgreSQL databases', category: 'dev' },
  { id: 'laravel-wizard', title: 'Laravel Installer', icon: LaravelIcon, desc: 'Install Laravel projects step-by-step', category: 'dev' },
  { id: 'laravel-management', title: 'Laravel Management', icon: LaravelIcon, desc: 'Monitor and manage Laravel projects', category: 'dev' },
];

function getAppGradient(id: string): string {
  // For dynamic IDs like fm-*, terminal-*, use the base color
  if (id.startsWith('fm-') || id.startsWith('www')) return APP_COLORS['www'];
  if (id.startsWith('terminal-')) return APP_COLORS['terminal'];
  // Random gradient for unknown apps
  return APP_COLORS[id] || 'linear-gradient(135deg, #636366, #8e8e93)';
}

export default function Applications(props: { winId?: string; winData?: Record<string, unknown> }) {
  const { windows, openWindow, closeWindow, closeStartMenu } = useDesktopStore();
  const [search, setSearch] = useState('');
  const [installedApps, setInstalledApps] = useState<InstalledAppInfo[]>([]);

  const loadInstalledApps = useCallback(async () => {
    try {
      const data = await api.get<{ apps: InstalledAppInfo[] }>('/apps/installed');
      setInstalledApps(data.apps);
    } catch {}
  }, []);

  useEffect(() => {
    loadInstalledApps();
  }, [loadInstalledApps]);

  const allApps = useMemo(() => [
    ...ALL_APPS,
    ...installedApps.map(a => ({
      id: 'app-' + a.name,
      title: a.title,
      icon: Globe as typeof Terminal,
      desc: a.description,
      category: 'other' as string,
      path: a.html_path,
    })),
  ], [installedApps]);

  const filteredApps = useMemo(() => {
    if (!search.trim()) return allApps;
    const q = search.toLowerCase();
    return allApps.filter(i =>
      i.title.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q)
    );
  }, [search, allApps]);

  const openApp = (app: AppItem) => {
    closeStartMenu();
    if (!windows[app.id]) {
      openWindow(app.id, app.title, app.path ? { path: app.path } : undefined);
    }
    if (props.winId) closeWindow(props.winId);
  };

  return (
    <div className="apps-launchpad">
      {/* Search bar */}
      <div className="lp-search">
        <div className="lp-search-wrap">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search"
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="lp-search-clear" onClick={() => setSearch('')}>
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* App grid */}
      <div className="lp-body">
        {filteredApps.length === 0 ? (
          <div className="lp-empty">No applications found</div>
        ) : (
          <div className="lp-grid">
            {filteredApps.map(app => (
              <button key={app.id} className="lp-card" onClick={() => openApp(app)} title={app.desc}>
                <div
                  className="lp-icon"
                  style={{ background: getAppGradient(app.id) }}
                >
                  <app.icon size={34} />
                </div>
                <span className="lp-title">{app.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

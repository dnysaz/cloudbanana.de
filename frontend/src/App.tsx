import { lazy, Suspense, useEffect, useState, useCallback } from 'react';
import { useAuthStore } from './store/authStore';
import { useDesktopStore } from './store/desktopStore';
import LoginScreen from './components/Login/LoginScreen';
import Desktop from './components/Desktop/Desktop';
import Window from './components/Window/Window';

// Heavy components loaded on demand
const TaskManager = lazy(() => import('./components/TaskManager/TaskManager'));
const Terminal = lazy(() => import('./components/Terminal/Terminal'));
const SoftwareCenter = lazy(() => import('./components/SoftwareCenter/SoftwareCenter'));
const Users = lazy(() => import('./components/Users/Users'));
const Subdomain = lazy(() => import('./components/Subdomain/Subdomain'));
const Wget = lazy(() => import('./components/Wget/Wget'));
const Settings = lazy(() => import('./components/Settings/Settings'));
const FileManager = lazy(() => import('./components/FileManager/FileManager'));
const BPlayer = lazy(() => import('./components/MediaViewer/MediaViewer'));
const BNote = lazy(() => import('./components/BNote/BNote'));
const Snake = lazy(() => import('./components/Games/Snake'));
const PingPong = lazy(() => import('./components/Games/PingPong'));
const GitCloner = lazy(() => import('./components/GitCloner/GitCloner'));
const BWeb = lazy(() => import('./components/BWeb/BWeb'));
const BananaBrowser = lazy(() => import('./components/Browser/BananaBrowser'));
const DockerManager = lazy(() => import('./components/DockerManager/DockerManager'));
const SqlEditor = lazy(() => import('./components/SqlEditor/SqlEditor'));
const AppInstaller = lazy(() => import('./components/AppInstaller/AppInstaller'));
const Widgets = lazy(() => import('./components/Desktop/Widgets'));
const Applications = lazy(() => import('./components/Desktop/Applications'));
const NginxEditor = lazy(() => import('./components/NginxEditor/NginxEditor'));
const PhpEditor = lazy(() => import('./components/PhpEditor/PhpEditor'));
const HostEditor = lazy(() => import('./components/HostEditor/HostEditor'));
const CronManager = lazy(() => import('./components/CronManager/CronManager'));
const SSLManager = lazy(() => import('./components/SSLManager/SSLManager'));
const PM2Manager = lazy(() => import('./components/PM2Manager/PM2Manager'));
const DatabaseEditor = lazy(() => import('./components/DatabaseEditor/DatabaseEditor'));
const LaravelWizard = lazy(() => import('./components/LaravelWizard/LaravelWizard'));
const LaravelManagement = lazy(() => import('./components/LaravelManagement/LaravelManagement'));

const FALLBACK = <div style={{padding:'2rem', textAlign:'center', color:'var(--text-muted)', fontSize:'0.78rem'}}>Loading...</div>;

const WINDOW_COMPONENTS: Record<string, React.LazyExoticComponent<React.FC<{ winId?: string; winData?: Record<string, unknown> }>>> = {
  taskmgr: TaskManager,
  terminal: Terminal,
  apps: SoftwareCenter,
  users: Users,
  subdomain: Subdomain,
  wget: Wget,
  settings: Settings,
  www: FileManager,
  media: BPlayer,
  bnote: BNote,
  bplayer: BPlayer,
  snake: Snake,
  pingpong: PingPong,
  gitcloner: GitCloner,
  bweb: BWeb,
  bananabrowser: BananaBrowser,
  dockermanager: DockerManager,
  sqleditor: SqlEditor,
  appinstaller: AppInstaller,
  widgets: Widgets,
  applications: Applications,
  'nginx-editor': NginxEditor,
  'php-editor': PhpEditor,
  'host-editor': HostEditor,
  'cron': CronManager,
  'ssl': SSLManager,
  'pm2': PM2Manager,
  'db-editor': DatabaseEditor,
  'laravel-wizard': LaravelWizard,
  'laravel-management': LaravelManagement,
};

export default function App() {
  const { user, initialized } = useAuthStore();
  const { windows, openWindow, closeStartMenu, startMenuOpen } = useDesktopStore();
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    if (!initialized) useAuthStore.getState().checkAuth();
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    if (!desktop || !user) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs/textareas
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement).isContentEditable) {
        // Allow Escape to still work in inputs (close modals/menus)
        if (e.key !== 'Escape') return;
      }

      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      // Escape → Close start menu
      if (e.key === 'Escape') {
        if (startMenuOpen) {
          closeStartMenu();
          e.preventDefault();
        }
        return;
      }

      // Ctrl+Shift+T → Open Terminal
      if (ctrl && shift && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        const id = 'terminal-' + Date.now();
        openWindow(id, 'Terminal');
        return;
      }

      // Ctrl+Shift+E → Open File Manager (home dir)
      if (ctrl && shift && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        const home = user?.home || (user?.username === 'root' ? '/root' : '/home/' + (user?.username || ''));
        openWindow('fm-' + Date.now(), 'File Manager', { path: home });
        return;
      }

      // Ctrl+Shift+M → Open Task Manager
      if (ctrl && shift && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        openWindow('taskmgr', 'System Monitor');
        return;
      }

      // Ctrl+Shift+S → Open Settings
      if (ctrl && shift && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        openWindow('settings', 'Settings');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [desktop, user, openWindow, closeStartMenu, startMenuOpen]);

  const enterDesktop = useCallback(() => {
    setDesktop(true);
  }, []);

  if (!desktop || !user) {
    return <LoginScreen onEnterDesktop={enterDesktop} />;
  }

  return (
    <Desktop>
      {Object.entries(windows || {}).map(([id, win]) => {
        let Comp = WINDOW_COMPONENTS[id];
        if (!Comp) {
          if (id.startsWith('fm-')) Comp = FileManager;
          else if (id.startsWith('media-')) Comp = BPlayer;
          else if (id.startsWith('bnote-')) Comp = BNote;
          else if (id.startsWith('bplayer-')) Comp = BPlayer;
          else if (id.startsWith('git-')) Comp = GitCloner;
          else if (id.startsWith('web-')) Comp = BWeb;
          else if (id.startsWith('terminal-')) Comp = Terminal;
          else if (id === 'bananabrowser') Comp = BananaBrowser;
          else if (id === 'dockermanager') Comp = DockerManager;
          else if (id.startsWith('sqleditor-')) Comp = SqlEditor;
          else if (id.startsWith('app-')) Comp = BWeb;
          else if (id === 'appinstaller') Comp = AppInstaller;
          else if (id.startsWith('nginx-editor-')) Comp = NginxEditor;
          else if (id.startsWith('php-editor-')) Comp = PhpEditor;
          else if (id.startsWith('host-editor-')) Comp = HostEditor;
          else if (id.startsWith('cron-')) Comp = CronManager;
          else if (id.startsWith('ssl-')) Comp = SSLManager;
          else if (id.startsWith('pm2-')) Comp = PM2Manager;
          else if (id.startsWith('db-editor-')) Comp = DatabaseEditor;
          else if (id.startsWith('laravel-wizard-')) Comp = LaravelWizard;
          else if (id.startsWith('laravel-management-')) Comp = LaravelManagement;
          else return null;
        }
        return (
          <Window key={id} id={id} title={win.title}>
            <Suspense fallback={FALLBACK}>
              <Comp winId={id} winData={win.data} />
            </Suspense>
          </Window>
        );
      })}
    </Desktop>
  );
}

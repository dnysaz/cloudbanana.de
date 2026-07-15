import { useState, useEffect, useRef, useCallback } from 'react';
import { api, ApiError } from '../../api';
import { useDesktopStore } from '../../store/desktopStore';
import { useAuthStore } from '../../store/authStore';
import {
  Globe, Download, Upload, CheckCircle, AlertCircle, Clock,
  Trash2, RefreshCw, ExternalLink, Package,
  GitBranch, Info, FileText, Folder, HelpCircle,
} from 'lucide-react';

interface InstalledApp {
  name: string;
  title: string;
  description: string;
  html_path: string;
  icon_path: string | null;
  version?: string;
  author?: string;
}

export default function AppInstaller() {
  const { openWindow } = useDesktopStore();
  const { user } = useAuthStore();
  const homeDir = user?.home || (user?.username === 'root' ? '/root' : '/home/' + (user?.username || 'root')) || '/root';

  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [gitUrl, setGitUrl] = useState('');
  const [installing, setInstalling] = useState(false);
  const [installTaskId, setInstallTaskId] = useState<string | null>(null);
  const [installOutput, setInstallOutput] = useState('');
  const [installStatus, setInstallStatus] = useState('');
  const [confirmUninstall, setConfirmUninstall] = useState<string | null>(null);
  const [tab, setTab] = useState<'installed' | 'install'>('installed');
  const [helpOpen, setHelpOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const loadApps = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<{ apps: InstalledApp[] }>('/apps/installed');
      setApps(data.apps);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load apps');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadApps();
    // Refresh when apps installed from File Manager or elsewhere
    const handler = () => loadApps();
    document.addEventListener('apps-installed-refresh', handler);
    return () => document.removeEventListener('apps-installed-refresh', handler);
  }, [loadApps]);

  // Poll install status
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (installTaskId && installing) {
      pollRef.current = setInterval(async () => {
        try {
          const data = await api.get<{ status: string; output: string }>('/apps/install/status/' + installTaskId);
          setInstallStatus(data.status);
          setInstallOutput(data.output);
          if (data.status === 'done' || data.status === 'error') {
            setInstalling(false);
            if (pollRef.current) clearInterval(pollRef.current);
            loadApps();
          }
        } catch {
          setInstalling(false);
          setError('Failed to check install status');
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }, 1000);
      return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }
  }, [installTaskId, installing, loadApps]);

  const handleGitInstall = async () => {
    if (!gitUrl.trim() || installing) return;
    setError('');
    setInstallOutput('');
    setInstallStatus('running');
    setInstalling(true);
    setTab('install');
    try {
      const data = await api.post<{ task_id: string; status: string }>('/apps/install', { url: gitUrl.trim() });
      setInstallTaskId(data.task_id);
    } catch (e) {
      setInstalling(false);
      setError(e instanceof ApiError ? e.message : 'Install failed to start');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      // Upload ZIP to server first
      const form = new FormData();
      form.append('file', file);
      form.append('path', homeDir);
      const uploadResult = await api.post<{ path: string }>('/files/upload', form, true);

      // Extract app name from filename
      let appName = file.name.replace(/\.zip$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');

      // Install from uploaded ZIP
      await api.post('/apps/install/upload', { path: uploadResult.path, app_name: appName });
      await loadApps();
      setTab('installed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload/install failed');
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUninstall = async (appName: string) => {
    try {
      await api.del('/apps/installed/' + appName);
      setConfirmUninstall(null);
      await loadApps();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Uninstall failed');
    }
  };

  const openApp = (app: InstalledApp) => {
    const winId = 'app-' + app.name;
    openWindow(winId, app.title, { path: app.html_path });
  };

  return (
    <div className="ai">
      {/* Toolbar */}
      <div className="ai-toolbar">
        <div className="ai-toolbar-left">
          <span className="ai-toolbar-title">
            <Package size={15} style={{ color: '#f97316' }} /> App Installer
          </span>
        </div>
        <div className="ai-toolbar-tabs">
          <button className={`ai-tab${tab === 'installed' ? ' active' : ''}`}
            onClick={() => setTab('installed')}>
            <Package size={13} /> Installed
          </button>
          <button className={`ai-tab${tab === 'install' ? ' active' : ''}`}
            onClick={() => setTab('install')}>
            <Download size={13} /> Install
          </button>
        </div>
        <div className="ai-toolbar-right">
          <div className="ai-toolbar-menu" onMouseLeave={() => setOpenMenu(null)}>
            <button className={`ai-menu-btn${openMenu === 'Help' ? ' open' : ''}`}
              onClick={() => setOpenMenu(openMenu === 'Help' ? null : 'Help')}
              onMouseEnter={() => openMenu === 'Installed' && setOpenMenu('Help')}
              title="Help">
              <HelpCircle size={14} />
            </button>
            {openMenu === 'Help' && (
              <div className="ai-menu-drop" style={{ left:'auto', right:0 }}>
                <button className="ai-menu-item" onClick={() => { setOpenMenu(null); setHelpOpen(true); }}>
                  <Info size={14} /> About App Structure
                </button>
              </div>
            )}
          </div>
          <button className="ai-btn-icon" onClick={loadApps} title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {error && <div className="ai-error">{error}</div>}

      {tab === 'installed' ? (
        /* ===== Installed Apps List ===== */
        <div className="ai-body">
          {loading ? (
            <div className="ai-empty">
              <div className="ai-spinner" />
              <span>Loading installed apps...</span>
            </div>
          ) : apps.length === 0 ? (
            <div className="ai-empty">
              <Package size={40} />
              <span>No apps installed yet</span>
              <span className="ai-hint">Go to the <strong>Install</strong> tab to install an app</span>
            </div>
          ) : (
            <div className="ai-app-grid">
              {apps.map((app) => (
                <div key={app.name} className="ai-app-card">
                  <div className="ai-app-card-icon">
                    {app.icon_path ? (
                      <img src={`/api/v1/files/raw?path=${encodeURIComponent(app.icon_path)}`}
                        alt="" className="ai-app-icon-img"
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                    ) : (
                      <Globe size={24} />
                    )}
                  </div>
                  <span className="ai-app-card-title">{app.title}</span>
                  <span className="ai-app-card-desc">{app.description}</span>
                  <div className="ai-app-card-actions">
                    <button className="ai-btn ai-btn-primary ai-btn-sm"
                      onClick={(e) => { e.stopPropagation(); openApp(app); }}>
                      <ExternalLink size={12} /> Open
                    </button>
                    <button className="ai-btn ai-btn-danger ai-btn-sm"
                      onClick={(e) => { e.stopPropagation(); setConfirmUninstall(app.name); }}>
                      <Trash2 size={12} /> Uninstall
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ===== Install Tab ===== */
        <div className="ai-body">
          <div className="ai-install-form">
          {/* Git URL Install */}
          <div className="ai-section">
            <label className="ai-label">
              <GitBranch size={14} /> Install from Git URL
            </label>
            <div className="ai-row">
              <input className="ai-input" type="text" value={gitUrl}
                onChange={(e) => setGitUrl(e.target.value)}
                placeholder="https://github.com/user/repo.git"
                onKeyDown={(e) => e.key === 'Enter' && handleGitInstall()}
                disabled={installing} />
              <button className="ai-btn ai-btn-primary" onClick={handleGitInstall}
                disabled={installing || !gitUrl.trim()}>
                {installing ? (
                  <><Clock size={14} className="ai-spin" /> Installing...</>
                ) : (
                  <><Download size={14} /> Install</>
                )}
              </button>
            </div>
            <span className="ai-hint">Supports any public Git repository containing an HTML file</span>
          </div>

          <div className="ai-divider">
            <span>or</span>
          </div>

          {/* File Upload */}
          <div className="ai-section">
            <label className="ai-label">
              <Upload size={14} /> Upload ZIP File
            </label>
            <div className="ai-upload-area">
              <input ref={fileInputRef} type="file" accept=".zip" style={{ display: 'none' }}
                onChange={handleFileUpload} />
              <button className="ai-btn ai-btn-outline" onClick={() => fileInputRef.current?.click()}
                disabled={uploading}>
                <Upload size={16} />
                {uploading ? 'Uploading...' : 'Choose ZIP File'}
              </button>
              <span className="ai-hint">Upload a ZIP containing your HTML app</span>
            </div>
          </div>

          {/* Install Progress */}
          {installOutput && (
            <div className="ai-section">
              <div className="ai-status-header">
                {installStatus === 'done' ? <CheckCircle size={14} className="ai-ico-done" />
                  : installStatus === 'error' ? <AlertCircle size={14} className="ai-ico-error" />
                  : <Clock size={14} className="ai-ico-running" />}
                <span className={`ai-status-label ai-status-${installStatus}`}>
                  {installStatus === 'done' ? 'Install completed'
                    : installStatus === 'error' ? 'Install failed'
                    : 'Installing...'}
                </span>
              </div>
              <pre className="ai-output">{installOutput}</pre>
            </div>
          )}
          </div>
        </div>
      )}

      {/* Uninstall Confirmation Modal */}
      {confirmUninstall && (
        <div className="modal-overlay" onClick={() => setConfirmUninstall(null)}>
          <div className="modal-box" style={{ maxWidth: 380 }}>
            <div className="modal-title">
              <Trash2 size={16} style={{ color: 'var(--danger)' }} /> Uninstall App
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.75rem 0' }}>
              Are you sure you want to uninstall <strong>{confirmUninstall}</strong>? This will permanently delete all files.
            </p>
            <div className="modal-actions">
              <button className="modal-btn modal-btn-cancel" onClick={() => setConfirmUninstall(null)}>Cancel</button>
              <button className="modal-btn modal-btn-danger" onClick={() => handleUninstall(confirmUninstall)}>
                Uninstall
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help modal: App structure info */}
      {helpOpen && (
        <div className="modal-overlay" onClick={() => setHelpOpen(false)}>
          <div className="modal-box" style={{ width: 420, maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="modal-title" style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginBottom:'0.6rem' }}>
              <HelpCircle size={18} style={{ color:'var(--accent)' }} /> App Installation Guide
            </div>
            <div style={{ fontSize:'0.72rem', color:'var(--text-secondary)', lineHeight:1.6 }}>
              <p style={{ marginBottom:'0.5rem' }}>
                Apps are installed to <code style={{ background:'var(--bg-surface)', padding:'0.1rem 0.35rem', borderRadius:3, fontSize:'0.65rem' }}>~/applications/&lt;app_name&gt;/</code>
              </p>

              <div style={{ fontWeight:600, color:'var(--text-primary)', marginTop:'0.6rem', marginBottom:'0.25rem' }}>
                <Folder size={13} style={{ verticalAlign:'middle', marginRight:'0.2rem' }} />
                Required Structure:
              </div>
              <pre style={{ background:'var(--bg-input)', padding:'0.5rem', borderRadius:'var(--radius)', fontSize:'0.62rem', lineHeight:1.5, whiteSpace:'pre-wrap', marginBottom:'0.3rem', fontFamily:'monospace' }}>
{`applications/
  my-app/
    my-app.html      ← Main entry (required)
    manifest.json     ← Metadata (auto-created)
    icon.svg          ← App icon (optional)
    icon.png          ← App icon (optional)
    style.css         ← Your styles (optional)
    app.js            ← Your scripts (optional)`}
              </pre>

              <div style={{ fontWeight:600, color:'var(--text-primary)', marginTop:'0.6rem', marginBottom:'0.25rem' }}>
                <FileText size={13} style={{ verticalAlign:'middle', marginRight:'0.2rem' }} />
                manifest.json:
              </div>
              <pre style={{ background:'var(--bg-input)', padding:'0.5rem', borderRadius:'var(--radius)', fontSize:'0.62rem', lineHeight:1.5, whiteSpace:'pre-wrap', marginBottom:'0.3rem', fontFamily:'monospace' }}>
{`{
  "name": "My App",        ← Display name
  "description": "...",    ← Short description
  "version": "1.0.0",      ← Version
  "author": "..."           ← Author name
}`}
              </pre>

              <div style={{ fontWeight:600, color:'var(--text-primary)', marginTop:'0.6rem', marginBottom:'0.25rem' }}>
                <Download size={13} style={{ verticalAlign:'middle', marginRight:'0.2rem' }} />
                Install Methods:
              </div>
              <ul style={{ paddingLeft:'1.1rem', fontSize:'0.68rem', marginBottom:'0.3rem' }}>
                <li><strong>Git URL</strong> — Clone any public repo with HTML file(s)</li>
                <li><strong>ZIP Upload</strong> — Upload a ZIP containing your app</li>
                <li><strong>File Manager</strong> — Right-click a .zip file → Install as App</li>
              </ul>

              <div style={{ fontWeight:600, color:'var(--text-primary)', marginTop:'0.6rem', marginBottom:'0.25rem' }}>
                <Globe size={13} style={{ verticalAlign:'middle', marginRight:'0.2rem' }} />
                How Apps Run:
              </div>
              <p style={{ fontSize:'0.68rem' }}>
                Apps are displayed in a secure iframe (BWeb) with <code style={{ background:'var(--bg-surface)', padding:'0.1rem 0.3rem', borderRadius:3, fontSize:'0.62rem' }}>allow-scripts</code> sandbox.
                The main HTML file is served through the API with authentication.
              </p>
            </div>
            <div className="modal-actions" style={{ marginTop:'0.75rem' }}>
              <button className="modal-btn modal-btn-primary" onClick={() => setHelpOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}

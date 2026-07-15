import { useState, useEffect, useCallback } from 'react';
import { useDesktopStore } from '../../store/desktopStore';
import { api } from '../../api';
import { RefreshCw, ExternalLink, Folder, Check, X, Loader, Wrench } from 'lucide-react';
import LaravelIcon from '../LaravelWizard/LaravelIcon';

interface Project {
  name: string;
  path: string;
  has_env: boolean;
  has_vendor: boolean;
  storage_link: boolean;
  app_key_set: boolean;
  migrated: boolean;
  port: number | null;
  url: string | null;
}

export default function LaravelManagement(_props: { winId?: string; winData?: Record<string, unknown> }) {
  const { openWindow } = useDesktopStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const r = await api.get<{ projects: Project[] }>('/laravel/management');
      setProjects(r.projects || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  };

  const openProject = (path: string) => {
    const id = 'laravel-wizard-' + Date.now();
    openWindow(id, 'Laravel Installer', { path });
  };

  const badge = (ok: boolean, label: string) => (
    <span className={`lm-badge${ok ? ' lm-badge-ok' : ' lm-badge-no'}`} title={label}>
      {ok ? <Check size={10} /> : <X size={10} />}
      {label}
    </span>
  );

  return (
    <div className="lm-root">
      <div className="lm-header">
        <div className="lm-header-left">
          <LaravelIcon size={22} />
          <div>
            <div className="lm-header-title">Laravel Management</div>
            <div className="lm-header-desc">{projects.length} project{projects.length !== 1 ? 's' : ''} detected</div>
          </div>
        </div>
        <button className="lm-btn lm-btn-icon" onClick={handleRefresh} disabled={refreshing} title="Refresh">
          <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
        </button>
      </div>

      <div className="lm-body">
        {loading ? (
          <div className="lm-empty"><Loader size={18} className="spin" /> Loading...</div>
        ) : error ? (
          <div className="lm-empty" style={{ color: 'var(--danger)' }}>{error}</div>
        ) : projects.length === 0 ? (
          <div className="lm-empty">
            <LaravelIcon size={32} />
            <div style={{ marginTop: 8, fontWeight: 600 }}>No Laravel projects found</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>Install one using Laravel Installer</div>
            <button className="lm-btn lm-btn-primary" style={{ marginTop: 12 }} onClick={() => openWindow('laravel-wizard-' + Date.now(), 'Laravel Installer')}>
              <Wrench size={14} /> Open Laravel Installer
            </button>
          </div>
        ) : (
          <div className="lm-grid">
            {projects.map(p => (
              <div key={p.path} className="lm-card">
                <div className="lm-card-top">
                  <div className="lm-card-name">
                    <Folder size={14} style={{ flexShrink: 0 }} />
                    <span>{p.name}</span>
                  </div>
                  <div className="lm-card-path">{p.path}</div>
                </div>
                <div className="lm-card-badges">
                  {badge(p.has_env, '.env')}
                  {badge(p.app_key_set, 'APP_KEY')}
                  {badge(p.has_vendor, 'vendor')}
                  {badge(p.storage_link, 'storage:link')}
                  {badge(p.migrated, 'migrated')}
                </div>
                <div className="lm-card-actions">
                  <button className="lm-btn lm-btn-sm" onClick={() => openProject(p.path)}>
                    <Wrench size={12} /> Manage
                  </button>
                  {p.url && (
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="lm-btn lm-btn-sm lm-btn-outline" style={{ textDecoration: 'none' }}>
                      <ExternalLink size={12} /> Open Site
                    </a>
                  )}
                  {!p.url && p.port && (
                    <span className="lm-card-port" title="Access via IP:port">:{p.port}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

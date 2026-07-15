import { useState, useEffect, useCallback } from 'react';
import { useDesktopStore } from '../../store/desktopStore';
import { api } from '../../api';
import {
  RefreshCw, ExternalLink, Folder, Check, X, Loader, Wrench,
  ChevronDown, ChevronUp, Play, Square, Save, Terminal,
  ArrowUp, ArrowDown,
} from 'lucide-react';
import LaravelIcon from '../LaravelWizard/LaravelIcon';

interface Project {
  name: string;
  path: string;
  has_env: boolean;
  has_vendor: boolean;
  storage_link: boolean;
  app_key_set: boolean;
  migrated: boolean;
  migration_count: number;
  php_version: string | null;
  laravel_version: string | null;
  app_env: string | null;
  app_debug: string | null;
  app_url: string | null;
  db_connection: string | null;
  project_size: string | null;
  port: number | null;
  url: string | null;
  vhost_enabled: boolean;
  vhost_php_version: string | null;
}

export default function LaravelManagement(_props: { winId?: string; winData?: Record<string, unknown> }) {
  const { openWindow } = useDesktopStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [envContent, setEnvContent] = useState('');
  const [envLoading, setEnvLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionOutput, setActionOutput] = useState('');
  const [phpVersions, setPhpVersions] = useState<string[]>([]);
  const [selectedPhp, setSelectedPhp] = useState('');
  const [domainInput, setDomainInput] = useState('');
  const [portInput, setPortInput] = useState('');

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

  useEffect(() => {
    api.get<{ versions: string[] }>('/laravel/php-versions').then(r => {
      setPhpVersions(r.versions || []);
    }).catch(() => {});
  }, []);

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

  const toggleExpand = async (p: Project) => {
    if (expanded === p.path) {
      setExpanded(null);
      return;
    }
    setExpanded(p.path);
    setActionOutput('');
    setEnvContent('');
    if (p.has_env) {
      setEnvLoading(true);
      try {
        const r = await api.post<{ content: string }>('/laravel/env-read', { path: p.path });
        setEnvContent(r.content);
      } catch { setEnvContent(''); }
      setEnvLoading(false);
    }
    const projectPhp = p.vhost_php_version || p.php_version || '';
    setSelectedPhp(projectPhp);
    setDomainInput(p.url ? p.url.replace(/^https?:\/\//, '') : '');
    setPortInput(String(p.port || ''));
  };

  const doAction = async (action: string, ep: string, body: Record<string, unknown>) => {
    setActionLoading(action);
    setActionOutput('');
    try {
      const r = await api.post<{ status: string; output?: string }>(ep, body);
      if (r.output) setActionOutput(r.output);
      if (r.status === 'ok') await load(true);
    } catch (e) {
      setActionOutput(e instanceof Error ? e.message : 'Action failed');
    }
    setActionLoading(null);
  };

  const doToggle = (p: Project) => doAction(
    'toggle',
    `/laravel/${p.name}/toggle`,
    { path: p.path, name: p.name },
  );

  const doMigrate = (p: Project) => doAction(
    'migrate',
    `/laravel/${p.name}/migrate`,
    { path: p.path },
  );

  const doRollback = (p: Project) => doAction(
    'rollback',
    `/laravel/${p.name}/rollback`,
    { path: p.path },
  );

  const doFresh = (p: Project) => doAction(
    'fresh',
    `/laravel/${p.name}/fresh`,
    { path: p.path },
  );

  const doChangePhp = (p: Project) => doAction(
    'php',
    `/laravel/${p.name}/php-version`,
    { path: p.path, php_version: selectedPhp },
  );

  const doDomain = (p: Project) => doAction(
    'domain',
    `/laravel/${p.name}/domain`,
    { path: p.path, domain: domainInput, port: portInput ? Number(portInput) : null },
  );

  const doSaveEnv = (p: Project) => doAction(
    'env',
    '/laravel/env-write',
    { path: p.path, content: envContent },
  );

  const metaItems = (p: Project) => [
    p.php_version && `PHP ${p.php_version}`,
    p.project_size && p.project_size,
    p.app_env && p.app_env,
    p.app_debug !== null && `debug: ${String(p.app_debug) === 'true' ? 'on' : 'off'}`,
    p.db_connection && `DB: ${p.db_connection}`,
    typeof p.migration_count === 'number' && `${p.migration_count} mig`,
  ].filter(Boolean);

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
              <div key={p.path} className={`lm-card${expanded === p.path ? ' lm-card-expanded' : ''}`}>
                <div className="lm-card-top" onClick={() => toggleExpand(p)} style={{ cursor: 'pointer' }}>
                  <div className="lm-card-name">
                    <Folder size={14} style={{ flexShrink: 0 }} />
                    <span>{p.name}</span>
                    {p.laravel_version && <span className="lm-card-laravel-ver" title="Laravel Version">Laravel {p.laravel_version}</span>}
                  </div>
                  <div className="lm-card-path">
                    {p.path}
                    <span className="lm-card-expand-icon">{expanded === p.path ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</span>
                  </div>
                </div>

                <div className="lm-card-badges">
                  {badge(p.has_env, '.env')}
                  {badge(p.app_key_set, 'APP_KEY')}
                  {badge(p.has_vendor, 'vendor')}
                  {badge(p.storage_link, 'storage:link')}
                  {badge(p.migrated, 'migrated')}
                </div>

                <div className="lm-card-meta">
                  {metaItems(p).map((item, i) => (
                    <span key={i} className="lm-meta">{item}</span>
                  ))}
                </div>

                <div className="lm-card-summary-actions">
                  <span className={`lm-site-status${p.vhost_enabled ? ' lm-site-online' : ''}`}>
                    {p.vhost_enabled ? '● Online' : '○ Offline'}
                  </span>
                  {p.vhost_php_version && <span className="lm-meta">PHP {p.vhost_php_version}</span>}
                  <div style={{ flex: 1 }} />
                  <button className="lm-btn lm-btn-sm" onClick={() => toggleExpand(p)}>
                    {expanded === p.path ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Details
                  </button>
                  {p.url && (
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="lm-btn lm-btn-sm lm-btn-outline" style={{ textDecoration: 'none' }}>
                      <ExternalLink size={12} /> Open Site
                    </a>
                  )}
                </div>

                {expanded === p.path && (
                  <div className="lm-detail">
                    <div className="lm-detail-section">
                      <div className="lm-detail-row">
                        <div className="lm-detail-field">
                          <label>Site Status</label>
                          <div className="lm-detail-field-row">
                            <span className={`lm-site-status${p.vhost_enabled ? ' lm-site-online' : ''}`}>
                              {p.vhost_enabled ? '● Online' : '○ Offline'}
                            </span>
                            <button className="lm-btn lm-btn-sm" onClick={() => doToggle(p)} disabled={actionLoading === 'toggle'}>
                              {actionLoading === 'toggle' ? <Loader size={11} className="spin" /> : p.vhost_enabled ? <Square size={11} /> : <Play size={11} />}
                              {p.vhost_enabled ? ' Stop' : ' Start'}
                            </button>
                          </div>
                        </div>
                        <div className="lm-detail-field">
                          <label>PHP Version</label>
                          <div className="lm-detail-field-row">
                            <select className="lm-select" value={selectedPhp} onChange={e => setSelectedPhp(e.target.value)}>
                              {phpVersions.map(v => <option key={v} value={v}>PHP {v}</option>)}
                            </select>
                            <button className="lm-btn lm-btn-sm" onClick={() => doChangePhp(p)} disabled={actionLoading === 'php'}>
                              {actionLoading === 'php' ? <Loader size={11} className="spin" /> : <Check size={11} />} Apply
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="lm-detail-row">
                        <div className="lm-detail-field" style={{ flex: 1 }}>
                          <label>Domain / URL</label>
                          <div className="lm-detail-field-row">
                            <input className="lm-input" value={domainInput} onChange={e => setDomainInput(e.target.value)} placeholder="example.com" style={{ flex: 1 }} />
                            <input className="lm-input" value={portInput} onChange={e => setPortInput(e.target.value)} placeholder="Port" style={{ width: '5rem' }} />
                            <button className="lm-btn lm-btn-sm" onClick={() => doDomain(p)} disabled={actionLoading === 'domain'}>
                              {actionLoading === 'domain' ? <Loader size={11} className="spin" /> : <Save size={11} />} Save
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="lm-detail-section">
                      <div className="lm-detail-section-header">
                        <span>.env Editor</span>
                        <button className="lm-btn lm-btn-sm" onClick={() => doSaveEnv(p)} disabled={actionLoading === 'env'}>
                          {actionLoading === 'env' ? <Loader size={11} className="spin" /> : <Save size={11} />} Save .env
                        </button>
                      </div>
                      {envLoading ? (
                        <div className="lm-empty" style={{ height: '4rem' }}><Loader size={13} className="spin" /></div>
                      ) : (
                        <textarea className="lm-textarea" value={envContent} onChange={e => setEnvContent(e.target.value)} rows={8} spellCheck={false} />
                      )}
                    </div>

                    <div className="lm-detail-section">
                      <div className="lm-detail-section-header">
                        <span>Migrations</span>
                        <div className="lm-detail-actions">
                          <button className="lm-btn lm-btn-sm" onClick={() => doMigrate(p)} disabled={actionLoading === 'migrate'}>
                            {actionLoading === 'migrate' ? <Loader size={11} className="spin" /> : <ArrowUp size={11} />} Migrate
                          </button>
                          <button className="lm-btn lm-btn-sm" onClick={() => doRollback(p)} disabled={actionLoading === 'rollback'}>
                            {actionLoading === 'rollback' ? <Loader size={11} className="spin" /> : <ArrowDown size={11} />} Rollback
                          </button>
                          <button className="lm-btn lm-btn-sm lm-btn-danger" onClick={() => doFresh(p)} disabled={actionLoading === 'fresh'}>
                            {actionLoading === 'fresh' ? <Loader size={11} className="spin" /> : <RefreshCw size={11} />} Fresh
                          </button>
                        </div>
                      </div>
                    </div>

                    {actionOutput && (
                      <div className="lm-detail-section">
                        <div className="lm-detail-section-header">
                          <span><Terminal size={12} /> Output</span>
                          <button className="lm-btn lm-btn-sm" onClick={() => setActionOutput('')}>Clear</button>
                        </div>
                        <pre className="lm-output">{actionOutput}</pre>
                      </div>
                    )}

                    <div className="lm-detail-footer">
                      <button className="lm-btn lm-btn-sm" onClick={() => openProject(p.path)}>
                        <Wrench size={12} /> Open in Installer
                      </button>
                      {p.url && (
                        <a href={p.url} target="_blank" rel="noopener noreferrer" className="lm-btn lm-btn-sm lm-btn-outline" style={{ textDecoration: 'none' }}>
                          <ExternalLink size={12} /> Open Site
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDesktopStore } from '../../store/desktopStore';
import { api, apiPut } from '../../api';
import {
  ArrowRight, ArrowLeft, Check, X, Loader, GitBranch, Upload,
  Folder, FileText, Globe, RefreshCw,
  Download, FolderOpen, FolderPlus, ChevronRight, Home, Database,
  ExternalLink, Shield, Wrench
} from 'lucide-react';

const LaravelLogo = () => (
  <svg viewBox="0 0 80 80" width="28" height="28" fill="none">
    <rect width="80" height="80" rx="16" fill="#FF2D20" />
    <path d="M32 22l8 5.5-8 5.5v-3.6l4.4-1.9L32 25.6V22zM38 22l8 5.5-8 5.5v-3.6l4.4-1.9L38 25.6V22z" fill="#fff" opacity="0.9" />
    <path d="M26 28l8 5.5-8 5.5v-3.6l4.4-1.9L26 31.6V28zM32 28l8 5.5-8 5.5v-3.6l4.4-1.9L32 31.6V28zM38 28l8 5.5-8 5.5v-3.6l4.4-1.9L38 31.6V28z" fill="#fff" opacity="0.7" />
    <path d="M26 34l8 5.5-8 5.5v-3.6l4.4-1.9L26 37.6V34zM32 34l8 5.5-8 5.5v-3.6l4.4-1.9L32 37.6V34z" fill="#fff" opacity="0.5" />
    <path d="M26 40l8 5.5-8 5.5V47.4l4.4-1.9L26 43.6V40z" fill="#fff" opacity="0.3" />
  </svg>
);

interface Props { winId?: string; winData?: Record<string, unknown> }
type Step = 'source' | 'install' | 'env' | 'domain' | 'done';
type TaskStatus = 'pending' | 'running' | 'done' | 'error';
interface Task { key: string; label: string; status: TaskStatus; }

export default function LaravelWizard(_props: Props) {
  const { openWindow } = useDesktopStore();
  const [step, setStep] = useState<Step>('source');
  const [sourceType, setSourceType] = useState<'github' | 'zip'>('github');
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('');
  const [targetPath, setTargetPath] = useState('');
  const [availableDomains, setAvailableDomains] = useState<string[]>([]);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [envContent, setEnvContent] = useState('');
  const [finalChecks, setFinalChecks] = useState<Record<string, boolean>>({});
  const logEnd = useRef<HTMLDivElement>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerPath, setPickerPath] = useState('/var/www');
  const [pickerItems, setPickerItems] = useState<{ name: string; is_dir: boolean }[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [installStarted, setInstallStarted] = useState(false);
  const [installDone, setInstallDone] = useState(false);
  const [installError, setInstallError] = useState(false);
  const installRef = useRef(false);
  const [serverIP, setServerIP] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('');
  const [selectedSubdomain, setSelectedSubdomain] = useState('');
  const [withSsl, setWithSsl] = useState(true);
  const [domainBusy, setDomainBusy] = useState(false);
  const [_domainDone, setDomainDone] = useState(false);
  const [customDomain, setCustomDomain] = useState('');
  const [useIPAccess, setUseIPAccess] = useState(false);
  const [existingProjects, setExistingProjects] = useState<{ name: string; path: string; has_env: boolean }[]>([]);
  const [showExisting, setShowExisting] = useState(false);

  useEffect(() => { logEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  const addLog = (msg: string) => setLogs(prev => [...prev, msg]);
  const updateTask = (key: string, status: TaskStatus) =>
    setTasks(prev => prev.map(t => t.key === key ? { ...t, status } : t));

  const loadDomains = useCallback(async () => {
    try { const r = await api.get<{ domains: string[] }>('/ssl/domains'); setAvailableDomains(r.domains); }
    catch { setAvailableDomains([]); }
  }, []);

  useEffect(() => { loadDomains(); }, [loadDomains]);

  const loadPicker = useCallback(async (dir: string) => {
    setPickerLoading(true);
    try {
      const r = await api.get<{ items: { name: string; is_dir: boolean }[] }>(`/files?path=${encodeURIComponent(dir)}`);
      setPickerItems(r.items.filter(i => i.is_dir));
    } catch { setPickerItems([]); }
    setPickerLoading(false);
  }, []);

  useEffect(() => { if (showPicker) loadPicker(pickerPath); }, [showPicker, pickerPath, loadPicker]);

  const loadExistingProjects = useCallback(async () => {
    try {
      const r = await api.get<{ projects: { name: string; path: string; has_env: boolean }[] }>('/laravel/projects');
      setExistingProjects(r.projects || []);
    } catch { setExistingProjects([]); }
  }, []);

  useEffect(() => { loadExistingProjects(); }, [loadExistingProjects]);

  useEffect(() => {
    if (step === 'domain' && !serverIP) {
      api.get<{ ip: string }>('/server/ip').then(r => setServerIP(r.ip)).catch(() => setServerIP('unknown'));
    }
  }, [step, serverIP]);

  const openPicker = () => { setPickerPath('/var/www'); setSelectedFolder(''); setShowPicker(true); };
  const handleCreateFolder = async () => {
    const name = creatingFolder.trim();
    if (!name) return;
    const fullPath = pickerPath.replace(/\/$/, '') + '/' + name;
    try { await api.post('/files/mkdir', { path: fullPath }); setCreatingFolder(''); setIsCreating(false); loadPicker(pickerPath); }
    catch (e) { addLog(`Failed to create folder: ${e instanceof Error ? e.message : 'Error'}`); }
  };
  const handlePickSelect = () => { if (selectedFolder) { setTargetPath(selectedFolder); setShowPicker(false); } };
  const handleOpenExisting = async (proj: { name: string; path: string; has_env: boolean }) => {
    setTargetPath(proj.path);
    setBusy(true);
    try {
      if (proj.has_env) {
        const r = await api.post<{ content: string }>('/laravel/env-read', { path: proj.path });
        setEnvContent(r.content);
      }
      setTasks([
        { key: 'source', label: 'Source cloned/extracted', status: 'done' },
        { key: 'php', label: 'PHP 8.3 + extensions installed', status: 'done' },
        { key: 'composer', label: 'Composer installed', status: 'done' },
        { key: 'composer_install', label: 'Composer dependencies installed', status: 'done' },
        { key: 'env', label: '.env copied from .env.example', status: 'done' },
        { key: 'production', label: 'APP_ENV set to production', status: 'done' },
        { key: 'app_key', label: 'App key generated', status: 'done' },
        { key: 'storage', label: 'Storage linked', status: 'done' },
        { key: 'symlink', label: 'Public symlink created', status: 'done' },
        { key: 'permissions', label: 'Storage & database permissions', status: 'done' },
        { key: 'assets', label: 'Frontend assets built (npm run build)', status: 'done' },
      ]);
      setInstallStarted(true);
      setInstallDone(true);
      setStep('env');
    } catch (e) {
      addLog(`Failed to load project: ${e instanceof Error ? e.message : 'Error'}`);
    }
    setBusy(false);
  };

  const handleExistingNext = () => {
    setStep('domain');
  };

  const handleExistingMigrate = async () => {
    setBusy(true);
    addLog('Running migrations...');
    try {
      await api.post('/laravel/migrate', { path: targetPath });
      addLog('Database migrated');
    } catch (e) {
      addLog(`Migration failed: ${e instanceof Error ? e.message : 'Error'}`);
    }
    addLog('Fixing storage permissions...');
    try { await api.post('/laravel/permissions', { path: targetPath }); } catch { /* ok */ }
    addLog('Permissions fixed');
    setBusy(false);
    setStep('domain');
  };
  const domainToPath = (d: string) => `/var/www/${d}`;
  const pathDisplay = targetPath || 'Select project folder...';
  const canNextSource = sourceType === 'github' ? repoUrl.trim() && targetPath : zipFile && targetPath;

  const handleNextSource = async () => {
    if (!canNextSource) return;
    setBusy(true);
    addLog(`Target: ${targetPath}`);
    try {
      if (sourceType === 'github') {
        addLog(`Cloning ${repoUrl}...`);
        await api.post('/laravel/clone', { repo: repoUrl.trim(), branch: branch.trim(), path: targetPath });
        addLog('Repository cloned successfully');
      } else if (zipFile) {
        addLog('Uploading ZIP...');
        const form = new FormData();
        form.append('file', zipFile);
        form.append('path', targetPath);
        await api.post('/laravel/upload-zip', form, true);
        addLog('Extracting...');
        await api.post('/laravel/extract', { path: targetPath });
        addLog('ZIP extracted successfully');
      }
      setTasks([
        { key: 'source', label: 'Source cloned/extracted', status: 'done' },
        { key: 'php', label: 'PHP 8.3 + extensions installed', status: 'pending' },
        { key: 'composer', label: 'Composer installed', status: 'pending' },
        { key: 'composer_install', label: 'Composer dependencies installed', status: 'pending' },
        { key: 'env', label: '.env copied from .env.example', status: 'pending' },
        { key: 'production', label: 'APP_ENV set to production', status: 'pending' },
        { key: 'app_key', label: 'App key generated', status: 'pending' },
        { key: 'storage', label: 'Storage linked', status: 'pending' },
        { key: 'symlink', label: 'Public symlink created', status: 'pending' },
        { key: 'permissions', label: 'Storage & database permissions', status: 'pending' },
        { key: 'assets', label: 'Frontend assets built (npm run build)', status: 'pending' },
      ]);
      setStep('install');
    } catch (e) {
      addLog(`Error: ${e instanceof Error ? e.message : 'Failed'}`);
    }
    setBusy(false);
  };

  const runInstall = async () => {
    if (installRef.current) return;
    installRef.current = true;
    setInstallStarted(true);
    setInstallError(false);
    setBusy(true);

    try {
      updateTask('php', 'running');
      addLog('Checking PHP...');
      const php = await api.post<{ installed: boolean; version: string }>('/laravel/ensure-php');
      addLog(`PHP ${php.version} ready with all extensions`);
      updateTask('php', 'done');

      updateTask('composer', 'running');
      addLog('Checking Composer...');
      const ck = await api.get<{ installed: boolean }>('/laravel/check-composer');
      if (!ck.installed) {
        addLog('Composer not found, installing...');
        await api.post('/laravel/install-composer');
        addLog('Composer installed');
      } else {
        addLog('Composer already installed');
      }
      updateTask('composer', 'done');

      updateTask('composer_install', 'running');
      addLog('Running composer install...');
      const ci = await api.post<{ output?: string }>('/laravel/composer-install', { path: targetPath });
      if (ci.output) addLog(ci.output.slice(0, 500));
      addLog('Dependencies installed');
      updateTask('composer_install', 'done');

      updateTask('env', 'running');
      addLog('Copying .env.example → .env...');
      const ce = await api.post<{ content: string }>('/laravel/copy-env', { path: targetPath });
      setEnvContent(ce.content);
      addLog('.env created');
      updateTask('env', 'done');

      updateTask('production', 'running');
      addLog('Setting APP_ENV=production...');
      let env = ce.content;
      env = env.replace(/^APP_ENV=.*/m, 'APP_ENV=production');
      if (!env.includes('APP_ENV=')) env += '\nAPP_ENV=production';
      env = env.replace(/^APP_DEBUG=.*/m, 'APP_DEBUG=false');
      env = env.replace(/^APP_LOG_LEVEL=.*/m, 'APP_LOG_LEVEL=notice');
      await apiPut('/laravel/save-env', { path: targetPath, content: env });
      setEnvContent(env);
      addLog('APP_ENV set to production');
      updateTask('production', 'done');

      updateTask('app_key', 'running');
      addLog('Generating app key...');
      await api.post('/laravel/app-key', { path: targetPath });
      addLog('App key generated');
      // Re-read .env so envContent includes the generated key
      const envAfterKey = await api.post<{ content: string }>('/laravel/copy-env', { path: targetPath });
      setEnvContent(envAfterKey.content);
      updateTask('app_key', 'done');

      updateTask('storage', 'running');
      addLog('Running storage:link...');
      await api.post('/laravel/storage-link', { path: targetPath });
      addLog('Storage linked');
      updateTask('storage', 'done');

      updateTask('symlink', 'running');
      addLog('Creating public symlink...');
      const sl = await api.post<{ link: string }>('/laravel/symlink', { path: targetPath });
      addLog(`Symlink created: ${sl.link}`);
      updateTask('symlink', 'done');

      updateTask('permissions', 'running');
      addLog('Fixing storage permissions...');
      await api.post('/laravel/permissions', { path: targetPath });
      addLog('Permissions fixed');
      updateTask('permissions', 'done');

      updateTask('assets', 'running');
      addLog('Building frontend assets...');
      try {
        const ab = await api.post<{ message: string }>('/laravel/assets-build', { path: targetPath });
        addLog(ab.message);
      } catch (e) {
        addLog(`Build warning: ${e instanceof Error ? e.message : 'Assets not built — you can build manually later'}`);
      }
      updateTask('assets', 'done');

      addLog('All tasks completed!');
      setInstallDone(true);
    } catch (e) {
      addLog(`Error: ${e instanceof Error ? e.message : 'Installation failed'}`);
      setInstallError(true);
    }
    setBusy(false);
    installRef.current = false;
  };

  const handleRetry = () => {
    setInstallError(false);
    setInstallDone(false);
    setLogs([]);
    setTasks(prev => prev.map(t => ({
      ...t,
      status: t.key === 'source' ? 'done' : 'pending'
    })));
    setTimeout(() => runInstall(), 0);
  };

  const handleSaveEnv = async () => {
    setBusy(true);
    try { await apiPut('/laravel/save-env', { path: targetPath, content: envContent }); addLog('.env saved'); }
    catch (e) { addLog(`Failed: ${e instanceof Error ? e.message : 'Error'}`); }
    setBusy(false);
  };

  const handleFinish = async () => {
    setBusy(true);
    addLog('Running migrations...');
    try {
      await api.post('/laravel/migrate', { path: targetPath });
      addLog('Database migrated');
    } catch (e) {
      addLog(`Migration failed: ${e instanceof Error ? e.message : 'Error'}`);
      setBusy(false);
      return;
    }
    addLog('Fixing storage permissions...');
    try { await api.post('/laravel/permissions', { path: targetPath }); } catch { /* ok */ }
    addLog('Permissions fixed');
    addLog('Running final checks...');
    try {
      const r = await api.post<{ checks: Record<string, boolean> }>('/laravel/final-check', { path: targetPath });
      setFinalChecks(r.checks);
      addLog('Final check complete');
    } catch (e) { addLog(`Failed: ${e instanceof Error ? e.message : 'Error'}`); }
    // Fetch server IP for domain step
    try {
      const ip = await api.get<{ ip: string }>('/server/ip');
      setServerIP(ip.ip);
    } catch { setServerIP('unknown'); }
    setBusy(false);
    setStep('domain');
  };

  const handleSetupDomain = async () => {
    setDomainBusy(true);
    addLog('Setting up domain...');
    try {
      const domain = customDomain.trim() || (selectedDomain ? `${selectedSubdomain || ''}${selectedSubdomain ? '.' : ''}${selectedDomain}` : '');
      const body: Record<string, unknown> = { path: targetPath };
      if (useIPAccess) {
        body.domain = '';
        body.subdomain = '';
      } else if (domain) {
        body.domain = domain.includes('.') ? domain.split('.').slice(-2).join('.') : selectedDomain;
        body.subdomain = domain.includes('.') ? domain.split('.')[0] : '';
      }
      body.with_ssl = withSsl && !useIPAccess;
      const r = await api.post<{ url: string; vhost: string }>('/laravel/vhost', body);
      let finalUrl = r.url;
      if (finalUrl.includes('0.0.0.0') && serverIP && serverIP !== 'unknown') {
        finalUrl = finalUrl.replace('0.0.0.0', serverIP);
      }
      setSiteUrl(finalUrl);
      addLog(`Vhost created: ${r.vhost}`);
      addLog(`Site URL: ${finalUrl}`);
      setDomainDone(true);
      setStep('done');
    } catch (e) {
      addLog(`Domain setup failed: ${e instanceof Error ? e.message : 'Error'}`);
    }
    setDomainBusy(false);
  };

  const handleSkipDomain = () => {
    if (serverIP && serverIP !== 'unknown') {
      setSiteUrl(`http://${serverIP}`);
    } else {
      setSiteUrl(targetPath ? `http://${targetPath.split('/').pop()}.local` : '');
    }
    setDomainDone(true);
    setStep('done');
  };

  const StepIndicator = () => (
    <div className="lw-steps">
      {(['source', 'install', 'env', 'domain', 'done'] as Step[]).map((s) => {
        const labels: Record<Step, string> = { source: 'Source', install: 'Install', env: 'Configure', domain: 'Domain', done: 'Done' };
        const order = ['source', 'install', 'env', 'domain', 'done'];
        const idx = order.indexOf(s);
        const cur = order.indexOf(step);
        return (
          <div key={s} className={`lw-step${cur === idx ? ' lw-step-cur' : ''}${cur > idx ? ' lw-step-done' : ''}`}>
            <div className="lw-step-num">{cur === idx ? <ArrowRight size={11} /> : cur > idx ? <Check size={11} /> : idx + 1}</div>
            <span className="lw-step-lbl">{labels[s]}</span>
            {idx < 4 && <div className="lw-step-line" />}
          </div>
        );
      })}
    </div>
  );

  const pageHeading = (title: string, desc: string) => (
    <div className="lw-heading">
      <div className="lw-heading-icon"><LaravelLogo /></div>
      <div>
        <div className="lw-heading-title">{title}</div>
        <div className="lw-heading-desc">{desc}</div>
      </div>
    </div>
  );

  const renderSource = () => (
    <div className="lw-page">
      {existingProjects.length > 0 && !showExisting && (
        <div className="lw-card-box" style={{ cursor: 'pointer' }} onClick={() => setShowExisting(true)}>
          <div className="lw-card-box-h"><FolderOpen size={16} /><span>Open Existing Project ({existingProjects.length})</span><ChevronRight size={14} style={{ marginLeft: 'auto' }} /></div>
        </div>
      )}
      {showExisting && (
        <div className="lw-card-box">
          <div className="lw-card-box-h">
            <FolderOpen size={16} /><span>Existing Projects</span>
            <button className="lw-btn lw-btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setShowExisting(false)}><X size={12} /> Close</button>
          </div>
          <div className="lw-existing-grid">
            {existingProjects.map(p => (
              <button key={p.name} className="lw-existing-btn" onClick={() => handleOpenExisting(p)}>
                <Folder size={14} />
                <span className="lw-existing-btn-name">{p.name}</span>
                {p.has_env && <Check size={11} style={{ color: 'var(--success)', marginLeft: 'auto' }} />}
              </button>
            ))}
          </div>
        </div>
      )}
      {pageHeading('Source', 'Choose where to get your Laravel project from')}
      <div className="lw-segmented">
        <button className={`lw-seg-btn${sourceType === 'github' ? ' active' : ''}`} onClick={() => setSourceType('github')}>
          <GitBranch size={15} /> GitHub Repository
        </button>
        <button className={`lw-seg-btn${sourceType === 'zip' ? ' active' : ''}`} onClick={() => setSourceType('zip')}>
          <Upload size={15} /> Upload ZIP
        </button>
      </div>
      <div className="lw-card-box">
        <div className="lw-card-box-h"><FolderOpen size={16} /><span>Project Location</span></div>
        <div className="lw-path-row">
          <div className="lw-path-display" onClick={openPicker}>
            <Folder size={15} style={{ flexShrink: 0, opacity: 0.5 }} />
            <span style={{ color: targetPath ? 'inherit' : 'var(--text-muted)' }}>{pathDisplay}</span>
          </div>
          <button className="lw-browse-btn" onClick={openPicker}><FolderOpen size={13} /> Browse</button>
        </div>
        {availableDomains.length > 0 && (
          <div className="lw-domain-chips">
            {availableDomains.map(d => (
              <button key={d} className={`lw-chip${targetPath === domainToPath(d) ? ' active' : ''}`} onClick={() => setTargetPath(domainToPath(d))}>
                <Globe size={11} /> {d}
              </button>
            ))}
          </div>
        )}
      </div>
      {sourceType === 'github' ? (
        <div className="lw-card-box">
          <div className="lw-card-box-h"><GitBranch size={16} /> Repository</div>
          <div className="lw-field">
            <input className="lw-input" type="text" value={repoUrl} onChange={e => setRepoUrl(e.target.value)} placeholder="https://github.com/user/repo" />
          </div>
          <div className="lw-field" style={{ marginTop: '-0.2rem' }}>
            <input className="lw-input" type="text" value={branch} onChange={e => setBranch(e.target.value)} placeholder="Branch (default: main)" />
          </div>
        </div>
      ) : (
        <div className="lw-card-box">
          <div className="lw-card-box-h"><Upload size={16} /> ZIP File</div>
          <div className="lw-upload-zone" onClick={() => document.getElementById('lw-zip')?.click()}>
            {zipFile ? (
              <div className="lw-upload-info"><FileText size={18} /><div><div className="lw-upload-name">{zipFile.name}</div><div className="lw-upload-size">{(zipFile.size / 1024 / 1024).toFixed(1)} MB</div></div></div>
            ) : (
              <div className="lw-upload-info"><Upload size={18} /><span>Click to select a ZIP file</span></div>
            )}
            <input id="lw-zip" type="file" accept=".zip" style={{ display: 'none' }} onChange={e => setZipFile(e.target.files?.[0] || null)} />
          </div>
        </div>
      )}
      {logs.length > 0 && <div className="lw-log"><div className="lw-log-inner">{logs.map((l, i) => <div key={i} className="lw-log-ln">{l}</div>)}<div ref={logEnd} /></div></div>}
      <div className="lw-actions">
        <span />
        <button className="lw-btn lw-btn-primary" onClick={handleNextSource} disabled={!canNextSource || busy}>
          {busy ? <Loader size={14} className="spin" /> : <ArrowRight size={14} />} Next
        </button>
      </div>
      {showPicker && (
        <div className="lw-picker-over" onClick={() => setShowPicker(false)}>
          <div className="lw-picker" onClick={e => e.stopPropagation()}>
            <div className="lw-picker-h">
              <FolderOpen size={15} />
              <span>Select Project Folder</span>
              <button className="lw-btn lw-btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setShowPicker(false)}><X size={13} /></button>
            </div>
            <div className="lw-picker-nav">
              <button className="lw-picker-nav-btn" onClick={() => setPickerPath('/var/www')} title="/var/www"><Home size={13} /></button>
              <span className="lw-picker-bread">{pickerPath}</span>
              <button className="lw-picker-nav-btn" onClick={() => loadPicker(pickerPath)} title="Refresh"><RefreshCw size={12} /></button>
            </div>
            <div className="lw-picker-list">
              {pickerLoading ? (
                <div className="lw-picker-load"><Loader size={14} className="spin" /> Loading...</div>
              ) : pickerItems.length === 0 ? (
                <div className="lw-picker-empty">No subdirectories</div>
              ) : (
                pickerItems.map(item => {
                  const itemPath = pickerPath.replace(/\/$/, '') + '/' + item.name;
                  const isSelected = selectedFolder === itemPath;
                  return (
                    <div key={item.name}
                      className={`lw-picker-item${isSelected ? ' active' : ''}${targetPath && targetPath === itemPath ? ' cur' : ''}`}
                      onClick={() => setSelectedFolder(itemPath)}
                      onDoubleClick={() => { setSelectedFolder(itemPath); setPickerPath(itemPath); }}>
                      <div className="lw-picker-item-left">
                        <Folder size={15} style={{ flexShrink: 0, color: 'var(--accent)' }} />
                        <span>{item.name}</span>
                      </div>
                      <div className="lw-picker-item-right">
                        <button className="lw-picker-item-btn" title="Select" onClick={e => { e.stopPropagation(); setSelectedFolder(itemPath); }}><Check size={12} /></button>
                        <button className="lw-picker-item-btn" title="Open" onClick={e => { e.stopPropagation(); setSelectedFolder(itemPath); setPickerPath(itemPath); }}><ChevronRight size={12} /></button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="lw-picker-foot">
              {!isCreating ? (
                <button className="lw-btn lw-btn-sm" onClick={() => setIsCreating(true)}><FolderPlus size={12} /> New Folder</button>
              ) : (
                <div className="lw-picker-create">
                  <input className="lw-input lw-input-sm" type="text" value={creatingFolder} onChange={e => setCreatingFolder(e.target.value)} placeholder="folder name" autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') { setIsCreating(false); setCreatingFolder(''); } }} />
                  <button className="lw-btn lw-btn-sm" onClick={handleCreateFolder} disabled={!creatingFolder.trim()}><Check size={12} /></button>
                  <button className="lw-btn lw-btn-sm" onClick={() => { setIsCreating(false); setCreatingFolder(''); }}><X size={12} /></button>
                </div>
              )}
              <span style={{ flex: 1 }} />
              <button className="lw-btn" onClick={() => setShowPicker(false)}>Cancel</button>
              <button className="lw-btn lw-btn-primary lw-pick-select-btn" onClick={handlePickSelect} disabled={!selectedFolder}>
                <Check size={13} /> Select This Folder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const taskIcon = (status: TaskStatus) => {
    if (status === 'done') return <Check size={13} style={{ color: 'var(--success)' }} />;
    if (status === 'running') return <Loader size={13} className="spin" style={{ color: 'var(--accent)' }} />;
    if (status === 'error') return <X size={13} style={{ color: 'var(--danger)' }} />;
    return <div className="lw-action-dot" />;
  };

  const renderInstall = () => (
    <div className="lw-page">
      {pageHeading('Install', 'Automatically installing dependencies & configuring project')}
      <div className="lw-action-list">
        {tasks.map(t => (
          <div key={t.key} className={`lw-action-item${t.status === 'done' ? ' ok' : ''}`}>
            <div className="lw-action-status">{taskIcon(t.status)}</div>
            <span className="lw-action-label">{t.label}</span>
            {t.status === 'running' && <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', flexShrink: 0 }}>running...</span>}
          </div>
        ))}
      </div>
      <div className="lw-log" style={{ flex: 1, maxHeight: 'none', minHeight: 80 }}>
        <div className="lw-log-inner">{logs.map((l, i) => <div key={i} className="lw-log-ln">{l}</div>)}<div ref={logEnd} /></div>
      </div>
      <div className="lw-actions">
        <button className="lw-btn" onClick={() => setStep('source')} disabled={busy}><ArrowLeft size={14} /> Back</button>
        {!installStarted && !installError ? (
          <button className="lw-btn lw-btn-primary" onClick={runInstall} disabled={busy}>
            <Download size={14} /> Start Install
          </button>
        ) : installDone ? (
          <button className="lw-btn lw-btn-primary" onClick={() => setStep('env')}>
            Next <ArrowRight size={14} />
          </button>
        ) : installError ? (
          <button className="lw-btn lw-btn-primary" onClick={handleRetry} disabled={busy}>
            <RefreshCw size={14} /> Retry
          </button>
        ) : null}
      </div>
    </div>
  );

  const renderEnv = () => (
    <div className="lw-page">
      {pageHeading('Configure', 'Review and edit your .env file before going live')}
      <div className="lw-env-section">
        <div className="lw-env-section-h">
          <FileText size={14} />
          <span>.env Editor</span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: '0.6rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <Check size={11} /> APP_ENV=production
          </span>
          <button className="lw-action-btn" onClick={handleSaveEnv} disabled={busy}>
            {busy ? <Loader size={12} className="spin" /> : <Check size={12} />} Save .env
          </button>
        </div>
        <textarea className="lw-env-editor" value={envContent} onChange={e => setEnvContent(e.target.value)} spellCheck={false} />
      </div>
      <div className="lw-log" style={{ maxHeight: 90 }}>
        <div className="lw-log-inner">{logs.map((l, i) => <div key={i} className="lw-log-ln">{l}</div>)}<div ref={logEnd} /></div>
      </div>
      <div className="lw-actions">
        <button className="lw-btn" onClick={() => installDone ? setStep('source') : setStep('install')}><ArrowLeft size={14} /> Back</button>
        {installDone ? (
          <>
            <button className="lw-btn" onClick={handleExistingNext} disabled={busy}>
              <ArrowRight size={14} /> Setup Domain
            </button>
            <button className="lw-btn lw-btn-primary" onClick={handleExistingMigrate} disabled={busy}>
              {busy ? <Loader size={14} className="spin" /> : <Database size={14} />} Migrate Again
            </button>
          </>
        ) : (
          <button className="lw-btn lw-btn-primary" onClick={handleFinish} disabled={busy}>
            {busy ? <Loader size={14} className="spin" /> : <Database size={14} />} Migrate & Finish
          </button>
        )}
      </div>
    </div>
  );

  const renderDomain = () => (
    <div className="lw-page">
      {pageHeading('Domain', 'Set up a domain or access via IP')}
      <div className="lw-card-box">
        <div className="lw-card-box-h"><Globe size={16} /><span>Domain / Subdomain</span></div>
        {availableDomains.length > 0 && !useIPAccess && (
          <div className="lw-domain-chips" style={{ marginBottom: '0.35rem' }}>
            {availableDomains.map(d => (
              <button key={d} className={`lw-chip${selectedDomain === d ? ' active' : ''}`} onClick={() => { setSelectedDomain(d); setCustomDomain(''); setUseIPAccess(false); }}>
                <Globe size={11} /> {d}
              </button>
            ))}
          </div>
        )}
        {!useIPAccess && (
          <div className="lw-field">
            <input className="lw-input" type="text" value={selectedSubdomain} onChange={e => setSelectedSubdomain(e.target.value)}
              placeholder="Subdomain (e.g. app) — optional" disabled={useIPAccess} />
          </div>
        )}
        {!useIPAccess && (
          <div className="lw-field">
            <input className="lw-input" type="text" value={customDomain} onChange={e => { setCustomDomain(e.target.value); setSelectedDomain(''); }}
              placeholder="Or enter custom domain (e.g. myapp.com)" disabled={useIPAccess} />
          </div>
        )}
        {(selectedDomain || customDomain.trim()) && serverIP && (
          <div className="lw-card-box" style={{ borderColor: 'var(--warning)' }}>
            <div className="lw-card-box-h"><Globe size={14} /><span>DNS Configuration</span></div>
            <div style={{ fontSize: '0.65rem', lineHeight: 1.6 }}>
              <div>Add this A record at your domain provider:</div>
              <div style={{ background: 'var(--bg-input)', padding: '0.4rem', borderRadius: 4, marginTop: 4, fontFamily: 'monospace' }}>
                {selectedDomain || customDomain.trim()} <span style={{ opacity: 0.5 }}>→ A →</span> {serverIP}
              </div>
              {withSsl && <div style={{ marginTop: 6, opacity: 0.7 }}>DNS must propagate before SSL can be issued.</div>}
            </div>
          </div>
        )}
        <div className="lw-field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', fontSize: '0.65rem' }}>
            <input type="checkbox" checked={useIPAccess} onChange={e => setUseIPAccess(e.target.checked)} />
            Access via IP (no domain)
          </label>
          {!useIPAccess && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', fontSize: '0.65rem' }}>
              <input type="checkbox" checked={withSsl} onChange={e => setWithSsl(e.target.checked)} />
              <Shield size={12} /> Auto SSL (Let's Encrypt)
            </label>
          )}
        </div>
        {useIPAccess && serverIP && (
          <div className="lw-info-box">
            <span>Your server IP: <strong>{serverIP}</strong></span>
          </div>
        )}
        {serverIP && (
          <div className="lw-info-box" style={{ fontSize: '0.6rem', opacity: 0.6 }}>
            Tip: Point your domain's A record to <strong>{serverIP}</strong>
          </div>
        )}
      </div>
      <div className="lw-log" style={{ maxHeight: 90 }}>
        <div className="lw-log-inner">{logs.map((l, i) => <div key={i} className="lw-log-ln">{l}</div>)}<div ref={logEnd} /></div>
      </div>
      <div className="lw-actions">
        <button className="lw-btn" onClick={() => setStep('env')}><ArrowLeft size={14} /> Back</button>
        <button className="lw-btn lw-btn-primary" onClick={handleSetupDomain} disabled={domainBusy || (!selectedDomain && !customDomain.trim() && !useIPAccess)}>
          {domainBusy ? <Loader size={14} className="spin" /> : <Globe size={14} />} {useIPAccess ? 'Setup' : 'Setup Domain'}
        </button>
        {!useIPAccess && (
          <button className="lw-btn" onClick={handleSkipDomain} disabled={domainBusy}>
            Skip
          </button>
        )}
      </div>
    </div>
  );

  const renderDone = () => {
    const ok = Object.values(finalChecks).every(Boolean);
    return (
      <div className="lw-page" style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <LaravelLogo />
        <div className={`lw-done-icon${ok ? ' ok' : ' warn'}`} style={{ marginTop: 12 }}>
          {ok ? <Check size={28} /> : <X size={28} />}
        </div>
        <div className="lw-done-title">{ok ? 'Project is Ready!' : 'Some Checks Failed'}</div>
        <div className="lw-done-path">{targetPath}</div>
        <div className="lw-done-grid">
          {Object.entries(finalChecks).map(([key, val]) => (
            <div key={key} className={`lw-done-item${val ? ' ok' : ' fail'}`}>
              {val ? <Check size={12} /> : <X size={12} />}
              {key.replace(/_/g, ' ')}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          {siteUrl && (
            <a href={siteUrl} target="_blank" rel="noopener noreferrer" className="lw-btn lw-btn-primary" style={{ textDecoration: 'none' }}>
              <ExternalLink size={14} /> Open Site
            </a>
          )}
          <button className="lw-btn" onClick={() => { openWindow('laravel-management-' + Date.now(), 'Laravel Management'); }}>
            <Wrench size={14} /> Laravel Management
          </button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: 8 }}>
          <button className="lw-btn" onClick={() => setStep('domain')}>
            <ArrowLeft size={14} /> Back to Domain
          </button>
        </div>
        <div className="lw-log" style={{ maxWidth: 400, marginTop: 12 }}>
          <div className="lw-log-inner">{logs.map((l, i) => <div key={i} className="lw-log-ln">{l}</div>)}<div ref={logEnd} /></div>
        </div>
      </div>
    );
  };

  return (
    <div className="lw-root">
      <StepIndicator />
      <div className="lw-body">
        {step === 'source' && renderSource()}
        {step === 'install' && renderInstall()}
        {step === 'env' && renderEnv()}
        {step === 'domain' && renderDomain()}
        {step === 'done' && renderDone()}
      </div>
    </div>
  );
}

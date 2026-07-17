import { useState, useRef, useEffect } from 'react';
import { api } from '../../api';
import { useDesktopStore } from '../../store/desktopStore';
import { Package, File, CheckCircle, AlertCircle, Loader2, ArrowRight, ArrowLeft, Download, Info, FolderOpen } from 'lucide-react';

interface DebInfo {
  package: string;
  version: string;
  architecture: string;
  description: string;
  maintainer: string;
  homepage: string;
  installed_size: string;
  filename: string;
  fullpath: string;
}

interface TaskStatus {
  status: string;
  output: string;
}

const STEP_WELCOME = 0;
const STEP_INFO = 1;
const STEP_INSTALL = 2;
const STEP_DONE = 3;

export default function DebInstaller(props: { winId?: string; winData?: Record<string, unknown> }) {
  const { openWindow, closeWindow } = useDesktopStore();
  const [step, setStep] = useState(STEP_WELCOME);
  const [debPath, setDebPath] = useState((props.winData?.path as string) || '');
  const [debInfo, setDebInfo] = useState<DebInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [installOutput, setInstallOutput] = useState('');
  const [installStatus, setInstallStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const pollRef = useRef<ReturnType<typeof setInterval>>(null);
  const fmPickId = useRef<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.path) {
        setDebPath(detail.path);
        if (fmPickId.current) {
          closeWindow(fmPickId.current);
          fmPickId.current = null;
        }
      }
    };
    document.addEventListener('fm-file-picked', handler);
    return () => document.removeEventListener('fm-file-picked', handler);
  }, [closeWindow]);

  const browseFile = () => {
    const id = 'fm-' + Date.now();
    fmPickId.current = id;
    openWindow(id, 'Select .deb Package', { pickMode: true });
  };

  const getInfo = async () => {
    if (!debPath.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.post<DebInfo>('/deb/info', { path: debPath });
      setDebInfo(data);
      setStep(STEP_INFO);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to read package info');
    }
    setLoading(false);
  };

  const startInstall = async () => {
    if (!debInfo) return;
    setStep(STEP_INSTALL);
    setInstallStatus('running');
    setInstallOutput('Starting installation...\n');
    try {
      const data = await api.post<{ task_id: string; status: string }>('/deb/install', { path: debInfo.fullpath });
      pollRef.current = setInterval(async () => {
        try {
          const status = await api.get<TaskStatus>('/deb/status/' + data.task_id);
          setInstallOutput(status.output);
          if (status.status === 'done') {
            setInstallStatus('done');
            clearInterval(pollRef.current!);
          } else if (status.status === 'error') {
            setInstallStatus('error');
            clearInterval(pollRef.current!);
          }
        } catch (e) {
          setInstallOutput(prev => prev + '\n⚠ Polling error: ' + (e instanceof Error ? e.message : 'Connection lost'));
          clearInterval(pollRef.current!);
          setInstallStatus('error');
        }
      }, 1500);
    } catch (e) {
      setInstallStatus('error');
      setInstallOutput('Failed to start installation:\n' + (e instanceof Error ? e.message : 'Unknown error'));
    }
  };

  const finish = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (props.winId) closeWindow(props.winId);
  };

  const fmtSize = (kb: string) => {
    const n = parseInt(kb) || 0;
    if (n < 1024) return n + ' KB';
    return (n / 1024).toFixed(1) + ' MB';
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#f0f0f0', color: '#1c1c1e', fontFamily: 'Segoe UI, system-ui, sans-serif' }}>
      {/* Title Bar */}
      <div style={{ background: 'linear-gradient(135deg, #0078d4, #106ebe)', color: '#fff', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Package size={22} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>DEB Installer</span>
      </div>

      {/* Steps indicator */}
      <div style={{ display: 'flex', padding: '16px 20px 0', gap: 4 }}>
        {['Welcome', 'Package Info', 'Install', 'Done'].map((label, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700,
              background: i === step ? '#0078d4' : i < step ? '#107c10' : '#d1d1d6',
              color: i <= step ? '#fff' : '#8e8e93',
            }}>{i < step ? '✓' : i + 1}</div>
            <span style={{ fontSize: 11, color: i === step ? '#0078d4' : '#8e8e93', fontWeight: i === step ? 600 : 400 }}>{label}</span>
            {i < 3 && <div style={{ flex: 1, height: 1, background: i < step ? '#107c10' : '#d1d1d6', margin: '0 4px' }} />}
          </div>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: 20, overflow: 'auto' }}>
        {step === STEP_WELCOME && (
          <div style={{ textAlign: 'center', paddingTop: 30 }}>
            <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>DEB Installer</div>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 24 }}>Install .deb packages on your system</div>
            <div style={{ background: '#fff', borderRadius: 8, padding: 20, textAlign: 'left', border: '1px solid #e0e0e0', maxWidth: 500, margin: '0 auto' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#333', display: 'block', marginBottom: 6 }}>Package file path</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={{ flex: 1, padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 13, outline: 'none' }}
                  placeholder="/path/to/package.deb"
                  value={debPath}
                  onChange={(e) => setDebPath(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && getInfo()}
                />
                <button onClick={browseFile}
                  style={{ padding: '8px 12px', borderRadius: 4, border: '1px solid #ccc', background: '#fff', color: '#333', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                  <FolderOpen size={14} /> Browse
                </button>
              </div>
              {debPath && (
                <div style={{ marginTop: 8, fontSize: 11, color: '#666', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Info size={12} /> You can also right-click a .deb file in File Manager and select "Install with DEB Installer"
                </div>
              )}
              {error && <div style={{ marginTop: 8, color: '#d32f2f', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><AlertCircle size={14} /> {error}</div>}
            </div>
          </div>
        )}

        {step === STEP_INFO && debInfo && (
          <div style={{ maxWidth: 520, margin: '0 auto', paddingTop: 10 }}>
            <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e0e0e0', overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', background: '#fafafa', borderBottom: '1px solid #e0e0e0', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <File size={16} /> {debInfo.filename}
              </div>
              <div style={{ padding: 16 }}>
                {[
                  ['Package', debInfo.package],
                  ['Version', debInfo.version],
                  ['Architecture', debInfo.architecture],
                  ['Maintainer', debInfo.maintainer],
                  ['Homepage', debInfo.homepage],
                  ['Installed Size', fmtSize(debInfo.installed_size)],
                ].map(([label, value]) => (
                  value ? (
                    <div key={label} style={{ display: 'flex', padding: '6px 0', borderBottom: '1px solid #f0f0f0', fontSize: 12 }}>
                      <span style={{ width: 120, color: '#666', flexShrink: 0 }}>{label}</span>
                      <span style={{ color: '#1c1c1e', wordBreak: 'break-all' }}>{value}</span>
                    </div>
                  ) : null
                ))}
                {debInfo.description && (
                  <div style={{ padding: '6px 0', fontSize: 12 }}>
                    <span style={{ display: 'block', color: '#666', marginBottom: 4 }}>Description</span>
                    <span style={{ color: '#1c1c1e', lineHeight: 1.5 }}>{debInfo.description}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {step === STEP_INSTALL && (
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e0e0e0', overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', background: '#fafafa', borderBottom: '1px solid #e0e0e0', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                {installStatus === 'running' ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> :
                 installStatus === 'done' ? <CheckCircle size={16} style={{ color: '#107c10' }} /> :
                 installStatus === 'error' ? <AlertCircle size={16} style={{ color: '#d32f2f' }} /> : null}
                {installStatus === 'running' ? 'Installing...' :
                 installStatus === 'done' ? 'Installation Complete' :
                 installStatus === 'error' ? 'Installation Failed' : ''}
              </div>
              <pre style={{ margin: 0, padding: 16, fontSize: 11, fontFamily: 'Consolas, monospace', color: '#fff', background: '#1e1e1e', minHeight: 200, maxHeight: 300, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {installOutput || (installStatus === 'running' ? 'Starting installation...\n' : '')}
                {installStatus === 'running' && <span style={{ animation: 'blink 1s step-end infinite' }}>_</span>}
              </pre>
            </div>
          </div>
        )}

        {step === STEP_DONE && (
          <div style={{ textAlign: 'center', paddingTop: 40 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: installStatus === 'error' ? '#fce4ec' : '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              {installStatus === 'error'
                ? <AlertCircle size={32} style={{ color: '#d32f2f' }} />
                : <CheckCircle size={32} style={{ color: '#107c10' }} />}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
              {installStatus === 'error' ? 'Installation Failed' : 'Installation Complete'}
            </div>
            <div style={{ fontSize: 13, color: '#666' }}>
              {installStatus === 'error'
                ? 'The package could not be installed. Check the output for details.'
                : `${debInfo?.package} ${debInfo?.version} has been successfully installed.`}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid #e0e0e0', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#fff' }}>
        {step === STEP_WELCOME && (
          <>
            <button disabled style={{ padding: '6px 16px', borderRadius: 4, border: '1px solid #ccc', background: '#f0f0f0', color: '#999', fontSize: 12, cursor: 'not-allowed' }}>
              <ArrowLeft size={14} style={{ marginRight: 4 }} /> Back
            </button>
            <button onClick={getInfo} disabled={!debPath.trim() || loading}
              style={{ padding: '6px 16px', borderRadius: 4, border: 'none', background: debPath.trim() ? '#0078d4' : '#ccc', color: '#fff', fontSize: 12, cursor: debPath.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 4 }}>
              {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : null} Next <ArrowRight size={14} />
            </button>
          </>
        )}
        {step === STEP_INFO && (
          <>
            <button onClick={() => setStep(STEP_WELCOME)}
              style={{ padding: '6px 16px', borderRadius: 4, border: '1px solid #ccc', background: '#fff', color: '#333', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <ArrowLeft size={14} /> Back
            </button>
            <button onClick={startInstall}
              style={{ padding: '6px 16px', borderRadius: 4, border: 'none', background: '#0078d4', color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              Install <Download size={14} />
            </button>
          </>
        )}
        {step === STEP_INSTALL && installStatus === 'done' && (
          <button onClick={() => setStep(STEP_DONE)}
            style={{ padding: '6px 16px', borderRadius: 4, border: 'none', background: '#0078d4', color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            Next <ArrowRight size={14} />
          </button>
        )}
        {step === STEP_INSTALL && installStatus === 'error' && (
          <button onClick={() => setStep(STEP_DONE)}
            style={{ padding: '6px 16px', borderRadius: 4, border: 'none', background: '#d32f2f', color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            View Result <ArrowRight size={14} />
          </button>
        )}
        {(step === STEP_DONE) && (
          <button onClick={finish}
            style={{ padding: '6px 24px', borderRadius: 4, border: 'none', background: '#0078d4', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
            Done
          </button>
        )}
        {step === STEP_INSTALL && installStatus === 'running' && (
          <button disabled
            style={{ padding: '6px 16px', borderRadius: 4, border: '1px solid #ccc', background: '#f0f0f0', color: '#999', fontSize: 12, cursor: 'not-allowed', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Installing...
          </button>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes blink { 50% { opacity: 0; } }
      `}</style>
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import { api, ApiError } from '../../api';
import { useDesktopStore } from '../../store/desktopStore';
import { useAuthStore } from '../../store/authStore';
import { GitBranch, Download, Folder, FolderOpen, ChevronRight, ArrowUpCircle, X, Info, CheckCircle, AlertCircle, Clock, ExternalLink } from 'lucide-react';
import type { FileItem } from '../../types';

interface Props {
  winId?: string;
  winData?: Record<string, unknown>;
}

export default function GitCloner({ winId, winData: _winData }: Props) {
  const { openWindow, closeWindow } = useDesktopStore();
  const { user } = useAuthStore();
  const homeDir = user?.home || (user?.username === 'root' ? '/root' : '/home/' + (user?.username || 'root')) || '/root';

  const [url, setUrl] = useState('');
  const [destPath, setDestPath] = useState(homeDir);
  const [cloneTaskId, setCloneTaskId] = useState<string | null>(null);
  const [cloneStatus, setCloneStatus] = useState<string>('');
  const [cloneOutput, setCloneOutput] = useState('');
  const [cloning, setCloning] = useState(false);
  const [error, setError] = useState('');
  const [aboutOpen, setAboutOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  // Folder browser state
  const [browseOpen, setBrowseOpen] = useState(false);
  const [browsePath, setBrowsePath] = useState(destPath);
  const [browseItems, setBrowseItems] = useState<FileItem[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState('');

  const loadBrowseDir = useCallback(async (p: string) => {
    setBrowseLoading(true);
    setBrowseError('');
    try {
      const data = await api.get<{ path: string; items: FileItem[] }>('/files?path=' + encodeURIComponent(p));
      setBrowsePath(data.path || p);
      setBrowseItems(data.items.filter(i => i.is_dir));
    } catch (e) {
      setBrowseError(e instanceof Error ? e.message : 'Failed to load');
    }
    setBrowseLoading(false);
  }, []);

  useEffect(() => {
    if (browseOpen) loadBrowseDir(destPath);
  }, [browseOpen, loadBrowseDir]);

  // Poll clone status
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (cloneTaskId && cloning) {
      pollRef.current = setInterval(async () => {
        try {
          const data = await api.get<{ status: string; output: string }>('/git/clone/status/' + cloneTaskId);
          setCloneStatus(data.status);
          setCloneOutput(data.output);
          if (data.status === 'done' || data.status === 'error') {
            setCloning(false);
            if (pollRef.current) clearInterval(pollRef.current);
          }
        } catch {
          setCloning(false);
          setError('Failed to check clone status');
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }, 1000);
      return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }
  }, [cloneTaskId, cloning]);

  const handleClone = async () => {
    if (!url.trim() || cloning) return;
    setError('');
    setCloneOutput('');
    setCloneStatus('running');
    setCloning(true);
    try {
      const data = await api.post<{ task_id: string; status: string }>('/git/clone', { url: url.trim(), dir: destPath });
      setCloneTaskId(data.task_id);
    } catch (e) {
      setCloning(false);
      setError(e instanceof ApiError ? e.message : 'Clone failed to start');
    }
  };

  const openDestInFm = () => {
    const id = 'fm-' + Date.now();
    openWindow(id, 'File Manager', { path: destPath });
  };

  const selectBrowseDir = () => {
    setDestPath(browsePath);
    setBrowseOpen(false);
  };

  const handleBrowseDoubleClick = (name: string) => {
    const newPath = browsePath.replace(/\/$/, '') + '/' + name;
    loadBrowseDir(newPath);
  };

  return (
    <div className="gc">
      {/* Toolbar */}
      <div className="gc-toolbar">
        <div className="gc-toolbar-left">
          <span className="gc-toolbar-title">
            <GitBranch size={15} style={{ color:'#f97316' }} /> GitCloner
          </span>
          <div className="gc-toolbar-menu" onMouseLeave={() => setOpenMenu(null)}>
            <button className={`gc-menu-btn${openMenu === 'File' ? ' open' : ''}`}
              onClick={() => setOpenMenu(openMenu === 'File' ? null : 'File')}
              onMouseEnter={() => openMenu && setOpenMenu('File')}>
              File
            </button>
            {openMenu === 'File' && (
              <div className="gc-menu-drop">
                <button className="gc-menu-item" onClick={() => { setUrl(''); setCloneOutput(''); setError(''); setCloneStatus(''); setOpenMenu(null); }}>
                  <X size={14} /> Clear
                </button>
                <div className="gc-menu-sep" />
                <button className="gc-menu-item" onClick={() => { if (winId) closeWindow(winId); setOpenMenu(null); }}>
                  <X size={14} /> Close
                </button>
              </div>
            )}
          </div>
          <div className="gc-toolbar-menu" onMouseLeave={() => setOpenMenu(null)}>
            <button className={`gc-menu-btn${openMenu === 'About' ? ' open' : ''}`}
              onClick={() => setOpenMenu(openMenu === 'About' ? null : 'About')}
              onMouseEnter={() => openMenu === 'File' && setOpenMenu('About')}>
              About
            </button>
            {openMenu === 'About' && (
              <div className="gc-menu-drop" style={{ left:'auto', right:0 }}>
                <button className="gc-menu-item" onClick={() => { setOpenMenu(null); setAboutOpen(true); }}>
                  <Info size={14} /> About GitCloner
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="gc-body">
        {/* URL Input */}
        <div className="gc-section">
          <label className="gc-label">Repository URL</label>
          <input className="gc-input" type="text" value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/user/repo.git or git@github.com:user/repo.git"
            onKeyDown={(e) => e.key === 'Enter' && handleClone()} />
        </div>

        {/* Destination Path */}
        <div className="gc-section">
          <label className="gc-label">Destination Folder</label>
          <div className="gc-path-row">
            <input className="gc-input gc-path-input" type="text" value={destPath}
              onChange={(e) => setDestPath(e.target.value)}
              placeholder="/home/user" />
            <button className="gc-btn gc-btn-outline" onClick={() => setBrowseOpen(true)}
              title="Browse folders">
              <FolderOpen size={15} /> Browse
            </button>
            <button className="gc-btn gc-btn-outline" onClick={openDestInFm}
              title="Open in File Manager">
              <ExternalLink size={15} />
            </button>
          </div>
        </div>

        {/* Clone Button */}
        <div className="gc-section gc-action-row">
          <button className={`gc-btn gc-btn-primary${cloning ? ' disabled' : ''}`}
            onClick={handleClone} disabled={cloning || !url.trim()}>
            {cloning ? (
              <><Clock size={16} className="gc-spin" /> Cloning...</>
            ) : (
              <><Download size={16} /> Clone</>
            )}
          </button>
        </div>

        {/* Error */}
        {error && <div className="gc-error">{error}</div>}

        {/* Status Output */}
        {cloneOutput && (
          <div className="gc-section">
            <div className="gc-status-header">
              {cloneStatus === 'done' ? <CheckCircle size={14} className="gc-ico-done" />
                : cloneStatus === 'error' ? <AlertCircle size={14} className="gc-ico-error" />
                : <Clock size={14} className="gc-ico-running" />}
              <span className={`gc-status-label gc-status-${cloneStatus}`}>
                {cloneStatus === 'done' ? 'Clone completed'
                  : cloneStatus === 'error' ? 'Clone failed'
                  : 'Cloning in progress...'}
              </span>
            </div>
            <pre className="gc-output">{cloneOutput}</pre>
          </div>
        )}

        {/* Info hint */}
        <div className="gc-section gc-hint">
          Supports both HTTPS and SSH Git URLs. The repository will be cloned into a subfolder named after the repo.
        </div>
      </div>

      {/* Folder Browser Modal */}
      {browseOpen && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setBrowseOpen(false); }}>
          <div className="modal-box gc-browse-modal">
            <div className="modal-title">
              <FolderOpen size={16} /> Select Destination Folder
            </div>

            {/* Path bar */}
            <div className="gc-browse-pathbar">
              <button className="gc-btn-icon" onClick={() => loadBrowseDir('/')} title="Root"><ArrowUpCircle size={15} /></button>
              <button className="gc-btn-icon" onClick={() => {
                const parts = browsePath.replace(/\/$/, '').split('/');
                parts.pop();
                loadBrowseDir(parts.join('/') || '/');
              }} disabled={browsePath === '/'} title="Go up"><ArrowUpCircle size={15} /></button>
              <span className="gc-browse-path">{browsePath}</span>
              <button className="gc-btn gc-btn-primary gc-btn-sm" onClick={selectBrowseDir}
                disabled={browseLoading}>Select This Folder</button>
            </div>

            {/* Folder list */}
            <div className="gc-browse-list">
              {browseLoading ? (
                <div className="gc-browse-status">Loading...</div>
              ) : browseError ? (
                <div className="gc-browse-status gc-browse-error">{browseError}</div>
              ) : browseItems.length === 0 ? (
                <div className="gc-browse-status">No subfolders</div>
              ) : (
                browseItems.map((item) => (
                  <button key={item.name} className="gc-browse-item"
                    onDoubleClick={() => handleBrowseDoubleClick(item.name)}
                    onClick={() => handleBrowseDoubleClick(item.name)}>
                    <Folder size={16} className="gc-browse-item-icon" />
                    <span className="gc-browse-item-name">{item.name}</span>
                    <ChevronRight size={14} className="gc-browse-item-arrow" />
                  </button>
                ))
              )}
            </div>

            <div className="modal-actions">
              <button className="modal-btn modal-btn-cancel" onClick={() => setBrowseOpen(false)}>Cancel</button>
              <button className="modal-btn modal-btn-primary" onClick={selectBrowseDir}
                disabled={browseLoading}>Select</button>
            </div>
          </div>
        </div>
      )}

      {/* About modal */}
      {aboutOpen && (
        <div className="modal-overlay" onClick={() => setAboutOpen(false)}>
          <div className="modal-box" style={{ width: 320 }}>
            <div className="modal-title" style={{ display:'flex', alignItems:'center', gap:'0.3rem' }}>
              <GitBranch size={16} style={{ color:'#f97316' }} /> GitCloner
            </div>
            <div style={{ fontSize:'0.75rem', color:'var(--text-secondary)', margin:'0.5rem 0', lineHeight:1.5 }}>
              Git repository cloner for CloudBanana DE.<br />
              Clone any public Git repository via HTTPS or SSH.<br /><br />
              Press <strong>Enter</strong> in the URL field to start cloning.
            </div>
            <div className="modal-actions">
              <button className="modal-btn modal-btn-primary" onClick={() => setAboutOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
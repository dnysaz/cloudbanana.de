import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../api';
import { Save, CheckCircle, XCircle, RefreshCw, FileText, Edit3, Plus, AlertTriangle, X, FolderClosed, FolderOpen } from 'lucide-react';

interface Props {
  winId?: string;
  winData?: Record<string, unknown>;
}

interface PhpFile {
  name: string;
  path: string;
  type: 'main' | 'extra';
}

interface PhpSapi {
  name: string;
  files: PhpFile[];
}

interface PhpVersion {
  version: string;
  binary: string;
  sapis: PhpSapi[];
}

export default function PhpEditor(_props: Props) {
  const [versions, setVersions] = useState<PhpVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState('');
  const [selectedSapi, setSelectedSapi] = useState('');
  const [selectedFile, setSelectedFile] = useState<PhpFile | null>(null);
  const [content, setContent] = useState('');
  const [origContent, setOrigContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'ok' | 'error' | ''; msg: string }>({ type: '', msg: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const textRef = useRef<HTMLTextAreaElement>(null);

  const loadVersions = useCallback(async () => {
    try {
      const r = await api.get<{ versions: PhpVersion[] }>('/php/versions');
      setVersions(r.versions);
      if (r.versions.length > 0 && !selectedVersion) {
        setSelectedVersion(r.versions[0].version);
        if (r.versions[0].sapis.length > 0) {
          setSelectedSapi(r.versions[0].sapis[0].name);
        }
      }
    } catch {}
  }, [selectedVersion]);

  useEffect(() => { loadVersions(); }, [loadVersions]);

  const currentVersion = versions.find(v => v.version === selectedVersion);
  const currentSapi = currentVersion?.sapis.find(s => s.name === selectedSapi);
  const files = currentSapi?.files || [];

  const selectFile = async (file: PhpFile) => {
    setSelectedFile(file);
    setLoading(true);
    setStatus({ type: '', msg: '' });
    setIsEditing(false);
    try {
      const r = await api.post<{ content: string }>('/files/read', { path: file.path });
      setContent(r.content);
      setOrigContent(r.content);
    } catch (e) {
      setStatus({ type: 'error', msg: e instanceof Error ? e.message : 'Failed to read' });
    }
    setLoading(false);
  };

  const handleSaveClick = () => {
    setShowSaveModal(true);
  };

  const confirmSave = async () => {
    if (!selectedFile) return;
    setSaving(true);
    setStatus({ type: '', msg: '' });
    try {
      await api.post('/files/write', { path: selectedFile.path, content });
      setOrigContent(content);
      setStatus({ type: 'ok', msg: 'Saved successfully' });
      setShowSaveModal(false);
      setTimeout(() => setStatus({ type: '', msg: '' }), 3000);
    } catch (e) {
      setStatus({ type: 'error', msg: e instanceof Error ? e.message : 'Failed to save' });
    }
    setSaving(false);
  };

  const handleCreateFile = async () => {
    if (!newFileName.trim() || !selectedVersion || !selectedSapi) return;
    const basePath = `/etc/php/${selectedVersion}/${selectedSapi}/conf.d`;
    const filePath = basePath + '/' + newFileName.trim();
    try {
      await api.post('/files/write', { path: filePath, content: '; PHP ini file\n' });
      setShowNewModal(false);
      setNewFileName('');
      loadVersions();
    } catch (e) {
      setStatus({ type: 'error', msg: e instanceof Error ? e.message : 'Failed to create file' });
    }
  };

  const hasChanges = content !== origContent;

  return (
    <div className="ne-root">
      <div className="ne-sidebar">
        <div className="ne-sidebar-title">PHP Configs</div>
        <button className="ne-refresh-btn" onClick={loadVersions} title="Refresh">
          <RefreshCw size={13} /> Refresh
        </button>

        {/* Version selector */}
        <div className="pe-version-section">
          <label className="pe-select-label">PHP Version</label>
          <select
            className="pe-select"
            value={selectedVersion}
            onChange={(e) => {
              setSelectedVersion(e.target.value);
              setSelectedSapi('');
              setSelectedFile(null);
              setContent('');
              setOrigContent('');
              setIsEditing(false);
              const ver = versions.find(v => v.version === e.target.value);
              if (ver && ver.sapis.length > 0) {
                setSelectedSapi(ver.sapis[0].name);
              }
            }}
          >
            {versions.map(v => (
              <option key={v.version} value={v.version}>
                PHP {v.version}{v.binary ? '' : ' (not installed)'}
              </option>
            ))}
          </select>
        </div>

        {/* SAPI list */}
        {currentVersion && currentVersion.sapis.length > 0 && (
          <div className="pe-sapi-list">
            <div className="ne-sidebar-title" style={{ marginTop: '0.3rem' }}>SAPI</div>
            {currentVersion.sapis.map(sapi => (
              <div key={sapi.name}>
                <button
                  className={`ne-sidebar-header${selectedSapi === sapi.name ? ' active' : ''}`}
                  onClick={() => {
                    setSelectedSapi(sapi.name);
                    setSelectedFile(null);
                    setContent('');
                    setOrigContent('');
                    setIsEditing(false);
                  }}
                  style={{ fontSize: '0.7rem', fontWeight: 500 }}
                >
                  {selectedSapi === sapi.name ? <FolderOpen size={12} /> : <FolderClosed size={12} />}
                  <span>{sapi.name}</span>
                  <span className="ne-sidebar-count">{sapi.files.length}</span>
                </button>
                {selectedSapi === sapi.name && sapi.files.map(f => (
                  <button
                    key={f.path}
                    className={`ne-sidebar-item${selectedFile?.path === f.path ? ' active' : ''}`}
                    onClick={() => selectFile(f)}
                  >
                    <FileText size={11} />
                    <span>{f.name}</span>
                    {f.type === 'main' && <span className="pe-file-badge">main</span>}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}

        {currentSapi && currentSapi.files.some(f => f.type === 'extra') && (
          <button
            className="ne-refresh-btn"
            onClick={() => setShowNewModal(true)}
            style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '0.3rem', paddingTop: '0.5rem' }}
          >
            <Plus size={12} /> New ini file
          </button>
        )}
      </div>

      <div className="ne-main">
        {!selectedFile ? (
          <div className="ne-empty">
            <FileText size={48} />
            <p>Select a PHP version, SAPI, and configuration file</p>
            {selectedVersion && selectedSapi && files.length === 0 && (
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                No configuration files found for PHP {selectedVersion} ({selectedSapi})
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="ne-toolbar">
              <div className="ne-toolbar-left">
                <span className="ne-file-path">{selectedFile.path}</span>
                {hasChanges && <span className="ne-unsaved">Unsaved changes</span>}
              </div>
              <div className="ne-toolbar-right">
                {!isEditing ? (
                  <button className="ne-tb-btn ne-tb-edit" onClick={() => setIsEditing(true)} title="Edit file">
                    <Edit3 size={14} /> Edit
                  </button>
                ) : (
                  <>
                    <button
                      className="ne-tb-btn ne-tb-save"
                      onClick={handleSaveClick}
                      disabled={saving || !hasChanges}
                    >
                      <Save size={14} /> {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button className="ne-tb-btn ne-tb-cancel" onClick={() => { setIsEditing(false); setContent(origContent); }}>
                      <X size={14} /> Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
            {status.msg && (
              <div className={`ne-status ${status.type}`}>
                {status.type === 'ok' ? <CheckCircle size={13} /> : <XCircle size={13} />} {status.msg}
              </div>
            )}
            {loading ? (
              <div className="ne-loading">Loading...</div>
            ) : (
              <textarea
                ref={textRef}
                className="ne-editor"
                value={content}
                onChange={e => setContent(e.target.value)}
                spellCheck={false}
                readOnly={!isEditing}
              />
            )}
          </>
        )}
      </div>

      {/* Save Confirmation Modal */}
      {showSaveModal && (
        <div className="ne-modal-overlay" onClick={() => setShowSaveModal(false)}>
          <div className="ne-modal" onClick={e => e.stopPropagation()}>
            <div className="ne-modal-header">
              <h3><Save size={16} /> Confirm Save</h3>
              <button className="ne-modal-close" onClick={() => setShowSaveModal(false)}><X size={16} /></button>
            </div>
            <div className="ne-modal-body">
              <p className="ne-modal-path">{selectedFile?.path}</p>
              <div className="ne-modal-info">
                <AlertTriangle size={14} />
                <span>Make sure the configuration is valid before saving. Incorrect PHP ini settings can break PHP.</span>
              </div>
            </div>
            <div className="ne-modal-footer">
              <button className="ne-tb-btn ne-tb-cancel" onClick={() => setShowSaveModal(false)}>
                Cancel
              </button>
              <button
                className="ne-tb-btn ne-tb-save"
                onClick={confirmSave}
                disabled={saving}
              >
                <Save size={14} /> {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New File Modal */}
      {showNewModal && (
        <div className="ne-modal-overlay" onClick={() => setShowNewModal(false)}>
          <div className="ne-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="ne-modal-header">
              <h3><Plus size={16} /> New ini File</h3>
              <button className="ne-modal-close" onClick={() => setShowNewModal(false)}><X size={16} /></button>
            </div>
            <div className="ne-modal-body">
              <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem' }}>
                Create in: <strong>/etc/php/{selectedVersion}/{selectedSapi}/conf.d/</strong>
              </p>
              <label className="ne-modal-label">File name (e.g. my-php.ini)</label>
              <input
                className="ne-modal-input"
                type="text"
                placeholder="e.g. 99-my.ini"
                value={newFileName}
                onChange={e => setNewFileName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="ne-modal-footer">
              <button className="ne-tb-btn ne-tb-cancel" onClick={() => setShowNewModal(false)}>
                Cancel
              </button>
              <button
                className="ne-tb-btn ne-tb-save"
                onClick={handleCreateFile}
                disabled={!newFileName.trim()}
              >
                <Plus size={14} /> Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

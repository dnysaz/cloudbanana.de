import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../api';
import { Save, CheckCircle, XCircle, RefreshCw, FileText, FolderClosed, FolderOpen, Edit3, Plus, AlertTriangle, X } from 'lucide-react';

interface Props {
  winId?: string;
  winData?: Record<string, unknown>;
}

interface NginxFile {
  path: string;
  name: string;
}

type Section = 'configs' | 'sites-available' | 'sites-enabled' | 'conf.d';

const SECTIONS: { id: Section; label: string; base: string }[] = [
  { id: 'configs', label: 'Configuration', base: '/etc/nginx' },
  { id: 'sites-available', label: 'Sites Available', base: '/etc/nginx/sites-available' },
  { id: 'sites-enabled', label: 'Sites Enabled', base: '/etc/nginx/sites-enabled' },
  { id: 'conf.d', label: 'conf.d', base: '/etc/nginx/conf.d' },
];

const MAIN_FILES = ['nginx.conf', 'mime.types', 'fastcgi_params', 'proxy_params'];

export default function NginxEditor(_props: Props) {
  const [files, setFiles] = useState<Record<Section, NginxFile[]>>({ configs: [], 'sites-available': [], 'sites-enabled': [], 'conf.d': [] });
  const [expanded, setExpanded] = useState<Record<Section, boolean>>({ configs: true, 'sites-available': true, 'sites-enabled': true, 'conf.d': true });
  const [selectedPath, setSelectedPath] = useState('');
  const [content, setContent] = useState('');
  const [origContent, setOrigContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'ok' | 'error' | ''; msg: string }>({ type: '', msg: '' });
  const [testResult, setTestResult] = useState<{ type: 'ok' | 'error' | ''; msg: string }>({ type: '', msg: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveTestResult, setSaveTestResult] = useState<{ type: 'ok' | 'error' | ''; msg: string }>({ type: '', msg: '' });
  const [saveTestRunning, setSaveTestRunning] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileSection, setNewFileSection] = useState<Section>('sites-available');
  const textRef = useRef<HTMLTextAreaElement>(null);

  const loadFiles = useCallback(async () => {
    const result: Record<Section, NginxFile[]> = { configs: [], 'sites-available': [], 'sites-enabled': [], 'conf.d': [] };
    for (const section of SECTIONS) {
      try {
        if (section.id === 'configs') {
          const items: NginxFile[] = [];
          for (const name of MAIN_FILES) {
            try {
              const r = await api.get<{ items: { name: string; is_dir: boolean }[] }>('/files?path=' + encodeURIComponent('/etc/nginx'));
              const found = r.items.find(i => i.name === name && !i.is_dir);
              if (found) items.push({ path: '/etc/nginx/' + name, name });
            } catch {}
          }
          result.configs = items;
        } else {
          const r = await api.get<{ items: { name: string; is_dir: boolean }[] }>('/files?path=' + encodeURIComponent(section.base));
          result[section.id] = r.items.filter(i => !i.is_dir).map(i => ({ path: section.base + '/' + i.name, name: i.name }));
        }
      } catch {}
    }
    setFiles(result);
  }, []);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const selectFile = async (path: string) => {
    setSelectedPath(path);
    setLoading(true);
    setStatus({ type: '', msg: '' });
    setTestResult({ type: '', msg: '' });
    setIsEditing(false);
    try {
      const r = await api.post<{ content: string }>('/files/read', { path });
      setContent(r.content);
      setOrigContent(r.content);
    } catch (e) {
      setStatus({ type: 'error', msg: e instanceof Error ? e.message : 'Failed to read' });
    }
    setLoading(false);
  };

  const handleSaveClick = () => {
    setShowSaveModal(true);
    setSaveTestResult({ type: '', msg: '' });
  };

  const runSaveTest = async () => {
    setSaveTestRunning(true);
    setSaveTestResult({ type: '', msg: '' });
    try {
      const r = await api.post<{ status: string; message: string }>('/nginx/test', {});
      const ok = r.status === 'ok';
      setSaveTestResult({ type: ok ? 'ok' : 'error', msg: r.message });
    } catch (e) {
      setSaveTestResult({ type: 'error', msg: e instanceof Error ? e.message : 'Test failed' });
    }
    setSaveTestRunning(false);
  };

  const confirmSave = async () => {
    if (!selectedPath) return;
    setSaving(true);
    setStatus({ type: '', msg: '' });
    try {
      await api.post('/files/write', { path: selectedPath, content });
      setOrigContent(content);
      setStatus({ type: 'ok', msg: 'Saved successfully' });
      setShowSaveModal(false);
      setTimeout(() => setStatus({ type: '', msg: '' }), 3000);
    } catch (e) {
      setStatus({ type: 'error', msg: e instanceof Error ? e.message : 'Failed to save' });
      setSaveTestResult({ type: 'error', msg: e instanceof Error ? e.message : 'Failed to save' });
    }
    setSaving(false);
  };

  const testConfig = async () => {
    setTestResult({ type: '', msg: '' });
    try {
      const r = await api.post<{ status: string; message: string }>('/nginx/test', {});
      const ok = r.status === 'ok';
      setTestResult({ type: ok ? 'ok' : 'error', msg: r.message });
    } catch (e) {
      setTestResult({ type: 'error', msg: e instanceof Error ? e.message : 'Test failed' });
    }
  };

  const handleCreateFile = async () => {
    if (!newFileName.trim()) return;
    const section = SECTIONS.find(s => s.id === newFileSection);
    if (!section) return;
    const filePath = section.base + '/' + newFileName.trim();
    try {
      await api.post('/files/write', { path: filePath, content: '# New nginx config file\n' });
      setShowNewModal(false);
      setNewFileName('');
      loadFiles();
      selectFile(filePath);
    } catch (e) {
      setStatus({ type: 'error', msg: e instanceof Error ? e.message : 'Failed to create file' });
    }
  };

  const hasChanges = content !== origContent;

  const renderTree = (section: Section) => {
    const items = files[section] || [];
    if (items.length === 0) return null;
    const isOpen = expanded[section];
    return (
      <div key={section} className="ne-sidebar-group">
        <button className="ne-sidebar-header" onClick={() => setExpanded(s => ({ ...s, [section]: !s[section] }))}>
          {isOpen ? <FolderOpen size={13} /> : <FolderClosed size={13} />}
          <span>{SECTIONS.find(s => s.id === section)?.label}</span>
          <span className="ne-sidebar-count">{items.length}</span>
        </button>
        {isOpen && items.map(f => (
          <button
            key={f.path}
            className={`ne-sidebar-item${selectedPath === f.path ? ' active' : ''}`}
            onClick={() => selectFile(f.path)}
          >
            <FileText size={12} />
            <span>{f.name}</span>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="ne-root">
      <div className="ne-sidebar">
        <div className="ne-sidebar-title">Nginx Configs</div>
        <button className="ne-refresh-btn" onClick={loadFiles} title="Refresh file list">
          <RefreshCw size={13} /> Refresh
        </button>
        {renderTree('configs')}
        {renderTree('sites-available')}
        {renderTree('sites-enabled')}
        {renderTree('conf.d')}
      </div>
      <div className="ne-main">
        {!selectedPath ? (
          <div className="ne-empty">
            <FileText size={48} />
            <p>Select a configuration file from the sidebar</p>
          </div>
        ) : (
          <>
            <div className="ne-toolbar">
              <div className="ne-toolbar-left">
                <span className="ne-file-path">{selectedPath}</span>
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
                <button className="ne-tb-btn ne-tb-test" onClick={testConfig} disabled={saving}>
                  <CheckCircle size={14} /> Test
                </button>
              </div>
            </div>
            {status.msg && (
              <div className={`ne-status ${status.type}`}>
                {status.type === 'ok' ? <CheckCircle size={13} /> : <XCircle size={13} />} {status.msg}
              </div>
            )}
            {testResult.msg && (
              <div className={`ne-status ne-test ${testResult.type}`}>
                {testResult.type === 'ok' ? <CheckCircle size={13} /> : <XCircle size={13} />}
                <pre className="ne-test-output">{testResult.msg}</pre>
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

        {/* Add New button at bottom of main area when no file selected */}
        {!selectedPath && (
          <div className="ne-add-new-container">
            <button className="ne-tb-btn ne-tb-add" onClick={() => setShowNewModal(true)}>
              <Plus size={14} /> Add New Config
            </button>
          </div>
        )}
      </div>

      {/* Add New button floating on sidebar */}
      {selectedPath && (
        <button className="ne-add-fab" onClick={() => setShowNewModal(true)} title="Create new config file">
          <Plus size={16} />
        </button>
      )}

      {/* Save Confirmation Modal */}
      {showSaveModal && (
        <div className="ne-modal-overlay" onClick={() => setShowSaveModal(false)}>
          <div className="ne-modal" onClick={e => e.stopPropagation()}>
            <div className="ne-modal-header">
              <h3><Save size={16} /> Confirm Save</h3>
              <button className="ne-modal-close" onClick={() => setShowSaveModal(false)}><X size={16} /></button>
            </div>
            <div className="ne-modal-body">
              <p className="ne-modal-path">{selectedPath}</p>
              <div className="ne-modal-info">
                <AlertTriangle size={14} />
                <span>Review the nginx configuration test result before saving.</span>
              </div>
              {!saveTestResult.msg && !saveTestRunning && (
                <button className="ne-tb-btn ne-tb-test ne-modal-test-btn" onClick={runSaveTest} disabled={saveTestRunning}>
                  <CheckCircle size={14} /> Run Nginx Test
                </button>
              )}
              {saveTestRunning && (
                <div className="ne-modal-testing">Testing configuration...</div>
              )}
              {saveTestResult.msg && (
                <div className={`ne-status ne-test ${saveTestResult.type}`}>
                  {saveTestResult.type === 'ok' ? <CheckCircle size={13} /> : <XCircle size={13} />}
                  <pre className="ne-test-output">{saveTestResult.msg}</pre>
                </div>
              )}
            </div>
            <div className="ne-modal-footer">
              <button className="ne-tb-btn ne-tb-cancel" onClick={() => setShowSaveModal(false)}>
                Cancel
              </button>
              <button
                className="ne-tb-btn ne-tb-save"
                onClick={confirmSave}
                disabled={saving || (saveTestResult.type === 'error' && !!saveTestResult.msg)}
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
              <h3><Plus size={16} /> New Config File</h3>
              <button className="ne-modal-close" onClick={() => setShowNewModal(false)}><X size={16} /></button>
            </div>
            <div className="ne-modal-body">
              <label className="ne-modal-label">Section</label>
              <select
                className="ne-modal-select"
                value={newFileSection}
                onChange={e => setNewFileSection(e.target.value as Section)}
              >
                {SECTIONS.filter(s => s.id !== 'configs').map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
              <label className="ne-modal-label">File name</label>
              <input
                className="ne-modal-input"
                type="text"
                placeholder="e.g. mysite.conf, mysite.com"
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

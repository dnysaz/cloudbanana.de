import { useState, useEffect, useRef } from 'react';
import { api } from '../../api';
import { useDesktopStore } from '../../store/desktopStore';
import { Download, Trash2, ExternalLink, FileText, FolderOpen, Folder } from 'lucide-react';

interface DownloadTask {
  task_id: string;
  url: string;
  directory: string;
  status: 'running' | 'done' | 'error';
  output?: string;
  filename?: string;
  size?: string;
  format_id?: string;
}

export default function Wget() {
  const { openWindow } = useDesktopStore();
  const [url, setUrl] = useState('');
  const [dir, setDir] = useState('/root/Desktop');
  const [customName, setCustomName] = useState('');
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const [adding, setAdding] = useState(false);
  const intervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.path) setDir(detail.path);
    };
    document.addEventListener('fm-dir-picked', handler);
    return () => document.removeEventListener('fm-dir-picked', handler);
  }, []);

  const pollTask = (taskId: string) => {
    const id = setInterval(async () => {
      try {
        const data = await api.get<DownloadTask>(`/wget/status/${taskId}`);
        setTasks((prev) => prev.map((t) => t.task_id === taskId ? { ...t, ...data } : t));
        if (data.status !== 'running') {
          clearInterval(id);
          intervalsRef.current.delete(taskId);
        }
      } catch {
        clearInterval(id);
        intervalsRef.current.delete(taskId);
      }
    }, 2000);
    intervalsRef.current.set(taskId, id);
  };

  const addDownload = async () => {
    if (!url.trim()) return;
    try {
      setAdding(true);
      const body: Record<string, string> = { url: url.trim(), dir };
      if (customName.trim()) body.filename = customName.trim();
      const data = await api.post<DownloadTask>('/wget', body);
      const task: DownloadTask = {
        task_id: data.task_id,
        url: data.url,
        directory: data.directory,
        status: 'running',
        filename: data.filename || detectFilename(data.url),
      };
      setTasks((prev) => [task, ...prev]);
      pollTask(data.task_id);
      setUrl('');
      setCustomName('');
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Failed';
      setTasks((prev) => [{
        task_id: 'err-' + Date.now(),
        url: url.trim(),
        directory: dir,
        status: 'error',
        output: errMsg,
        filename: customName.trim() || detectFilename(url),
      }, ...prev]);
    } finally {
      setAdding(false);
    }
  };

  const removeTask = (taskId: string) => {
    const id = intervalsRef.current.get(taskId);
    if (id) { clearInterval(id); intervalsRef.current.delete(taskId); }
    setTasks((prev) => prev.filter((t) => t.task_id !== taskId));
  };

  const openDir = (d: string) => {
    openWindow('fm-' + Date.now(), 'File Manager', { path: d });
  };

  const browseDir = () => {
    openWindow('fm-pickdir-' + Date.now(), 'Select Download Folder', { path: '/root/Desktop', pickDir: true });
  };

  const detectFilename = (u: string) => {
    try { return new URL(u).pathname.split('/').filter(Boolean).pop() || ''; }
    catch { return ''; }
  };

  const getFileName = (t: DownloadTask) => {
    if (t.filename) return t.filename;
    try { return new URL(t.url).pathname.split('/').filter(Boolean).pop() || t.url; }
    catch { return t.url; }
  };

  return (
    <div className="win-content" style={{ height: '100%', display: 'flex', flexDirection: 'column', maxWidth: '48rem', margin: '0 auto', width: '100%' }}>
      <div className="idm-toolbar">
        <span className="idm-tb-label" style={{ marginLeft: 0 }}>Download Manager</span>
      </div>

      {/* URL */}
      <div className="idm-field">
        <label className="idm-label">URL</label>
        <input className="idm-input" placeholder="https://example.com/file.zip"
          value={url} onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addDownload()} />
      </div>

      {/* Browse folder */}
      <div className="idm-field">
        <label className="idm-label">Save to</label>
        <button className="idm-browse-btn" onClick={browseDir}>
          <Folder size={15} />
          Browse Folder
        </button>
      </div>
      {dir && (
        <div className="idm-save-at">
          <FolderOpen size={13} />
          Save at: <span className="idm-save-path">{dir}</span>
        </div>
      )}
      <div className="idm-field">
        <label className="idm-label">
          File name <span className="idm-label-opt">(optional)</span>
        </label>
        <input className="idm-input" placeholder={detectFilename(url) || '(auto-detected)'}
          value={customName} onChange={(e) => setCustomName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addDownload()} />
      </div>

      {/* Add button */}
      <button className="idm-add-btn" onClick={addDownload} disabled={adding || !url.trim()}>
        <Download size={15} /> {adding ? 'Adding\u2026' : 'Start Download'}
      </button>

      <div className="idm-divider" />

      {/* Download list */}
      <div className="idm-list-header">
        <span className="idm-col-file">File</span>
        <span className="idm-col-size">Size</span>
        <span className="idm-col-status">Status</span>
        <span className="idm-col-progress">Progress</span>
        <span className="idm-col-action" />
      </div>

      <div className="idm-list">
        {tasks.length === 0 ? (
          <div className="empty-msg" style={{ padding: '2.5rem 0.5rem' }}>
            <Download size={36} style={{ opacity: 0.15, display: 'block', margin: '0 auto 0.6rem' }} />
            No downloads yet
          </div>
        ) : (
          tasks.map((t) => {
            const isRunning = t.status === 'running';
            const isError = t.status === 'error';
            const isDone = t.status === 'done';
            const fname = getFileName(t);
            return (
              <div key={t.task_id} className={`idm-row ${t.status}`}>
                <div className="idm-col-file" title={t.url}>
                  <FileText size={14} className="idm-file-icon" />
                  <span className="idm-filename">{fname}</span>
                  <span className="idm-url-sub">{t.url}</span>
                </div>
                <div className="idm-col-size">{t.size || '\u2014'}</div>
                <div className="idm-col-status">
                  <span className={`idm-badge ${t.status}`}>
                    {isRunning ? 'Downloading' : isError ? 'Error' : 'Completed'}
                  </span>
                </div>
                <div className="idm-col-progress">
                  <div className="idm-progress-bar">
                    <div className={`idm-progress-fill ${isError ? 'error' : isDone ? 'done' : ''}`}
                      style={{ width: isDone ? '100%' : isRunning ? '30%' : '0%' }} />
                  </div>
                </div>
                <div className="idm-col-action">
                  {isDone && (
                    <button className="idm-action-link" onClick={() => openDir(t.directory)}
                      title="Open folder">
                      <FolderOpen size={13} />
                    </button>
                  )}
                  {isDone && (
                    <a href={`http://${t.directory}/${fname}`} target="_blank" rel="noreferrer"
                      className="idm-action-link" title="Open file">
                      <ExternalLink size={13} />
                    </a>
                  )}
                  <button className="idm-action-del" onClick={() => removeTask(t.task_id)}
                    title="Remove">
                    <Trash2 size={13} />
                  </button>
                </div>
                {isError && t.output && (
                  <div className="idm-error-detail">{t.output}</div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

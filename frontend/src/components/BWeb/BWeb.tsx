import { useState, useRef, useEffect } from 'react';
import { Globe, File, Folder, Upload, X, ChevronDown, Loader2 } from 'lucide-react';
import { getToken, api } from '../../api';
import { useDesktopStore } from '../../store/desktopStore';

interface Props {
  winId?: string;
  winData?: Record<string, unknown>;
}

export default function BWeb({ winId, winData }: Props) {
  const { openWindow } = useDesktopStore();
  const [filePath, setFilePath] = useState<string | undefined>(winData?.path as string);
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [destPath, setDestPath] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Listen for file picked events from FileManager (pickMode)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.path) {
        setFilePath(detail.path);
        setMenuOpen(false);
      }
    };
    document.addEventListener('fm-file-picked', handler);
    return () => document.removeEventListener('fm-file-picked', handler);
  }, []);

  // Listen for directory picked events (pickDir for folder upload destination)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.path) {
        setDestPath(detail.path);
        setMenuOpen(false);
        // After destination is selected, trigger folder picker on next tick
        setTimeout(() => folderInputRef.current?.click(), 150);
      }
    };
    document.addEventListener('fm-dir-picked', handler);
    return () => document.removeEventListener('fm-dir-picked', handler);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuOpen]);

  const handleOpenFile = () => {
    setMenuOpen(false);
    const id = 'fm-pick-' + (winId || Date.now());
    openWindow(id, 'Select File', { path: '/', pickMode: true });
  };

  const handleOpenFileLocal = () => {
    setMenuOpen(false);
    fileInputRef.current?.click();
  };

  const handleOpenFolder = () => {
    setMenuOpen(false);
    // First ask user where to save the folder
    const id = 'fm-pickdir-' + (winId || Date.now());
    openWindow(id, 'Select Destination Folder', { path: '/home', pickDir: true });
  };

  const handleLocalFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadStatus(`Uploading ${file.name}...`);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', '/tmp');
      const result = await api.post<{ status: string; path: string }>('/files/upload', formData, true);
      setFilePath(result.path);
      setUploadStatus('Done');
    } catch (err) {
      setUploadStatus('Upload failed');
      console.error('Local file upload error:', err);
    } finally {
      setTimeout(() => { setUploading(false); setUploadStatus(''); }, 1000);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFolderSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !destPath) {
      setDestPath(null);
      return;
    }

    setUploading(true);
    setUploadStatus(`Uploading ${files.length} files...`);

    try {
      // Ensure destination directory exists
      await api.post('/files/mkdir', { path: destPath }).catch(() => {});

      let uploaded = 0;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const relPath = (file as any).webkitRelativePath || file.name;
        const parts = relPath.split('/');
        parts.pop(); // remove filename, keep directory path

        // Create subdirectories as needed
        if (parts.length > 0) {
          const subDir = destPath + '/' + parts.join('/');
          await api.post('/files/mkdir', { path: subDir }).catch(() => {});
        }

        const targetDir = parts.length > 0
          ? destPath + '/' + parts.join('/')
          : destPath;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', targetDir);
        await api.post('/files/upload', formData, true);

        uploaded++;
        if (uploaded % 5 === 0 || uploaded === files.length) {
          setUploadStatus(`Uploaded ${uploaded}/${files.length} files...`);
        }
      }

      // Try to load index.html from uploaded folder
      const indexHtml = destPath + '/index.html';
      setFilePath(indexHtml);
      setUploadStatus(`Loaded ${uploaded} files`);
    } catch (err) {
      setUploadStatus('Upload failed');
      console.error('Folder upload error:', err);
    } finally {
      setTimeout(() => { setUploading(false); setUploadStatus(''); }, 2000);
      if (folderInputRef.current) folderInputRef.current.value = '';
      setDestPath(null);
    }
  };

  const buildSrc = (path: string) => {
    const token = getToken() || '';
    return `/api/v1/files/serve${path}?token=${encodeURIComponent(token)}`;
  };

  const src = filePath ? buildSrc(filePath) : '';

  return (
    <div className="bweb-container">
      {/* ===== Toolbar / Menu Bar ===== */}
      <div className="bweb-toolbar">
        <div className="bweb-menu-wrap" ref={menuRef}>
          <button
            className="bweb-menu-btn"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
          >
            File <ChevronDown size={11} />
          </button>
          {menuOpen && (
            <div className="bweb-dropdown">
              <button className="bweb-dropdown-item" onClick={handleOpenFile}>
                <File size={14} /> Open File
              </button>
              <button className="bweb-dropdown-item" onClick={handleOpenFileLocal}>
                <Upload size={14} /> Open File Local
              </button>
              <button className="bweb-dropdown-item" onClick={handleOpenFolder}>
                <Folder size={14} /> Open Folder
              </button>
              <div className="bweb-dropdown-sep" />
              {filePath && (
                <button
                  className="bweb-dropdown-item"
                  onClick={() => { setMenuOpen(false); setFilePath(undefined); }}
                >
                  <X size={14} /> Close
                </button>
              )}
            </div>
          )}
        </div>

        {filePath && (
          <span className="bweb-path" title={filePath}>
            {filePath.split('/').pop()}
          </span>
        )}

        {uploading && (
          <span className="bweb-status">
            <Loader2 size={11} className="bweb-spin" /> {uploadStatus}
          </span>
        )}
      </div>

      {/* ===== Hidden file inputs ===== */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".html,.htm"
        style={{ display: 'none' }}
        onChange={handleLocalFileSelected}
      />
      <input
        ref={folderInputRef}
        type="file"
        {...({ webkitdirectory: '' } as any)}
        multiple
        style={{ display: 'none' }}
        onChange={handleFolderSelected}
      />

      {/* ===== Content Area ===== */}
      {!filePath && !uploading ? (
        <div className="bweb-empty">
          <Globe size={44} strokeWidth={1.5} />
          <span className="bweb-empty-title">Open a file to view it</span>
          <span className="bweb-empty-hint">
            Use the <strong>File</strong> menu above to open HTML files
          </span>
          <div className="bweb-empty-actions">
            <button className="bweb-empty-btn" onClick={handleOpenFile}>
              <File size={15} /> Open from Server
            </button>
            <button className="bweb-empty-btn" onClick={handleOpenFileLocal}>
              <Upload size={15} /> Upload Local File
            </button>
            <button className="bweb-empty-btn" onClick={handleOpenFolder}>
              <Folder size={15} /> Upload Folder
            </button>
          </div>
        </div>
      ) : uploading ? (
        <div className="bweb-empty">
          <Loader2 size={40} className="bweb-spin" />
          <span className="bweb-empty-title">{uploadStatus}</span>
        </div>
      ) : (
        <iframe
          className="bweb-frame"
          src={src}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          title="WebView"
        />
      )}
    </div>
  );
}

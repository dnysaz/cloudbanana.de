import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useDesktopStore } from '../../store/desktopStore';
import { api } from '../../api';
import { Settings, RotateCcw, Image, File, FolderPlus, Copy, ClipboardPaste, Terminal, LayoutDashboard, Upload } from 'lucide-react';
import CreateModal from './CreateModal';
import { setClipboard, getClipboard, listenClipboard } from '../../clipboard';

export default function ContextMenu() {
  const { openWindow, setPendingTerminalCommand } = useDesktopStore();
  const user = useAuthStore((s) => s.user);
  const [showModal, setShowModal] = useState<'file' | 'folder' | false>(false);
  const [clipboard, setClipState] = useState(getClipboard());
  const uploadRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    return listenClipboard((data) => setClipState(data));
  }, []);

  const desktopDir = user?.home ? user.home + '/Desktop' : '/root/Desktop';

  const closeMenu = () => {
    const el = document.getElementById('desktop-menu');
    if (el) el.style.display = 'none';
  };

  const refresh = () => {
    closeMenu();
    document.dispatchEvent(new CustomEvent('desktop-refresh'));
  };

  const wallpaper = () => {
    closeMenu();
    document.dispatchEvent(new CustomEvent('open-wallpaper-picker'));
  };

  const openCreate = (type: 'file' | 'folder') => {
    closeMenu();
    setShowModal(type);
  };

  const handleCreate = async (name: string, type: 'file' | 'folder') => {
    await api.post('/files/mkdir', { path: desktopDir }).catch(() => {});
    const fullPath = desktopDir + '/' + name;
    if (type === 'folder') {
      await api.post('/files/mkdir', { path: fullPath });
    } else {
      await api.post('/files/write', { path: fullPath, content: '' });
    }
    setShowModal(false);
    document.dispatchEvent(new CustomEvent('desktop-refresh'));
  };

  const copyHere = () => {
    closeMenu();
    setClipboard({ path: desktopDir, cut: false });
  };

  const pasteHere = async () => {
    closeMenu();
    if (!clipboard) return;
    const src = clipboard.path;
    const name = src.split('/').pop();
    const dest = desktopDir + '/' + name;
    if (src === dest) {
      document.dispatchEvent(new CustomEvent('desktop-error', { detail: 'Source and destination are the same' }));
      return;
    }
    try {
      if (clipboard.cut) {
        await api.post('/files/move', { path: src, dest });
      } else {
        await api.post('/files/copy', { path: src, dest });
      }
      setClipboard(null);
      document.dispatchEvent(new CustomEvent('desktop-refresh'));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Paste failed';
      document.dispatchEvent(new CustomEvent('desktop-error', { detail: msg }));
    }
  };

  const openTerminal = () => {
    closeMenu();
    openWindow('terminal-' + Date.now(), 'Terminal');
    setPendingTerminalCommand(`cd ${desktopDir}`);
  };

  const toggleWidgets = () => {
    closeMenu();
    const existing = document.getElementById('win-widgets');
    if (existing) {
      useDesktopStore.getState().closeWindow('widgets');
    } else {
      openWindow('widgets', 'Widgets');
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await api.post('/files/mkdir', { path: desktopDir }).catch(() => {});
      const form = new FormData();
      form.append('file', file);
      form.append('path', desktopDir);
      await api.post('/files/upload', form, true);
      document.dispatchEvent(new CustomEvent('desktop-refresh'));
    } catch (err) {
      console.warn('Upload error:', err);
    }
    setUploading(false);
    if (uploadRef.current) uploadRef.current.value = '';
  };

  return (
    <>
      <input ref={uploadRef} type="file" style={{ display:'none' }} onChange={handleUpload} />
      <div id="desktop-menu" style={{ display: 'none' }}>
        <button className="ctx-item" onClick={() => openCreate('folder')}><FolderPlus size={15} /> New Folder</button>
        <button className="ctx-item" onClick={() => openCreate('file')}><File size={15} /> New File</button>
        <button className="ctx-item" onClick={() => { closeMenu(); uploadRef.current?.click(); }} disabled={uploading}>
          <Upload size={15} /> {uploading ? 'Uploading...' : 'Upload File'}
        </button>
        <button className="ctx-item" onClick={wallpaper}><Image size={15} /> Change Wallpaper</button>
        <div className="ctx-sep" />
        <button className="ctx-item" onClick={copyHere}><Copy size={15} /> Copy</button>
        <button className="ctx-item" onClick={pasteHere} disabled={!clipboard}><ClipboardPaste size={15} /> Paste</button>
        <div className="ctx-sep" />
        <button className="ctx-item" onClick={openTerminal}><Terminal size={15} /> Open in Terminal</button>
        <button className="ctx-item" onClick={refresh}><RotateCcw size={15} /> Refresh</button>
        <button className="ctx-item" onClick={() => { closeMenu(); openWindow('settings', 'Settings'); }}>
          <Settings size={15} /> Settings
        </button>
        <div className="ctx-sep" />
        <button className="ctx-item" onClick={toggleWidgets}>
          <LayoutDashboard size={15} /> Show Widgets
        </button>
      </div>
      {showModal && (
        <CreateModal initialType={showModal} onClose={() => setShowModal(false)} onCreate={handleCreate} />
      )}
    </>
  );
}

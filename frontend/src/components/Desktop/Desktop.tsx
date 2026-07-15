import { useEffect, useState, useCallback, useRef, type ReactNode, type MouseEvent } from 'react';
import { WALLPAPERS } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { useDesktopStore } from '../../store/desktopStore';
import { api, getToken } from '../../api';
import { Folder, File, Trash2, RefreshCw, Info, Edit3, Copy, Scissors, ClipboardPaste, Eye, EyeOff, Upload, X, Minus, Square } from 'lucide-react';
import ContextMenu from './ContextMenu';
import Taskbar from './Taskbar';
import { setClipboard, getClipboard, listenClipboard } from '../../clipboard';

/* ===== Custom pinned desktop icons (modern SVG) ===== */
function FmPinnedIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none">
      <path d="M4 14c0-2.2 1.8-4 4-4h12l4 4h16c2.2 0 4 1.8 4 4v20c0 2.2-1.8 4-4 4H8c-2.2 0-4-1.8-4-4V14z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <rect x="22" y="8" width="16" height="21" rx="2" stroke="currentColor" strokeWidth="1.5" opacity="0.9" />
      <line x1="27" y1="15" x2="35" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <line x1="27" y1="19" x2="33" y2="19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <line x1="27" y1="23" x2="31" y2="23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

function lighten(hex: string, amt: number) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgb(${Math.min(255, (n >> 16) + amt)},${Math.min(255, ((n >> 8) & 255) + amt)},${Math.min(255, (n & 255) + amt)})`;
}

interface Props {
  children?: ReactNode;
}

export default function Desktop({ children }: Props) {
  const user = useAuthStore((s) => s.user);
  const { openWindow } = useDesktopStore();
  const [wpPicker, setWpPicker] = useState(false);
  const [desktopItems, setDesktopItems] = useState<{ name: string; is_dir: boolean }[]>([]);
  const [iconMenu, setIconMenu] = useState<{
    x: number; y: number; name: string; isDir: boolean; pinnedId?: string;
  } | null>(null);
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [propsTarget, setPropsTarget] = useState<{ name: string; isDir: boolean } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ name: string; isDir: boolean } | null>(null);
  const [clipboard, setClipState] = useState(getClipboard());
  const [showHidden, setShowHidden] = useState(false);
  const [folderNotEmpty, setFolderNotEmpty] = useState(false);
  const [wpSource, setWpSource] = useState<{ name: string; url: string } | null>(null);
  const [wpFit, setWpFit] = useState(() => localStorage.getItem('cb-wallpaper-fit') || 'cover');
  const [wpMaximized, setWpMaximized] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const iconMenuRef = useRef(false);
  const [customWps, setCustomWps] = useState<{ id: string; name: string; path: string; value: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem('cb-custom-wallpapers') || '[]'); }
    catch { return []; }
  });
  const wallpaperCache = useRef<Map<string, string>>(new Map()); // id → blob URL
  const uploadRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const desktopLastClick = useRef<Record<string, number>>({});
  const wpDir = user?.home ? user.home + '/images/wallpaper' : '';

// ---- Move constants outside component ----
const WP_FITS_OPTIONS = [
  { id: 'cover', label: 'Full', icon: '⊞' },
  { id: 'stretch', label: 'Stretch', icon: '⤡' },
  { id: 'contain', label: 'Fit', icon: '⛶' },
  { id: 'center', label: 'Center', icon: '⊕' },
  { id: 'repeat', label: 'Tile', icon: '⊟' },
] as const;
const IMG_EXTS = ['png','jpg','jpeg','gif','svg','webp','bmp','ico'];
const VID_EXTS = ['mp4','avi','mkv','webm','mov','wmv'];
const BNOTE_EXTS = ['txt','json','md','log','csv','env','cfg','ini','conf','yaml','yml','xml','toml'];
const WEB_EXTS = ['html','htm','php','phtml','php3','php4','php5'];
const isImage = (name: string) => IMG_EXTS.includes(name.split('.').pop()?.toLowerCase() || '');
const isVideo = (name: string) => VID_EXTS.includes(name.split('.').pop()?.toLowerCase() || '');
const isBnoteFile = (name: string) => BNOTE_EXTS.includes(name.split('.').pop()?.toLowerCase() || '');
const isWebFile = (name: string) => WEB_EXTS.includes(name.split('.').pop()?.toLowerCase() || '');

  const homeDir = user?.home || (user?.username === 'root' ? '/root' : '/home/' + (user?.username || 'root')) || '/root';
  const desktopDir = homeDir + '/Desktop';

  const PINNED_ITEMS = [
    {
      id: 'pinned-fm',
      name: 'File Manager',
      icon: 'folder',
      action: () => openWindow('fm-' + Date.now(), 'File Manager', { path: homeDir }),
    },
  ] as const;

  useEffect(() => {
    return listenClipboard((data) => setClipState(data));
  }, []);

  const loadDesktop = useCallback(async () => {
    if (!user?.home) return;
    try {
      const data = await api.get<{ items: { name: string; is_dir: boolean }[] }>(
        '/files?path=' + encodeURIComponent(desktopDir)
      );
      let items = data.items;
      if (!showHidden) {
        items = items.filter((i) => !i.name.startsWith('.'));
      }
      setDesktopItems(items);
    } catch {}
  }, [user, desktopDir, showHidden]);

  // Init effect: wallpaper, theme, event listeners — runs once on mount
  useEffect(() => {
    const saved = localStorage.getItem('cb-wallpaper');
    if (saved) {
      apply(saved);
    } else {
      apply('cloudbanana');
    }
    const theme = localStorage.getItem('cb-theme');
    if (theme === 'dark') document.documentElement.classList.add('theme-dark');
    const font = localStorage.getItem('cb-font');
    if (font) document.body.style.fontFamily = `'${font}', -apple-system, sans-serif`;
    const size = localStorage.getItem('cb-size');
    if (size) document.documentElement.style.fontSize = size + 'px';
    const panelOpacity = localStorage.getItem('cb-panel-opacity');
    if (panelOpacity) document.documentElement.style.setProperty('--panel-opacity', panelOpacity);

    // Restore fullscreen on first user click
    if (localStorage.getItem('cb-fullscreen') === 'true') {
      const tryFullscreen = () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      };
      tryFullscreen();
      document.addEventListener('click', tryFullscreen, { once: true });
    }
    const fsHandler = () => {
      if (!document.fullscreenElement) {
        localStorage.setItem('cb-fullscreen', 'false');
      }
    };
    document.addEventListener('fullscreenchange', fsHandler);

    const handler = () => setWpPicker(true);
    document.addEventListener('open-wallpaper-picker', handler);
    return () => {
      document.removeEventListener('fullscreenchange', fsHandler);
      document.removeEventListener('open-wallpaper-picker', handler);
    };
  }, []);

  // Fetch image from server and create a blob URL for use as CSS background
  const fetchBlobUrl = useCallback(async (wp: { id: string; path: string }) => {
    try {
      const token = getToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const r = await fetch(`/api/v1/files/raw?path=${encodeURIComponent(wp.path)}`, { headers });
      if (!r.ok) throw new Error('Failed to fetch');
      const blob = await r.blob();
      const blobUrl = URL.createObjectURL(blob);
      wallpaperCache.current.set(wp.id, blobUrl);
      return blobUrl;
    } catch {
      return null;
    }
  }, []);

  // Re-fetch custom wallpaper images from server (blob URLs don't persist across reloads)
  useEffect(() => {
    const savedCustom = localStorage.getItem('cb-custom-wallpapers');
    if (!savedCustom) return;
    try {
      const entries = JSON.parse(savedCustom);
      Promise.all(entries.map(async (e: { id: string; name: string; path: string }) => {
        const blobUrl = await fetchBlobUrl(e);
        if (blobUrl) {
          setCustomWps(prev => {
            const existing = prev.find(w => w.id === e.id);
            if (existing) {
              return prev.map(w => w.id === e.id ? { ...w, value: blobUrl } : w);
            }
            return [...prev, { id: e.id, name: e.name || 'Wallpaper', path: e.path, value: blobUrl }];
          });
          const active = localStorage.getItem('cb-wallpaper');
          if (active === e.id) {
            const el = document.getElementById('desktop-workspace');
            if (el) el.style.background = `url('${blobUrl}') center/cover no-repeat`;
          }
        }
      }));
    } catch {}
  }, [fetchBlobUrl]);

  // Load desktop items — isolated so it only runs when showHidden changes
  useEffect(() => {
    api.post('/files/mkdir', { path: desktopDir }).catch(() => {});
    loadDesktop();
  }, [loadDesktop]);

  // Desktop refresh event listener
  useEffect(() => {
    const refresh = () => { loadDesktop(); document.dispatchEvent(new CustomEvent('fm-refresh-all')); };
    document.addEventListener('desktop-refresh', refresh);
    return () => document.removeEventListener('desktop-refresh', refresh);
  }, [loadDesktop]);

  // Desktop error event listener (from ContextMenu)
  useEffect(() => {
    const onError = (e: Event) => setErrorMsg((e as CustomEvent).detail || 'Unknown error');
    document.addEventListener('desktop-error', onError);
    return () => document.removeEventListener('desktop-error', onError);
  }, []);

  // Auto-clear error toast after 6 seconds
  useEffect(() => {
    if (!errorMsg) return;
    const t = setTimeout(() => setErrorMsg(''), 6000);
    return () => clearTimeout(t);
  }, [errorMsg]);

  const apply = (id: string, fit?: string) => {
    const wp = WALLPAPERS.find((w) => w.id === id) || customWps.find((w) => w.id === id);
    if (!wp) return;
    const el = document.getElementById('desktop-workspace');
    if (!el) return;
    const f = fit || wpFit;
    if ('type' in wp && wp.type === 'color') {
      el.style.background = `radial-gradient(ellipse at 50% 30%, ${lighten(wp.value, 30)} 0%, ${wp.value} 70%)`;
      el.style.backgroundSize = '';
      el.style.backgroundRepeat = '';
      el.style.backgroundPosition = '';
    } else {
      const pos = f === 'center' ? 'center center' : 'center';
      const size = f === 'cover' ? 'cover' : f === 'contain' ? 'contain' : f === 'stretch' ? '100% 100%' : f === 'repeat' ? 'auto' : 'cover';
      const repeat = f === 'repeat' ? 'repeat' : 'no-repeat';
      el.style.background = `url('${wp.value}') ${pos} / ${size} ${repeat}`;
    }
    localStorage.setItem('cb-wallpaper', id);
  };

  const setWallpaperFit = (fit: string) => {
    setWpFit(fit);
    localStorage.setItem('cb-wallpaper-fit', fit);
    const saved = localStorage.getItem('cb-wallpaper');
    if (saved) apply(saved, fit);
  };

  const closePicker = () => setWpPicker(false);
  const selectWp = (id: string) => {
    const wp = WALLPAPERS.find((w) => w.id === id) || customWps.find((w) => w.id === id);
    if (!wp) return;
    apply(id);
    if ('source' in wp && wp.source) {
      setWpSource({ name: wp.name, url: wp.source });
    } else {
      setWpSource(null);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !wpDir) return;
    setUploading(true);
    try {
      // Ensure wallpaper directory exists
      await api.post('/files/mkdir', { path: wpDir }).catch(() => {});
      // Upload file to server
      const form = new FormData();
      form.append('file', file);
      form.append('path', wpDir);
      const result = await api.post<{ path: string }>('/files/upload', form, true);
      const id = 'custom-' + Date.now();
      const name = file.name.replace(/\.[^.]+$/, '').substring(0, 30);
      // Fetch the uploaded image and create a blob URL
      const blobUrl = await fetchBlobUrl({ id, path: result.path });
      if (!blobUrl) throw new Error('Failed to load uploaded image');
      const entry = { id, name, path: result.path, value: blobUrl };
      const updated = [...customWps, entry];
      setCustomWps(updated);
      localStorage.setItem('cb-custom-wallpapers', JSON.stringify(updated.map(w => ({ id: w.id, name: w.name, path: w.path, value: '' }))));
      apply(id);
    } catch (err) {
      setErrorMsg('Upload failed: ' + (err instanceof Error ? err.message : ''));
    }
    setUploading(false);
    if (uploadRef.current) uploadRef.current.value = '';
  };

  const removeCustomWp = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const wp = customWps.find(w => w.id === id);
    if (!wp) return;
    // Delete file from server
    try { await api.post('/files/remove', { path: wp.path }); } catch {}
    // Clean up blob URL
    const blobUrl = wallpaperCache.current.get(id);
    if (blobUrl) { URL.revokeObjectURL(blobUrl); wallpaperCache.current.delete(id); }
    // Remove from state and localStorage
    const updated = customWps.filter(w => w.id !== id);
    setCustomWps(updated);
    localStorage.setItem('cb-custom-wallpapers', JSON.stringify(updated.map(w => ({ id: w.id, name: w.name, path: w.path, value: '' }))));
    // If removed the current wallpaper, revert to default
    const saved = localStorage.getItem('cb-wallpaper');
    if (saved === id) {
      localStorage.removeItem('cb-wallpaper');          selectWp('cloudbanana');
    }
  };

  const openItem = (name: string, isDir: boolean) => {
    const itemPath = desktopDir + '/' + name;
    if (isDir) {
      const id = 'fm-' + Date.now();
      openWindow(id, 'File Manager', { path: itemPath });
    } else {
      openFileDirect(itemPath, name);
    }
  };

  const openFileDirect = (itemPath: string, name: string) => {
    if (isImage(name) || isVideo(name)) {
      openWindow('media-' + Date.now(), 'BPlayer', { path: itemPath });
      return;
    }
    if (isWebFile(name)) {
      openWindow('web-' + Date.now(), 'WebView — ' + name, { path: itemPath });
      return;
    }
    if (isBnoteFile(name)) {
      openWindow('bnote-' + Date.now(), 'Bnote — ' + name, { path: itemPath });
      return;
    }
    // For other files, open the directory in File Manager so user can handle it from there
    const parentDir = itemPath.substring(0, itemPath.lastIndexOf('/')) || '/';
    openWindow('fm-' + Date.now(), 'File Manager', { path: parentDir });
  };

  const handleIconContext = (e: MouseEvent, name: string, isDir: boolean, pinnedId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    iconMenuRef.current = true;
    const dm = document.getElementById('desktop-menu');
    if (dm) dm.style.display = 'none';
    setIconMenu({ x: e.clientX, y: e.clientY, name, isDir, pinnedId });
  };

  const deleteItem = () => {
    if (!iconMenu) return;
    // Pinned items cannot be deleted
    if (iconMenu.pinnedId) {
      setIconMenu(null);
      return;
    }
    setDeleteTarget({ name: iconMenu.name, isDir: iconMenu.isDir });
    setFolderNotEmpty(false);
    setIconMenu(null);
    if (iconMenu.isDir) {
      api.get('/files?path=' + encodeURIComponent(desktopDir + '/' + iconMenu.name))
        .then((data: any) => {
          if (data.items && data.items.length > 0) {
            setFolderNotEmpty(true);
          }
        }).catch(() => {});
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.post('/files/remove', { path: desktopDir + '/' + deleteTarget.name });
      setDeleteTarget(null);
      loadDesktop();
    } catch (e) {
      setErrorMsg('Delete error: ' + (e instanceof Error ? e.message : ''));
      setDeleteTarget(null);
    }
  };

  const startRename = () => {
    if (!iconMenu) return;
    setRenameValue(iconMenu.name);
    setRenameTarget(iconMenu.name);
    setIconMenu(null);
  };

  const doRename = async () => {
    if (!renameTarget || !renameValue.trim() || renameValue.trim() === renameTarget) {
      setRenameTarget(null);
      return;
    }
    try {
      await api.post('/files/rename', { path: desktopDir + '/' + renameTarget, new_name: renameValue.trim() });
      setRenameTarget(null);
      loadDesktop();
    } catch (e) {
      setErrorMsg('Rename error: ' + (e instanceof Error ? e.message : ''));
    }
  };

  const showProps = () => {
    if (!iconMenu) return;
    setPropsTarget({ name: iconMenu.name, isDir: iconMenu.isDir });
    setIconMenu(null);
  };

  const copyItem = () => {
    if (!iconMenu) return;
    setClipboard({ path: desktopDir + '/' + iconMenu.name, cut: false });
    setIconMenu(null);
  };

  const cutItem = () => {
    if (!iconMenu) return;
    setClipboard({ path: desktopDir + '/' + iconMenu.name, cut: true });
    setIconMenu(null);
  };

  const pasteItem = async () => {
    if (!clipboard) return;
    const src = clipboard.path;
    const name = src.split('/').pop();
    const dest = desktopDir + '/' + name;
    if (src === dest) {
      setErrorMsg('Source and destination are the same');
      return;
    }
    try {
      if (clipboard.cut) {
        await api.post('/files/move', { path: src, dest });
      } else {
        await api.post('/files/copy', { path: src, dest });
      }
      setClipboard(null);
      loadDesktop();
    } catch (e) {
      setErrorMsg('Paste error: ' + (e instanceof Error ? e.message : ''));
    }
  };

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    if ((e.target as HTMLElement).closest('.desktop-icon-wrapper, .desktop-icon')) return;
    setIconMenu(null);
    const el = document.getElementById('desktop-menu');
    if (!el) return;
    el.style.display = 'block';
    const w = el.offsetWidth, h = el.offsetHeight;
    el.style.left = Math.min(e.clientX, window.innerWidth - w) + 'px';
    el.style.top = Math.min(e.clientY, window.innerHeight - h) + 'px';
  };

  const handleWorkspaceClick = () => {
    const el = document.getElementById('desktop-menu');
    if (el) el.style.display = 'none';
    setIconMenu(null);
    setPropsTarget(null);
    setRenameTarget(null);
    useDesktopStore.getState().closeStartMenu();
  };

  return (
    <div id="desktop">
      <div id="desktop-workspace" onContextMenu={handleContextMenu} onClick={handleWorkspaceClick}>
        <div className="desktop-toolbar">
          <button className="dt-btn" onClick={() => { const h = !showHidden; setShowHidden(h); loadDesktop(); }}
            title={showHidden ? 'Hide hidden files' : 'Show hidden files'}>
            {showHidden ? <EyeOff size={13} /> : <Eye size={13} />}
            {showHidden ? 'Hide Hidden' : 'Show Hidden'}
          </button>
          {clipboard && (
            <button className="dt-btn dt-paste-btn" onClick={pasteItem}>
              <ClipboardPaste size={13} /> Paste
            </button>
          )}
        </div>
        <div className="desktop-icons" onClick={() => { setRenameTarget(null); setPropsTarget(null); }}>
          {/* Pinned / Virtual icons */}
          {PINNED_ITEMS.map((p) => (
            <div key={p.id} className="desktop-icon-wrapper" data-pinned="true">
              <button className="desktop-icon"
                onClick={p.action}
                onContextMenu={(e) => handleIconContext(e, p.name, false, p.id)}
                title={p.name}>
                <div className="di-icon di-pinned" style={{ color: 'rgba(255,255,255,0.9)' }}>
                  <FmPinnedIcon />
                </div>
                <span className="di-name">{p.name}</span>
              </button>
            </div>
          ))}
          {desktopItems.map((item) => (
            <div key={item.name} className="desktop-icon-wrapper">
              {renameTarget === item.name ? (
                <div className="desktop-icon" onDoubleClick={(e) => e.stopPropagation()}>
                  {item.is_dir ? (
                    <div className="di-icon di-folder"><Folder size={34} /></div>
                  ) : (
                    <div className="di-icon di-file"><File size={34} /></div>
                  )}
                  <input className="desktop-rename-input" autoFocus value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') doRename();
                      if (e.key === 'Escape') setRenameTarget(null);
                    }}
                    onBlur={() => doRename()}
                    onClick={(e) => e.stopPropagation()} />
                </div>
              ) : (
                <button className="desktop-icon"
                  onClick={(e) => {
                    const now = Date.now();
                    const last = desktopLastClick.current[item.name] || 0;
                    desktopLastClick.current[item.name] = now;
                    if (now - last < 400) {
                      openItem(item.name, item.is_dir);
                    }
                  }}
                  onContextMenu={(e) => handleIconContext(e, item.name, item.is_dir)}
                  title={item.is_dir ? 'Open in File Manager' : 'Open in editor'}>
                  {item.is_dir ? (
                    <div className="di-icon di-folder">
                      <Folder size={34} />
                    </div>
                  ) : (
                    <div className={`di-icon di-file di-ext-${(item.name.split('.').pop() || 'file').toLowerCase()}`}>
                      <File size={34} />
                      <span className="di-ext-label">{item.name.includes('.') ? item.name.split('.').pop() : ''}</span>
                    </div>
                  )}
                  <span className="di-name">{item.is_dir ? item.name : item.name.replace(/\.([^.]+)$/, '')}</span>
                  {!item.is_dir && item.name.includes('.') && (
                    <span className="di-ext">.{item.name.split('.').pop()}</span>
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
        {children}
      </div>

      {/* Icon context menu */}
      {iconMenu && (
        <div className="ctx-menu" style={{ left: iconMenu.x, top: iconMenu.y }}
          onClick={() => setIconMenu(null)}>
          {iconMenu.pinnedId ? (
            <>
              <button className="ctx-item" onClick={(e) => {
                e.stopPropagation();
                const p = PINNED_ITEMS.find(i => i.id === iconMenu.pinnedId);
                if (p) p.action();
                setIconMenu(null);
              }}>
                <Folder size={14} /> Open
              </button>
              <div className="ctx-sep" />
              <button className="ctx-item" onClick={(e) => { e.stopPropagation(); loadDesktop(); document.dispatchEvent(new CustomEvent('fm-refresh-all')); setIconMenu(null); }}>
                <RefreshCw size={14} /> Refresh
              </button>
            </>
          ) : (
            <>
              <button className="ctx-item" onClick={(e) => { e.stopPropagation(); startRename(); }}>
                <Edit3 size={14} /> Rename
              </button>
              <button className="ctx-item" onClick={(e) => { e.stopPropagation(); copyItem(); }}>
                <Copy size={14} /> Copy
              </button>
              <button className="ctx-item" onClick={(e) => { e.stopPropagation(); cutItem(); }}>
                <Scissors size={14} /> Cut
              </button>
              <button className="ctx-item" onClick={(e) => { e.stopPropagation(); loadDesktop(); setIconMenu(null); }}>
                <RefreshCw size={14} /> Refresh
              </button>
              <button className="ctx-item" onClick={(e) => { e.stopPropagation(); showProps(); }}>
                <Info size={14} /> Properties
              </button>
              <div className="ctx-sep" />
              <button className="ctx-item ctx-danger" onClick={(e) => { e.stopPropagation(); deleteItem(); }}>
                <Trash2 size={14} /> Delete
              </button>
            </>
          )}
        </div>
      )}

      {/* Properties modal */}
      {propsTarget && (
        <div className="modal-overlay" onClick={() => setPropsTarget(null)}>
          <div className="modal-box" style={{ width: 320 }}>
            <div className="modal-title">
              {propsTarget.isDir ? <Folder size={16} /> : <File size={16} />}
              {' '}{propsTarget.name}
            </div>
            <div className="st-content" style={{ margin: '0.75rem 0' }}>
              <h3>{propsTarget.isDir ? 'Folder' : 'File'}</h3>
              <p>Location: {desktopDir}</p>
              <p>Full path: {desktopDir}/{propsTarget.name}</p>
            </div>
            <div className="modal-actions">
              <button className="modal-btn modal-btn-primary" onClick={() => setPropsTarget(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setDeleteTarget(null)}>
          <div className="modal-box" style={{ maxWidth: 380 }}>
            <div className="modal-title">Confirm Delete</div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.5rem 0' }}>
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
            </p>
            {folderNotEmpty && (
              <p style={{ fontSize: '0.78rem', color: 'var(--danger)', margin: '0.3rem 0 0' }}>
                Folder is not empty. Continue delete?
              </p>
            )}
            <div className="modal-actions">
              <button className="modal-btn modal-btn-cancel" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="modal-btn modal-btn-danger" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <ContextMenu />

      {wpPicker && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { closePicker(); setWpSource(null); } }}>
          <div className={`modal-box wp-picker${wpMaximized ? ' wp-maximized' : ''}`}>
            <div className="win-header" style={{ padding:'0.3rem 0.65rem', cursor:'default' }}>
              <div className="win-actions" onMouseDown={(e) => e.stopPropagation()}>
                <button className="win-btn win-close" onClick={(e) => { e.stopPropagation(); closePicker(); setWpSource(null); }}
                  title="Close"><X size={13} /></button>
                <button className="win-btn win-min" onClick={(e) => { e.stopPropagation(); closePicker(); setWpSource(null); }}
                  title="Minimize"><Minus size={13} /></button>
                <button className={`win-btn win-max${wpMaximized ? ' win-max-active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); setWpMaximized(!wpMaximized); }}
                  title={wpMaximized ? 'Restore' : 'Maximize'}><Square size={11} /></button>
              </div>
              <span className="win-title">Change Wallpaper</span>
            </div>
            <div className="wp-picker-scroll">
              <div className="wp-section-label">Brand</div>
              <div className="wp-images">
                {WALLPAPERS.filter((w) => w.id === 'cloudbanana').map((w) => (
                  <button key={w.id} className="wp-img-btn"
                    style={{ backgroundImage: `url('${w.value}')` }} onClick={() => selectWp(w.id)}>
                    <span className="wp-img-label">{w.name}</span>
                  </button>
                ))}
              </div>
              <div className="wp-section-label" style={{ marginTop: '0.75rem' }}>Nature</div>
              <div className="wp-images">
                {WALLPAPERS.filter((w) => w.type === 'image' && ['Mountains','Forest','Mountain Lake','Aurora','Tropical Beach','Waterfall','Sunset Field','Snowy Peak'].includes(w.name)).map((w) => (
                  <button key={w.id} className="wp-img-btn"
                    style={{ backgroundImage: `url('${w.value}')` }} onClick={() => selectWp(w.id)}>
                    <span className="wp-img-label">{w.name}</span>
                  </button>
                ))}
              </div>
              <div className="wp-section-label" style={{ marginTop: '0.75rem' }}>Galaxy & Space</div>
              <div className="wp-images">
                {WALLPAPERS.filter((w) => w.type === 'image' && ['Milky Way','Starfield','Nebula','Full Moon'].includes(w.name)).map((w) => (
                  <button key={w.id} className="wp-img-btn"
                    style={{ backgroundImage: `url('${w.value}')` }} onClick={() => selectWp(w.id)}>
                    <span className="wp-img-label">{w.name}</span>
                  </button>
                ))}
              </div>
              <div className="wp-section-label" style={{ marginTop: '0.75rem' }}>Technology</div>
              <div className="wp-images">
                {WALLPAPERS.filter((w) => w.type === 'image' && ['Code Screen','Server Room','Circuit Board','Workspace','Cyberpunk City'].includes(w.name)).map((w) => (
                  <button key={w.id} className="wp-img-btn"
                    style={{ backgroundImage: `url('${w.value}')` }} onClick={() => selectWp(w.id)}>
                    <span className="wp-img-label">{w.name}</span>
                  </button>
                ))}
              </div>
              <div className="wp-section-label" style={{ marginTop: '0.75rem' }}>Art & City</div>
              <div className="wp-images">
                {WALLPAPERS.filter((w) => w.type === 'image' && ['Silhouette','Abstract Art','City Night','Golden Bridge'].includes(w.name)).map((w) => (
                  <button key={w.id} className="wp-img-btn"
                    style={{ backgroundImage: `url('${w.value}')` }} onClick={() => selectWp(w.id)}>
                    <span className="wp-img-label">{w.name}</span>
                  </button>
                ))}
              </div>

              {/* Custom wallpapers */}
              {customWps.length > 0 && (
                <>
                  <div className="wp-section-label" style={{ marginTop: '0.75rem' }}>Uploaded Photos</div>
                  <div className="wp-images">
                    {customWps.map((w) => (
                      <button key={w.id} className="wp-img-btn"
                        style={{ backgroundImage: `url('${w.value}')` }} onClick={() => selectWp(w.id)}>
                        <span className="wp-custom-remove" onClick={(e) => removeCustomWp(w.id, e)}
                          title="Remove"><X size={12} /></span>
                        <span className="wp-img-label">{w.name}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Upload button */}
              <div className="wp-section-label" style={{ marginTop: '0.75rem' }}>Upload Photo</div>
              <div className="wp-upload-area">
                <input ref={uploadRef} type="file" accept="image/*" style={{ display:'none' }}
                  onChange={handleUpload} />
                <button className="wp-upload-btn" onClick={() => uploadRef.current?.click()}
                  disabled={uploading}>
                  <Upload size={18} />
                  {uploading ? 'Loading...' : 'Choose Image'}
                </button>
                <p className="wp-upload-hint">Recommended: 1920×1080 or larger</p>
              </div>
            </div>
            <div className="wp-fit-label">Position</div>
            <div className="wp-fit-selector">
              {WP_FITS_OPTIONS.map((f) => (
                <button key={f.id} className={`wp-fit-btn${wpFit === f.id ? ' active' : ''}`}
                  onClick={() => setWallpaperFit(f.id)}>
                  <span style={{ fontSize:'1rem', lineHeight:1 }}>{f.icon}</span>
                  <span>{f.label}</span>
                </button>
              ))}
            </div>
            {/* Error toast */}
      {errorMsg && (
        <div className="desktop-toast" onClick={() => setErrorMsg('')}>
          <span>{errorMsg}</span>
        </div>
      )}

        {wpSource && (
              <div className="wp-source">
                <span>Source: </span>
                <a href={wpSource.url} target="_blank" rel="noopener noreferrer">{wpSource.name}</a>
              </div>
            )}
          </div>
        </div>
      )}
      <Taskbar />
    </div>
  );
}

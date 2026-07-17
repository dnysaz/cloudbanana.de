import { useState, useEffect, useRef, useCallback } from 'react';
import { api, getToken } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { useDesktopStore } from '../../store/desktopStore';
import type { FileItem, DiskUsage } from '../../types';
import {
  Folder, File, ArrowLeft, Save, Plus, Trash2, FolderPlus, Home, X, RefreshCw,
  LayoutGrid, List, Code, ChevronRight, Copy, Scissors, ClipboardPaste, Check,
  Upload, Download, Edit3, Search, ExternalLink, Info, HardDrive, ChevronLeft,
  FolderOpen, FileText, Image, Film, Package, CheckSquare,
  Monitor, Disc3, Clock, Globe,
} from 'lucide-react';
import { getClipboard, setClipboard, listenClipboard } from '../../clipboard';

/** Extension metadata: color, background, and label for each file type */
const EXT_META: Record<string, { color: string; bg: string; label: string }> = {
  'txt':   { color: '#1e293b', bg: '#f1f5f9', label: 'txt' },
  'md':    { color: '#1e293b', bg: '#e2e8f0', label: 'md' },
  'log':   { color: '#fff', bg: '#64748b', label: 'log' },
  'csv':   { color: '#fff', bg: '#16a34a', label: 'csv' },
  'env':   { color: '#fff', bg: '#1d4ed8', label: 'env' },
  'cfg':   { color: '#fff', bg: '#4b5563', label: 'cfg' },
  'ini':   { color: '#fff', bg: '#4b5563', label: 'ini' },
  'conf':  { color: '#fff', bg: '#4b5563', label: 'conf' },
  'html':  { color: '#fff', bg: '#ea580c', label: 'html' },
  'htm':   { color: '#fff', bg: '#ea580c', label: 'htm' },
  'css':   { color: '#fff', bg: '#db2777', label: 'css' },
  'scss':  { color: '#fff', bg: '#db2777', label: 'scss' },
  'sass':  { color: '#fff', bg: '#db2777', label: 'sass' },
  'less':  { color: '#fff', bg: '#db2777', label: 'less' },
  'js':    { color: '#fff', bg: '#ca8a04', label: 'js' },
  'jsx':   { color: '#fff', bg: '#ca8a04', label: 'jsx' },
  'ts':    { color: '#fff', bg: '#2563eb', label: 'ts' },
  'tsx':   { color: '#fff', bg: '#2563eb', label: 'tsx' },
  'json':  { color: '#fff', bg: '#059669', label: 'json' },
  'xml':   { color: '#fff', bg: '#0d9488', label: 'xml' },
  'yaml':  { color: '#fff', bg: '#b45309', label: 'yaml' },
  'yml':   { color: '#fff', bg: '#b45309', label: 'yml' },
  'toml':  { color: '#fff', bg: '#b45309', label: 'toml' },
  'py':    { color: '#fff', bg: '#2563eb', label: 'py' },
  'rb':    { color: '#fff', bg: '#dc2626', label: 'rb' },
  'go':    { color: '#fff', bg: '#0891b2', label: 'go' },
  'rs':    { color: '#fff', bg: '#d97706', label: 'rs' },
  'c':     { color: '#fff', bg: '#4f46e5', label: 'c' },
  'cpp':   { color: '#fff', bg: '#4f46e5', label: 'cpp' },
  'cc':    { color: '#fff', bg: '#4f46e5', label: 'cc' },
  'cxx':   { color: '#fff', bg: '#4f46e5', label: 'cxx' },
  'h':     { color: '#fff', bg: '#6366f1', label: 'h' },
  'hpp':   { color: '#fff', bg: '#6366f1', label: 'hpp' },
  'java':  { color: '#fff', bg: '#dc2626', label: 'java' },
  'php':   { color: '#fff', bg: '#7c3aed', label: 'php' },
  'sh':    { color: '#fff', bg: '#16a34a', label: 'sh' },
  'bash':  { color: '#fff', bg: '#16a34a', label: 'bash' },
  'zsh':   { color: '#fff', bg: '#16a34a', label: 'zsh' },
  'pl':    { color: '#fff', bg: '#0284c7', label: 'pl' },
  'lua':   { color: '#fff', bg: '#0369a1', label: 'lua' },
  'swift': { color: '#fff', bg: '#f97316', label: 'swift' },
  'kt':    { color: '#fff', bg: '#7c3aed', label: 'kt' },
  'scala': { color: '#fff', bg: '#dc2626', label: 'scala' },
  'dart':  { color: '#fff', bg: '#0891b2', label: 'dart' },
  'pdf':   { color: '#fff', bg: '#dc2626', label: 'pdf' },
  'doc':   { color: '#fff', bg: '#2563eb', label: 'doc' },
  'docx':  { color: '#fff', bg: '#2563eb', label: 'docx' },
  'xls':   { color: '#fff', bg: '#16a34a', label: 'xls' },
  'xlsx':  { color: '#fff', bg: '#16a34a', label: 'xlsx' },
  'ppt':   { color: '#fff', bg: '#f97316', label: 'ppt' },
  'pptx':  { color: '#fff', bg: '#f97316', label: 'pptx' },
  'zip':   { color: '#fff', bg: '#d97706', label: 'zip' },
  'tar':   { color: '#fff', bg: '#92400e', label: 'tar' },
  'gz':    { color: '#fff', bg: '#92400e', label: 'gz' },
  'bz2':   { color: '#fff', bg: '#92400e', label: 'bz2' },
  'xz':    { color: '#fff', bg: '#92400e', label: 'xz' },
  'rar':   { color: '#fff', bg: '#92400e', label: 'rar' },
  '7z':    { color: '#fff', bg: '#92400e', label: '7z' },
  'mp3':   { color: '#fff', bg: '#16a34a', label: 'mp3' },
  'wav':   { color: '#fff', bg: '#059669', label: 'wav' },
  'flac':  { color: '#fff', bg: '#059669', label: 'flac' },
  'ogg':   { color: '#fff', bg: '#059669', label: 'ogg' },
  'aac':   { color: '#fff', bg: '#059669', label: 'aac' },
  'm4a':   { color: '#fff', bg: '#059669', label: 'm4a' },
  'mp4':   { color: '#fff', bg: '#7c3aed', label: 'mp4' },
  'avi':   { color: '#fff', bg: '#7c3aed', label: 'avi' },
  'mkv':   { color: '#fff', bg: '#7c3aed', label: 'mkv' },
  'webm':  { color: '#fff', bg: '#7c3aed', label: 'webm' },
  'mov':   { color: '#fff', bg: '#7c3aed', label: 'mov' },
  'wmv':   { color: '#fff', bg: '#7c3aed', label: 'wmv' },
};

function getExtMeta(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return EXT_META[ext];
}

function getExtLabel(name: string): string {
  const meta = getExtMeta(name);
  if (meta) return meta.label;
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return ext.substring(0, 4);
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString([], { month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' }); }
  catch { return iso; }
}

function getFileType(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const img = ['png','jpg','jpeg','gif','svg','webp','bmp','ico'];
  const vid = ['mp4','avi','mkv','webm','mov','wmv'];
  const aud = ['mp3','wav','flac','ogg','aac','m4a'];
  const arc = ['zip','tar','gz','bz2','xz','rar','7z'];
  const code = ['js','ts','jsx','tsx','py','rb','go','rs','c','cpp','h','hpp','java','php','sh','bash','zsh','pl','lua','swift','kt','scala','dart'];
  const web = ['html','htm','css','scss','sass','less','json','xml','yaml','yml','toml','md'];
  const doc = ['txt','pdf','doc','docx','xls','xlsx','ppt','pptx','csv'];
  if (img.includes(ext)) return 'Image';
  if (vid.includes(ext)) return 'Video';
  if (aud.includes(ext)) return 'Audio';
  if (arc.includes(ext)) return 'Archive';
  if (code.includes(ext)) return 'Code';
  if (web.includes(ext)) return 'Web';
  if (doc.includes(ext)) return 'Document';
  return ext.toUpperCase() || 'File';
}

/** Render a file icon with extension badge for list view (16px) */
function FileIconList({ name, isDir }: { name: string; isDir: boolean; filePath?: string }) {
  if (isDir) return <Folder size={16} className="fm11-ico-dir" />;
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const meta = getExtMeta(name);

  const IMG = ['png','jpg','jpeg','gif','svg','webp','bmp','ico'];
  const VID = ['mp4','avi','mkv','webm','mov','wmv'];

  if (IMG.includes(ext)) {
    // For image files in list view, show tiny colored dot + Image icon
    return (
      <span className="fm11-ext-badge" style={{ background: '#c084fc', color: '#fff', minWidth: 16, height: 16, borderRadius: 3, fontSize: 7, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Image size={10} />
      </span>
    );
  }
  if (VID.includes(ext)) {
    return (
      <span className="fm11-ext-badge" style={{ background: '#7c3aed', color: '#fff', minWidth: 16, height: 16, borderRadius: 3, fontSize: 7, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Film size={10} />
      </span>
    );
  }

  // Extension badge
  if (meta) {
    return (
      <span className="fm11-ext-badge" style={{ background: meta.bg, color: meta.color, minWidth: 22, height: 16, borderRadius: 3, fontSize: 7, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: '0 3px' }}>
        {meta.label}
      </span>
    );
  }

  // Fallback for unknown extensions
  const label = getExtLabel(name);
  return (
    <span className="fm11-ext-badge" style={{ background: '#6b7280', color: '#fff', minWidth: 22, height: 16, borderRadius: 3, fontSize: 7, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: '0 3px' }}>
      {label}
    </span>
  );
}

/** Render a file icon card for grid view (larger, with thumbnail support) */
function FileIconGrid({ name, isDir, filePath }: { name: string; isDir: boolean; filePath?: string }) {
  if (isDir) return <Folder size={36} className="fm11-ico-dir" />;
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const meta = getExtMeta(name);

  const IMG = ['png','jpg','jpeg','gif','svg','webp','bmp','ico'];
  const VID = ['mp4','avi','mkv','webm','mov','wmv'];

  if (IMG.includes(ext) && filePath) {      const token = getToken();
    const imgUrl = `/api/v1/files/raw?path=${encodeURIComponent(filePath)}` + (token ? `&token=${token}` : '');
    return (
      <div className="fm11-ext-thumb-wrapper">
        <img src={imgUrl} alt="" className="fm11-ext-thumb" loading="lazy" />
      </div>
    );
  }

  if (VID.includes(ext)) {
    return (
      <div className="fm11-ext-card" style={{ background: '#7c3aed', color: '#fff' }}>
        <Film size={20} />
        <span className="fm11-ext-card-label">{ext}</span>
      </div>
    );
  }

  // Extension card
  if (meta) {
    return (
      <div className="fm11-ext-card" style={{ background: meta.bg, color: meta.color }}>
        <span className="fm11-ext-card-label" style={{ fontSize: meta.label.length > 3 ? '0.65rem' : '0.85rem' }}>
          {meta.label}
        </span>
      </div>
    );
  }

  // Fallback
  const label = getExtLabel(name);
  return (
    <div className="fm11-ext-card" style={{ background: '#6b7280', color: '#fff' }}>
      <span className="fm11-ext-card-label" style={{ fontSize: label.length > 3 ? '0.65rem' : '0.85rem' }}>
        {label}
      </span>
    </div>
  );
}

function DriveIcon({ mount }: { mount: string }) {
  if (mount === '/') return <Disc3 size={18} className="fm11-side-icon-drive" />;
  if (mount.startsWith('/media') || mount.startsWith('/mnt')) return <Disc3 size={18} className="fm11-side-icon-drive" />;
  return <HardDrive size={18} className="fm11-side-icon-drive" />;
}

interface Props { winId?: string; winData?: Record<string, unknown>; }

export default function FileManager({ winId, winData }: Props) {
  const { user } = useAuthStore();
  const { openWindow, setWindowData, closeWindow } = useDesktopStore();
  const homeDir = user?.home || (user?.username === 'root' ? '/root' : '/home/' + (user?.username || 'root')) || '/root';
  const desktopDir = homeDir + '/Desktop';
  const isAdmin = user?.role === 'admin';

  const [path, setPath] = useState((winData?.path as string) || '');
  const [items, setItems] = useState<FileItem[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'date'>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [creating, setCreating] = useState<'file' | 'folder' | null>(null);
  const [newName, setNewName] = useState('');
  const [clipboard, setClipState] = useState(getClipboard());
  const [contextItem, setContextItem] = useState<{ name: string; isDir: boolean; x: number; y: number } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ name: string; path: string } | null>(null);
  const [emptyTrashConfirm, setEmptyTrashConfirm] = useState(false);
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (renameTarget) renameRef.current?.setSelectionRange?.(0, renameValue.length);
  }, [renameTarget]);
  const [saved, setSaved] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedSet, setSelectedSet] = useState<Set<string>>(new Set());
  const lastClickedName = useRef<string | null>(null);
  // Helper to toggle selection
  const toggleSelect = (name: string) => {
    setSelectedSet(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };
  const clearSelection = () => setSelectedSet(new Set());
  const selectOne = (name: string) => setSelectedSet(new Set([name]));
  const selectRange = (from: string, to: string) => {
    const names = sortedItems.map(i => i.name);
    const start = names.indexOf(from);
    const end = names.indexOf(to);
    if (start === -1 || end === -1) return;
    const [lo, hi] = start < end ? [start, end] : [end, start];
    setSelectedSet(new Set(names.slice(lo, hi + 1)));
  };
  // Extract modal state
  const [extractTarget, setExtractTarget] = useState<{ name: string; path: string } | null>(null);
  const [extractMsg, setExtractMsg] = useState('');
  const [debInstallTarget, setDebInstallTarget] = useState<{ name: string; path: string } | null>(null);
  const [propsTarget, setPropsTarget] = useState<{ name: string; isDir: boolean; size?: number; modified?: string } | null>(null);
  const lastClickTime = useRef<Record<string, number>>({});
  const [disks, setDisks] = useState<DiskUsage[]>([]);
  const [landing, setLanding] = useState(!winData?.path);
  const [diskPropsOpen, setDiskPropsOpen] = useState(false);
  const [diskPropsTarget, setDiskPropsTarget] = useState<DiskUsage | null>(null);
  const [sidebarOpen] = useState(true);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const pickMode = winData?.pickMode === true;
  const pickDir = winData?.pickDir === true;
  const [loading, setLoading] = useState<{ active: boolean; message: string }>({ active: false, message: '' });

  useEffect(() => {
    const token = getToken();
    fetch('/api/v1/system/stats', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    }).then(r => r.json()).then(data => {
      if (data.disks) setDisks(data.disks);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    return listenClipboard((data) => setClipState(data));
  }, []);

  const loadFiles = useCallback(async (p: string) => {
    if (!p) return;
    setError('');
    setContextItem(null);
    setLanding(false);
    try {
      const data = await api.get<{ path: string; items: FileItem[] }>('/files?path=' + encodeURIComponent(p));
      setPath(data.path);
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);

  const isTrashView = (path || '').startsWith('/etc/cloudbanana/trash/') || (path || '').includes('/.trash');
  const initialPath = winData?.path as string | undefined;
  const firstLoadDone = useRef(false);
  useEffect(() => {
    if (firstLoadDone.current) return;
    firstLoadDone.current = true;
    if (initialPath) { loadFiles(initialPath); }
  }, []);

  useEffect(() => {
    if (winId) setWindowData(winId, { path });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, winId]);

  useEffect(() => {
    const createHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.path) {
        const targetPath = detail.path;
        const p = targetPath.substring(0, targetPath.lastIndexOf('/'));
        loadFiles(p || '/');
        setTimeout(() => openEditor(targetPath), 100);
      }
    };
    document.addEventListener('fm-create', createHandler as EventListener);
    return () => { document.removeEventListener('fm-create', createHandler as EventListener); };
  }, []);

  useEffect(() => {
    const openHandler = (e: Event) => {
      const p = (e as CustomEvent).detail?.path;
      if (p) openEditor(p);
    };
    document.addEventListener('fm-open-file', openHandler as EventListener);
    return () => { document.removeEventListener('fm-open-file', openHandler as EventListener); };
  }, []);

  useEffect(() => {
    const navHandler = (e: Event) => {
      const p = (e as CustomEvent).detail?.path;
      if (p) loadFiles(p);
    };
    document.addEventListener('fm-navigate', navHandler as EventListener);
    return () => { document.removeEventListener('fm-navigate', navHandler as EventListener); };
  }, []);

  // Listen for global refresh events (dispatched by desktop refresh and others)
  useEffect(() => {
    const refreshHandler = () => {
      if (path) {
        setLoading({ active: true, message: 'Refreshing...' });
        loadFiles(path).finally(() => setLoading({ active: false, message: '' }));
      }
    };
    document.addEventListener('fm-refresh-all', refreshHandler);
    return () => document.removeEventListener('fm-refresh-all', refreshHandler);
  }, [path]);

  const IMG_EXTS = ['png','jpg','jpeg','gif','svg','webp','bmp','ico'];
  const VID_EXTS = ['mp4','avi','mkv','webm','mov','wmv'];
  const WEB_EXTS = ['html','htm','php','phtml','php3','php4','php5'];
  const BNOTE_EXTS = ['txt','json','md','log','csv','env','cfg','ini','conf','yaml','yml','xml','toml'];

  const isImage = (name: string) => IMG_EXTS.includes(name.split('.').pop()?.toLowerCase() || '');
  const isVideo = (name: string) => VID_EXTS.includes(name.split('.').pop()?.toLowerCase() || '');
  const CODE_EXTS = ['js','jsx','mjs','ts','tsx','py','pyw','rb','go','rs','c','h','cpp','cc','cxx','hpp','java','kt','swift','dart','sh','bash','zsh','dockerfile'];
  const isBnoteFile = (name: string) => BNOTE_EXTS.includes(name.split('.').pop()?.toLowerCase() || '');
  const isWebFile = (name: string) => WEB_EXTS.includes(name.split('.').pop()?.toLowerCase() || '');
  const isCodeFile = (name: string) => CODE_EXTS.includes(name.split('.').pop()?.toLowerCase() || '');

  const openEditor = async (p: string) => {
    const name = p.split('/').pop() || p;
    if (isImage(name) || isVideo(name)) {
      openWindow('media-' + Date.now(), 'BPlayer', { path: p });
      return;
    }
    if (isWebFile(name)) {
      openWindow('web-' + Date.now(), 'WebView — ' + name, { path: p });
      return;
    }
    if (isBnoteFile(name)) {
      openWindow('bnote-' + Date.now(), 'Bnote — ' + name, { path: p });
      return;
    }
    if (isCodeFile(name)) {
      openWindow('code-editor-' + Date.now(), 'Code — ' + name, { path: p });
      return;
    }
    try {
      const data = await api.post<{ content: string }>('/files/read', { path: p });
      setEditing(p);
      setEditorContent(data.content);
    } catch (e) { setError('Error: ' + (e instanceof Error ? e.message : '')); }
  };

  const saveEditor = async () => {
    if (!editing) return;
    try {
      await api.post('/files/write', { path: editing, content: editorContent });
      setError('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { setError('Error: ' + (e instanceof Error ? e.message : '')); }
  };

  const createItem = async () => {
    if (!newName) return;
    setLoading({ active: true, message: 'Creating...' });
    try {
      const p = path.replace(/\/$/, '') + '/' + newName;
      if (creating === 'folder') {
        await api.post('/files/mkdir', { path: p });
      } else {
        await api.post('/files/write', { path: p, content: '' });
      }
      setCreating(null);
      setNewName('');
      await loadFiles(path);
    } catch (e) { setError('Error: ' + (e instanceof Error ? e.message : '')); }
    setLoading({ active: false, message: '' });
  };

  const emptyTrash = async () => {
    setEmptyTrashConfirm(false);
    setLoading({ active: true, message: 'Emptying trash...' });
    try {
      await api.post('/trash/empty', {});
      await loadFiles(path);
    } catch (e) { setError('Error: ' + (e instanceof Error ? e.message : '')); }
    setLoading({ active: false, message: '' });
  };

  const restoreItem = async (name: string) => {
    setLoading({ active: true, message: 'Restoring...' });
    try {
      const itemPath = path.replace(/\/$/, '') + '/' + name;
      await api.post<{ restored_to: string }>('/trash/restore', { path: itemPath });
      setContextItem(null);
      await loadFiles(path);
    } catch (e) { setError('Error: ' + (e instanceof Error ? e.message : '')); }
    setLoading({ active: false, message: '' });
  };

  const deleteItem = async () => {
    if (!deleteTarget) return;
    const action = isTrashView ? 'Deleting permanently...' : 'Moving to trash...';
    setLoading({ active: true, message: action });
    try {
      await api.post('/files/remove', { path: deleteTarget.path });
      setDeleteTarget(null);
      await loadFiles(path);
    } catch (e) { setError('Error: ' + (e instanceof Error ? e.message : '')); }
    setLoading({ active: false, message: '' });
  };

  const navigate = (name: string) => {
    loadFiles(path.replace(/\/$/, '') + '/' + name);
  };

  const goUp = () => {
    const parts = path.replace(/\/$/, '').split('/');
    parts.pop();
    loadFiles(parts.join('/') || '/');
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    setError('');
    const form = new FormData();
    form.append('file', files[0]);
    form.append('path', path);
    try {
      await api.post('/files/upload', form, true);
      await loadFiles(path);
    } catch (e) {
      setError('Upload error: ' + (e instanceof Error ? e.message : ''));
    }
    setUploading(false);
    if (uploadRef.current) uploadRef.current.value = '';
  };

  const sortedItems = [...items]
    .filter(it => !filterText || it.name.toLowerCase().includes(filterText.toLowerCase()))
    .sort((a, b) => {
    if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
    let cmp = 0;
    if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
    else if (sortBy === 'size') cmp = a.size - b.size;
    else cmp = a.modified.localeCompare(b.modified);
    return sortAsc ? cmp : -cmp;
  });

  const breadcrumbs = path.split('/').filter(Boolean);

  const handleItemClick = (e: React.MouseEvent, name: string, isDir: boolean) => {
    e.stopPropagation();
    const now = Date.now();
    const last = lastClickTime.current[name] || 0;
    lastClickTime.current[name] = now;
    const fullPath = path.replace(/\/$/, '') + '/' + name;

    // Pick mode: single click selects, double-click confirms selection
    if (pickMode) {
      if (isDir) {
        if (now - last < 400) {
          navigate(name);
        } else {
          selectOne(name);
          lastClickedName.current = name;
        }
      } else {
        selectOne(name);
        lastClickedName.current = name;
        // Double-click in pick mode = confirm selection
        if (now - last < 400) {
          document.dispatchEvent(new CustomEvent('fm-file-picked', { detail: { path: fullPath } }));
        }
      }
      return;
    }

    // Double-click detection
    if (now - last < 400) {
      // If it's a .zip file, show extract modal
      if (!isDir && name.toLowerCase().endsWith('.zip')) {
        selectOne(name);
        setExtractTarget({ name, path: fullPath });
        return;
      }
      // If it's a .deb file, show install confirmation
      if (!isDir && name.toLowerCase().endsWith('.deb')) {
        selectOne(name);
        setDebInstallTarget({ name, path: fullPath });
        return;
      }
      if (isDir) {
        navigate(name);
      } else {
        openEditor(fullPath);
      }
      return;
    }

    // Multi-select with Ctrl/Cmd or Shift — or Select Mode
    if (selectMode || e.ctrlKey || e.metaKey) {
      toggleSelect(name);
      lastClickedName.current = name;
    } else if (e.shiftKey && lastClickedName.current) {
      selectRange(lastClickedName.current, name);
    } else {
      selectOne(name);
      lastClickedName.current = name;
    }
  };

  const handleWorkspaceClick = () => {
    clearSelection();
    setContextItem(null);
  };

  const handleItemContext = (e: React.MouseEvent, name: string, isDir: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    // Don't clear selection if right-clicking on an already-selected item
    if (!selectedSet.has(name)) {
      selectOne(name);
      lastClickedName.current = name;
    }
    setContextItem({ name, isDir, x: e.clientX, y: e.clientY });
  };

  const copyItem = (name: string) => {
    setClipboard({ path: path.replace(/\/$/, '') + '/' + name, cut: false });
    setContextItem(null);
  };

  const cutItem = (name: string) => {
    setClipboard({ path: path.replace(/\/$/, '') + '/' + name, cut: true });
    setContextItem(null);
  };

  const pasteItem = async () => {
    if (!clipboard) return;
    setLoading({ active: true, message: 'Pasting...' });
    const paths = clipboard.paths || [clipboard.path];
    try {
      for (const src of paths) {
        const name = src.split('/').pop();
        const dest = path.replace(/\/$/, '') + '/' + name;
        if (clipboard.cut) {
          await api.post('/files/move', { path: src, dest });
        } else {
          await api.post('/files/copy', { path: src, dest });
        }
      }
      setClipboard(null);
      await loadFiles(path);
    } catch (e) { setError('Error: ' + (e instanceof Error ? e.message : '')); }
    setLoading({ active: false, message: '' });
  };

  const startRename = (name: string) => {
    setRenameTarget(name);
    const dot = name.lastIndexOf('.');
    setRenameValue(dot > 0 ? name.slice(0, dot) : name);
    setContextItem(null);
  };

  const doRename = async () => {
    if (!renameTarget || !renameValue) { setRenameTarget(null); return; }
    const dot = renameTarget.lastIndexOf('.');
    const ext = dot > 0 ? renameTarget.slice(dot) : '';
    const finalName = renameValue + ext;
    if (finalName === renameTarget) { setRenameTarget(null); return; }
    const src = path.replace(/\/$/, '') + '/' + renameTarget;
    try {
      await api.post('/files/rename', { path: src, new_name: finalName });
      setRenameTarget(null);
      await loadFiles(path);
    } catch (e) { setError('Rename error: ' + (e instanceof Error ? e.message : '')); }
  };

  const compressItem = async (name: string) => {
    setLoading({ active: true, message: 'Compressing...' });
    const itemPath = path.replace(/\/$/, '') + '/' + name;
    try {
      await api.post('/files/compress', { path: itemPath });
      setContextItem(null);
      await loadFiles(path);
    } catch (e) { setError('Compress error: ' + (e instanceof Error ? e.message : '')); }
    setLoading({ active: false, message: '' });
  };

  const compressSelected = async () => {
    const selected = Array.from(selectedSet);
    if (selected.length < 2) return;
    setLoading({ active: true, message: 'Compressing...' });
    const paths = selected.map(name => path.replace(/\/$/, '') + '/' + name);
    try {
      await api.post('/files/compress-multi', { paths });
      clearSelection();
      await loadFiles(path);
    } catch (e) { setError('Compress error: ' + (e instanceof Error ? e.message : '')); }
    setLoading({ active: false, message: '' });
  };

  const copySelected = () => {
    const selected = Array.from(selectedSet);
    if (selected.length === 0) return;
    const paths = selected.map(name => path.replace(/\/$/, '') + '/' + name);
    setClipboard({ path: paths[0], paths, cut: false });
    setContextItem(null);
  };

  const cutSelected = () => {
    const selected = Array.from(selectedSet);
    if (selected.length === 0) return;
    const paths = selected.map(name => path.replace(/\/$/, '') + '/' + name);
    setClipboard({ path: paths[0], paths, cut: true });
    setContextItem(null);
  };

  const deleteSelected = async () => {
    const selected = Array.from(selectedSet);
    if (selected.length === 0) return;
    const name = selected.length === 1 ? selected[0] : `${selected.length} items`;
    setDeleteTarget({ name, path: '' });
    setContextItem(null);
  };

  const confirmDeleteSelected = async () => {
    if (!deleteTarget) return;
    const selected = Array.from(selectedSet);
    if (selected.length === 0) { setDeleteTarget(null); return; }
    setLoading({ active: true, message: 'Deleting...' });
    try {
      for (const name of selected) {
        const itemPath = path.replace(/\/$/, '') + '/' + name;
        await api.post('/files/remove', { path: itemPath });
      }
      clearSelection();
      setDeleteTarget(null);
      await loadFiles(path);
    } catch (e) {
      setError('Delete error: ' + (e instanceof Error ? e.message : ''));
      setDeleteTarget(null);
    }
    setLoading({ active: false, message: '' });
  };

  const doExtract = async () => {
    if (!extractTarget) return;
    setLoading({ active: true, message: 'Extracting...' });
    setExtractMsg('');
    try {
      await api.post('/files/extract', { path: extractTarget.path });
      setExtractMsg('Extracted successfully!');
      await loadFiles(path);
      setTimeout(() => { setExtractTarget(null); setLoading({ active: false, message: '' }); setExtractMsg(''); }, 1500);
    } catch (e) {
      setExtractMsg('Error: ' + (e instanceof Error ? e.message : ''));
      setLoading({ active: false, message: '' });
    }
  };

  const extractItem = async (name: string) => {
    setLoading({ active: true, message: 'Extracting...' });
    const itemPath = path.replace(/\/$/, '') + '/' + name;
    try {
      await api.post('/files/extract', { path: itemPath });
      setContextItem(null);
      await loadFiles(path);
    } catch (e) { setError('Extract error: ' + (e instanceof Error ? e.message : '')); }
    setLoading({ active: false, message: '' });
  };

  const downloadItem = async (name: string) => {
    const itemPath = path.replace(/\/$/, '') + '/' + name;
    const token = getToken();
    setLoading({ active: true, message: 'Preparing download...' });
    try {
      const r = await fetch(`/api/v1/files/raw?path=${encodeURIComponent(itemPath)}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setError('Download error: ' + (e instanceof Error ? e.message : '')); }
    setLoading({ active: false, message: '' });
    setContextItem(null);
  };

  const startDelete = (itemPath: string, name: string) => {
    setDeleteTarget({ name, path: itemPath });
    setContextItem(null);
  };

  const openInNewWindow = (name: string) => {
    const itemPath = path.replace(/\/$/, '') + '/' + name;
    const id = 'fm-' + Date.now();
    openWindow(id, 'File Manager', { path: itemPath });
    setContextItem(null);
  };

  const showProps = (name: string, isDir: boolean) => {
    const item = items.find(i => i.name === name);
    setPropsTarget({
      name,
      isDir,
      size: item?.size,
      modified: item?.modified,
    });
    setContextItem(null);
  };

  const navigateToDrive = (mount: string) => {
    loadFiles(mount);
  };

  const closeNewMenu = () => setShowNewMenu(false);
  const singleSelected = selectedSet.size === 1 ? Array.from(selectedSet)[0] : null;

  if (editing) {
    return (
      <div className="fm11-editor">
        <div className="fm11-editor-toolbar">
          <div className="fm11-editor-info">
            <Code size={14} />
            <span className="fm11-editor-title">{editing}</span>
          </div>
          <div className="fm11-editor-actions">
            <button className="fm11-btn" onClick={() => setEditing(null)}><ArrowLeft size={13} /> Back</button>
            <button className={`fm11-btn primary${saved ? ' saved' : ''}`} onClick={saveEditor}>
              {saved ? <><Check size={13} /> Saved</> : <><Save size={13} /> Save</>}
            </button>
          </div>
        </div>
        <textarea value={editorContent} onChange={(e) => setEditorContent(e.target.value)}
          className="fm11-editor-input" spellCheck={false} />
      </div>
    );
  }

  return (
    <div className="fm11">
      <input ref={uploadRef} type="file" style={{ display:'none' }} onChange={handleUpload} />

      {/* ===== Menu Bar ===== */}
      <div className="fm11-menubar win-drag-area">
        <span className="fm11-menubar-title">File Manager</span>
        <div className="fm11-menubar-menu" onMouseLeave={() => setOpenMenu(null)}
          onMouseDown={(e) => e.stopPropagation()}>
          <button className={`fm11-menubar-btn${openMenu === 'File' ? ' open' : ''}`}
            onClick={() => setOpenMenu(openMenu === 'File' ? null : 'File')}
            onMouseEnter={() => openMenu && setOpenMenu('File')}>
            File
          </button>
          {openMenu === 'File' && (
            <div className="fm11-menubar-drop">
              <button className="fm11-menubar-item" onClick={() => { setCreating('folder'); setOpenMenu(null); }}>
                <FolderPlus size={14} /> New Folder
              </button>
              <button className="fm11-menubar-item" onClick={() => { setCreating('file'); setOpenMenu(null); }}>
                <Plus size={14} /> New File
              </button>
              <button className="fm11-menubar-item" onClick={() => { uploadRef.current?.click(); setOpenMenu(null); }}>
                <Upload size={14} /> Upload
              </button>
              <div className="fm11-menubar-sep" />
              <button className="fm11-menubar-item" onClick={async () => { setOpenMenu(null); setLoading({ active: true, message: 'Refreshing...' }); await loadFiles(path); setLoading({ active: false, message: '' }); }}>
                <RefreshCw size={14} /> Refresh
              </button>
            </div>
          )}
        </div>
        <div className="fm11-menubar-menu" onMouseLeave={() => setOpenMenu(null)}
          onMouseDown={(e) => e.stopPropagation()}>
          <button className={`fm11-menubar-btn${openMenu === 'About' ? ' open' : ''}`}
            onClick={() => setOpenMenu(openMenu === 'About' ? null : 'About')}
            onMouseEnter={() => openMenu === 'File' && setOpenMenu('About')}>
            About
          </button>
          {openMenu === 'About' && (
            <div className="fm11-menubar-drop" style={{ left:'auto', right:0 }}>
              <button className="fm11-menubar-item" onClick={() => { setOpenMenu(null); setAboutOpen(true); }}>
                <Info size={14} /> About File Manager
              </button>
            </div>
          )}
        </div>
        <span className="fm11-menubar-spacer" />
        {clipboard && !landing && (
          <span onMouseDown={(e) => e.stopPropagation()}>
            <button className="fm11-menubar-btn" onClick={pasteItem} title="Paste">
              <ClipboardPaste size={12} /> Paste
            </button>
            <div className="fm11-menubar-sep" />
          </span>
        )}

      </div>

      {/* ===== Command Bar ===== */}
      <div className="fm11-cmdbar">
        <div className="fm11-cmdbar-left">
          <button className="fm11-cmd-btn" onClick={goUp} title="Go up"><ChevronLeft size={16} /></button>
          <button className="fm11-cmd-btn" onClick={() => loadFiles(path)} title="Refresh"><RefreshCw size={14} /></button>
          <div className="fm11-addressbar">
            <div className="fm11-addressbar-content">
              {landing ? (
                <span style={{ display:'flex', alignItems:'center', gap:'0.3rem' }}>
                  <Monitor size={13} /> This Server
                </span>
              ) : (
                <>
                  <button className="fm11-addr-btn" onClick={() => { setLanding(true); setItems([]); setPath(''); }}
                    title="This Server">
                    <Monitor size={13} />
                  </button>
                  {breadcrumbs.map((part, i) => (
                    <span key={i} className="fm11-bread-part">
                      <ChevronRight size={10} className="fm11-bread-sep" />
                      <button onClick={() => loadFiles('/' + breadcrumbs.slice(0, i + 1).join('/'))}>
                        {part}
                      </button>
                    </span>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
        <div className="fm11-cmdbar-right">
          {showSearch ? (
            <div className="fm11-search-box">
              <Search size={12} />
              <input autoFocus type="text" placeholder="Search..." value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                onBlur={() => { if (!filterText) setShowSearch(false); }}
                onKeyDown={(e) => e.key === 'Escape' && setShowSearch(false)} />
            </div>
          ) : (
            <button className="fm11-cmd-btn" onClick={() => setShowSearch(true)} title="Search">
              <Search size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ===== Ribbon Toolbar ===== */}
      <div className="fm11-ribbon">
        <div className="fm11-ribbon-group" style={{ position:'relative' }}>
          {!landing && (
            <>
              <button className="fm11-ribbon-btn" onClick={() => setShowNewMenu(!showNewMenu)}
                title="New item">
                <Plus size={14} /> <span className="fm11-ribbon-lbl">New</span>
              </button>
              {showNewMenu && (
                <div className="fm11-dropdown" style={{ left:0, top:'100%' }}
                  onMouseLeave={closeNewMenu}>
                  <button className="fm11-dropdown-item" onClick={() => { setCreating('folder'); setShowNewMenu(false); }}>
                    <FolderPlus size={14} /> New Folder
                  </button>
                  <button className="fm11-dropdown-item" onClick={() => { setCreating('file'); setShowNewMenu(false); }}>
                    <FileText size={14} /> New File
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        <div className="fm11-ribbon-group">
          {!landing && singleSelected && (
            <button className="fm11-ribbon-btn" onClick={() => copyItem(singleSelected)}
              title="Copy"><Copy size={14} /> <span className="fm11-ribbon-lbl">Copy</span></button>
          )}
          {!landing && clipboard && (
            <button className="fm11-ribbon-btn" onClick={pasteItem} title="Paste">
              <ClipboardPaste size={14} /> <span className="fm11-ribbon-lbl">Paste</span>
            </button>
          )}
        </div>
        <div className="fm11-ribbon-group">
          {!landing && singleSelected && (
            <>
              <button className="fm11-ribbon-btn" onClick={() => startRename(singleSelected)}
                title="Rename"><Edit3 size={14} /> <span className="fm11-ribbon-lbl">Rename</span></button>
              <button className="fm11-ribbon-btn" onClick={() => downloadItem(singleSelected)}
                title="Download"><Download size={14} /> <span className="fm11-ribbon-lbl">Download</span></button>
              <button className="fm11-ribbon-btn" onClick={() => startDelete(path.replace(/\/$/, '') + '/' + singleSelected, singleSelected)}
                title="Delete"><Trash2 size={14} /> <span className="fm11-ribbon-lbl">Delete</span></button>
            </>
          )}
          {!landing && selectedSet.size >= 2 && (
            <button className="fm11-ribbon-btn" onClick={compressSelected}
              title="Compress selected to ZIP">
              <Package size={14} /> <span className="fm11-ribbon-lbl">Compress ({selectedSet.size})</span>
            </button>
          )}
        </div>
        <div className="fm11-ribbon-group">
          {!landing && (
            <button className={`fm11-ribbon-btn${selectMode ? ' active' : ''}`}
              onClick={() => { setSelectMode(!selectMode); if (selectMode) clearSelection(); }}
              title="Select mode: click files to toggle selection">
              <CheckSquare size={14} /> <span className="fm11-ribbon-lbl">Select</span>
            </button>
          )}
          {!landing && selectMode && items.length > 0 && (
            <button className="fm11-ribbon-btn" onClick={() => setSelectedSet(new Set(sortedItems.map(i => i.name)))}
              title="Select all files">
              <FolderOpen size={14} /> <span className="fm11-ribbon-lbl">All</span>
            </button>
          )}
          {!landing && selectMode && selectedSet.size > 0 && (
            <button className="fm11-ribbon-btn" onClick={clearSelection}
              title="Deselect all">
              <X size={14} /> <span className="fm11-ribbon-lbl">None</span>
            </button>
          )}
        </div>
        {pickMode && singleSelected && (
          <div className="fm11-ribbon-group">
            <button className="fm11-ribbon-btn" style={{ color: 'var(--accent)', fontWeight: 600 }}
              onClick={() => {
                const fullPath = path.replace(/\/$/, '') + '/' + singleSelected;
                document.dispatchEvent(new CustomEvent('fm-file-picked', { detail: { path: fullPath } }));
                if (winId) closeWindow(winId);
              }}
              title="Select this file">
              <Check size={14} /> <span className="fm11-ribbon-lbl">Select</span>
            </button>
          </div>
        )}
        <div className="fm11-ribbon-spacer" />
        <div className="fm11-ribbon-group">
          {isTrashView && items.length > 0 && (
            <button className="fm11-ribbon-btn" style={{ color: 'var(--danger)' }} onClick={() => setEmptyTrashConfirm(true)} title="Permanently empty trash">
              <Trash2 size={14} /> <span className="fm11-ribbon-lbl">Empty Trash</span>
            </button>
          )}
          {!landing && (
            <button className="fm11-ribbon-btn" onClick={() => uploadRef.current?.click()} title="Upload">
              {uploading ? '...' : <><Upload size={14} /> <span className="fm11-ribbon-lbl">Upload</span></>}
            </button>
          )}
          <button className="fm11-ribbon-btn" onClick={async () => { setLoading({ active: true, message: 'Refreshing...' }); await loadFiles(path); setLoading({ active: false, message: '' }); }} title="Refresh">
            <RefreshCw size={14} /> <span className="fm11-ribbon-lbl">Refresh</span>
          </button>
        </div>
        <div className="fm11-ribbon-group">
          <button className={`fm11-ribbon-btn${viewMode === 'list' ? ' active' : ''}`}
            onClick={() => setViewMode('list')} title="List view">
            <List size={14} />
          </button>
          <button className={`fm11-ribbon-btn${viewMode === 'grid' ? ' active' : ''}`}
            onClick={() => setViewMode('grid')} title="Grid view">
            <LayoutGrid size={14} />
          </button>
        </div>
      </div>

      {error && <div className="fm11-error">{error}</div>}

      {/* ===== Body ===== */}
      <div className="fm11-body">
        {/* Sidebar */}
        {sidebarOpen && (
          <div className="fm11-side">
            <div className="fm11-side-section">
              <div className="fm11-side-title">Quick Access</div>
              <button
                className={`fm11-side-item${landing ? ' active' : ''}`}
                onClick={() => { setLanding(true); setItems([]); setPath(''); }}>
                <Monitor size={15} /> This Server
              </button>
              <button
                className={`fm11-side-item ${path === desktopDir || path.startsWith(desktopDir + '/') ? 'active' : ''}`}
                onClick={() => loadFiles(desktopDir)}>
                <FolderOpen size={15} /> Desktop
              </button>
              <button
                className={`fm11-side-item ${path === homeDir || path.startsWith(homeDir + '/') ? 'active' : ''}`}
                onClick={() => loadFiles(homeDir)}>
                <Home size={15} /> Home
              </button>
              {isAdmin && (
              <button
                className={`fm11-side-item ${path === '/etc' || path.startsWith('/etc/') ? 'active' : ''}`}
                onClick={() => loadFiles('/etc')}>
                <Folder size={15} /> /etc
              </button>
            )}
            {isAdmin && (
              <button
                className={`fm11-side-item ${path === '/var/www' || path.startsWith('/var/www/') ? 'active' : ''}`}
                onClick={() => loadFiles('/var/www')}>
                <Globe size={15} /> /var/www
              </button>
            )}
            {isAdmin && (
              <button
                className={`fm11-side-item ${path === '/tmp' || path.startsWith('/tmp/') ? 'active' : ''}`}
                onClick={() => loadFiles('/tmp')}>
                <Clock size={15} /> /tmp
              </button>
            )}
            </div>

            <div className="fm11-side-section">
              <div className="fm11-side-title">This Server</div>
              {disks.length > 0 ? (
                disks.map((d, idx) => {
                  const isRoot = d.mount === '/';
                  const label = isRoot ? 'Local Disk (/)' : d.mount.split('/').pop() || d.mount;
                  const freePct = 100 - d.percent;
                  return (
                    <button key={idx} className="fm11-side-drive"
                      onClick={() => navigateToDrive(d.mount)}
                      onContextMenu={(e) => {
                        e.preventDefault(); e.stopPropagation();
                        setDiskPropsTarget(d); setDiskPropsOpen(true);
                      }}>
                      <DriveIcon mount={d.mount} />
                      <div className="fm11-side-drive-info">
                        <span className="fm11-side-drive-name">{label}</span>
                        <div className="fm11-side-drive-bar">
                          <div className="fm11-side-drive-used" style={{ width: d.percent + '%' }} />
                          <div className="fm11-side-drive-free" style={{ width: freePct + '%' }} />
                        </div>
                        <span className="fm11-side-drive-size">{fmtSize(d.free)} free</span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="fm11-side-item" style={{ fontSize:'0.65rem', color:'var(--text-muted)', cursor:'default' }}>
                  Loading drives...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="fm11-main" onClick={handleWorkspaceClick}>
          {/* Inline create */}
          {creating && (
            <div className="fm11-create">
              <span className="fm11-create-icon">
                {creating === 'folder' ? <FolderPlus size={14} /> : <Plus size={14} />}
              </span>
              <input autoFocus value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') createItem();
                  if (e.key === 'Escape') { setCreating(null); setNewName(''); }
                }}
                placeholder={creating === 'folder' ? 'folder name' : 'file name'} />
              <button className="fm11-btn primary small" onClick={createItem}>Create</button>
              <button className="fm11-btn small" onClick={() => { setCreating(null); setNewName(''); }}><X size={12} /></button>
            </div>
          )}

          {/* ===== LANDING: This Server ===== */}
          {landing && (
            <div className="fm11-landing">
              <div className="fm11-landing-header">
                <Monitor size={20} />
                <span>This Server</span>
              </div>
              <div className="fm11-landing-section">
                <div className="fm11-landing-section-title">Folders</div>
                <div className="fm11-landing-folders">
                  <button className="fm11-landing-folder" onClick={() => loadFiles(desktopDir)}>
                    <FolderOpen size={36} className="fm11-ico-dir" />
                    <span>Desktop</span>
                  </button>
                  <button className="fm11-landing-folder" onClick={() => loadFiles(homeDir)}>
                    <Home size={36} className="fm11-ico-dir" />
                    <span>Home</span>
                  </button>
                  {isAdmin && (
                    <button className="fm11-landing-folder" onClick={() => loadFiles('/etc')}>
                      <Folder size={36} className="fm11-ico-dir" />
                      <span>/etc</span>
                    </button>
                  )}
                  {isAdmin && (
                    <button className="fm11-landing-folder" onClick={() => loadFiles('/var/www')}>
                      <Globe size={36} className="fm11-ico-dir" />
                      <span>/var/www</span>
                    </button>
                  )}
                  {isAdmin && (
                    <button className="fm11-landing-folder" onClick={() => loadFiles('/tmp')}>
                      <Clock size={36} className="fm11-ico-dir" />
                      <span>/tmp</span>
                    </button>
                  )}
                </div>
              </div>
              <div className="fm11-landing-section">
                <div className="fm11-landing-section-title">Devices and Drives</div>
                <div className="fm11-landing-drives">
                  {disks.length > 0 ? (
                    disks.map((d, idx) => {
                      const isRoot = d.mount === '/';
                      const label = isRoot ? 'Local Disk' : d.mount.split('/').pop() || d.mount;
                      return (
                        <button key={idx} className="fm11-landing-drive"
                          onClick={() => navigateToDrive(d.mount)}
                          onContextMenu={(e) => {
                            e.preventDefault(); e.stopPropagation();
                            setDiskPropsTarget(d); setDiskPropsOpen(true);
                          }}>
                          <DriveIcon mount={d.mount} />
                          <div className="fm11-landing-drive-info">
                            <span className="fm11-landing-drive-name">{label}</span>
                            <span className="fm11-landing-drive-mount">({d.mount})</span>
                            <div className="fm11-landing-drive-bar">
                              <div className="fm11-landing-drive-used" style={{ width: d.percent + '%' }} />
                            </div>
                            <span className="fm11-landing-drive-size">{fmtSize(d.total)} total</span>
                            <span className="fm11-landing-drive-free">{fmtSize(d.free)} free</span>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="fm11-landing-empty">No drives found</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ===== FILE LIST ===== */}
          {!landing && (
            <div className="fm11-content">
              {/* Column headers */}
              <div className="fm11-list-header">
                <span className="fm11-col-name" onClick={() => { setSortBy('name'); setSortAsc(sortBy !== 'name' ? true : !sortAsc); }}>
                  Name {sortBy === 'name' && (sortAsc ? '▲' : '▼')}
                </span>
                <span className="fm11-col-size" onClick={() => { setSortBy('size'); setSortAsc(sortBy !== 'size' ? false : !sortAsc); }}>
                  Size {sortBy === 'size' && (sortAsc ? '▲' : '▼')}
                </span>
                <span className="fm11-col-type">Type</span>
                <span className="fm11-col-date" onClick={() => { setSortBy('date'); setSortAsc(sortBy !== 'date' ? false : !sortAsc); }}>
                  Modified {sortBy === 'date' && (sortAsc ? '▲' : '▼')}
                </span>
              </div>

              {/* List view */}
              {viewMode === 'list' ? (
                <div className="fm11-list">
                  {sortedItems.length === 0 ? (
                    <div className="fm11-empty">This folder is empty</div>
                  ) : (
                    sortedItems.map((item) => (
                      <div key={item.name} className={`fm11-row${selectedSet.has(item.name) ? ' selected' : ''}`}
                        onContextMenu={(e) => handleItemContext(e, item.name, item.is_dir)}
                        onClick={(e) => handleItemClick(e, item.name, item.is_dir)}
                        draggable={false}>
                        {renameTarget === item.name ? (
                          <span className="fm11-row-name">
                            <FileIconList name={item.name} isDir={item.is_dir} filePath={path + '/' + item.name} />
                            <input ref={renameRef} className="fm11-rename-input" autoFocus value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') doRename(); if (e.key === 'Escape') setRenameTarget(null); }}
                              onBlur={() => doRename()}
                              onClick={(e) => e.stopPropagation()} />
                          </span>
                        ) : (
                          <span className="fm11-row-name">
                            <FileIconList name={item.name} isDir={item.is_dir} filePath={path + '/' + item.name} />
                            <span className="fm11-row-label">{item.name}</span>
                          </span>
                        )}
                        <span className="fm11-row-size">{item.is_dir ? '—' : fmtSize(item.size)}</span>
                        <span className="fm11-row-type">{item.is_dir ? 'Folder' : getFileType(item.name)}</span>
                        <span className="fm11-row-date">{item.modified ? fmtDate(item.modified) : '—'}</span>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                /* Grid view */
                <div className="fm11-grid">
                  {sortedItems.length === 0 ? (
                    <div className="fm11-empty">This folder is empty</div>
                  ) : (
                    sortedItems.map((item) => (
                      <div key={item.name} className={`fm11-cell${selectedSet.has(item.name) ? ' selected' : ''}`}
                        onContextMenu={(e) => handleItemContext(e, item.name, item.is_dir)}
                        onClick={(e) => handleItemClick(e, item.name, item.is_dir)}>
                        {renameTarget === item.name ? (
                          <div className="fm11-cell-rename">
                            <FileIconGrid name={item.name} isDir={item.is_dir} filePath={path + '/' + item.name} />
                            <input ref={renameRef} className="fm11-rename-input" autoFocus value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') doRename(); if (e.key === 'Escape') setRenameTarget(null); }}
                              onBlur={() => doRename()}
                              onClick={(e) => e.stopPropagation()} />
                          </div>
                        ) : (
                          <button className="fm11-cell-icon">
                            <FileIconGrid name={item.name} isDir={item.is_dir} filePath={path + '/' + item.name} />
                          </button>
                        )}
                        {renameTarget !== item.name && (
                          <span className="fm11-cell-name">{item.name}</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ===== Pick Mode Selection Bar (floating bottom) ===== */}
      {pickMode && singleSelected && (
        <div className="fm-pick-bar">
          <div className="fm-pick-bar-info">
            {isImage(singleSelected) ? <Image size={16} /> : <File size={16} />}
            <span className="fm-pick-bar-name">{singleSelected}</span>
          </div>
          <div className="fm-pick-bar-actions">
            <button className="fm-btn small" onClick={() => { clearSelection(); if (winId) closeWindow(winId); }}>Cancel</button>
            <button className="fm-btn primary small" style={{ fontWeight: 600 }}
              onClick={() => {
                const fullPath = path.replace(/\/$/, '') + '/' + singleSelected;
                document.dispatchEvent(new CustomEvent('fm-file-picked', { detail: { path: fullPath } }));
                if (winId) closeWindow(winId);
              }}>
              <Check size={13} /> Select This File
            </button>
          </div>
        </div>
      )}

      {/* ===== Pick Directory Bar (floating bottom) ===== */}
      {pickDir && (
        <div className="fm-pick-bar">
          <div className="fm-pick-bar-info">
            <FolderOpen size={16} />
            <span className="fm-pick-bar-name">{path}</span>
          </div>
          <div className="fm-pick-bar-actions">
            <button className="fm-btn small" onClick={() => {
              document.dispatchEvent(new CustomEvent('fm-dir-picked', { detail: { path } }));
              if (winId) closeWindow(winId);
            }}>
              <Check size={13} /> Select This Folder
            </button>
          </div>
        </div>
      )}

      {/* ===== Right-click Context Menu ===== */}
      {contextItem && (
        <div className="ctx-menu" style={{ left: contextItem.x, top: contextItem.y, position: 'fixed', zIndex: 1000 }}
          onClick={() => setContextItem(null)}>
          <button className="ctx-item" onClick={(e) => { e.stopPropagation(); contextItem.isDir ? navigate(contextItem.name) : openEditor(path.replace(/\/$/, '') + '/' + contextItem.name); }}>
            <ExternalLink size={14} /> Open
          </button>
          {isTrashView && (
            <button className="ctx-item" onClick={(e) => { e.stopPropagation(); restoreItem(contextItem.name); }}>
              <RefreshCw size={14} /> Restore
            </button>
          )}
          {contextItem.isDir && (
            <button className="ctx-item" onClick={(e) => { e.stopPropagation(); openInNewWindow(contextItem.name); }}>
              <ExternalLink size={14} /> Open in New Window
            </button>
          )}
          {!contextItem.isDir && isWebFile(contextItem.name) && (
            <button className="ctx-item" onClick={(e) => {
              e.stopPropagation();
              const p = path.replace(/\/$/, '') + '/' + contextItem.name;
              openWindow('bnote-' + Date.now(), 'Bnote — ' + contextItem.name, { path: p });
              setContextItem(null);
            }}>
              <FileText size={14} /> Open with BNote
            </button>
          )}
          {!contextItem.isDir && (
            <button className="ctx-item" onClick={(e) => {
              e.stopPropagation();
              const p = path.replace(/\/$/, '') + '/' + contextItem.name;
              openWindow('code-editor-' + Date.now(), 'Code — ' + contextItem.name, { path: p });
              setContextItem(null);
            }}>
              <FileText size={14} /> Open with Code Editor
            </button>
          )}
          <div className="ctx-sep" />
          <button className="ctx-item" onClick={(e) => { e.stopPropagation(); copyItem(contextItem.name); }}>
            <Copy size={14} /> Copy
          </button>
          <button className="ctx-item" onClick={(e) => { e.stopPropagation(); cutItem(contextItem.name); }}>
            <Scissors size={14} /> Cut
          </button>
          <button className="ctx-item" onClick={(e) => { e.stopPropagation(); pasteItem(); }} disabled={!clipboard}>
            <ClipboardPaste size={14} /> Paste
          </button>
          <div className="ctx-sep" />
          <button className="ctx-item" onClick={(e) => { e.stopPropagation(); startRename(contextItem.name); }}>
            <Edit3 size={14} /> Rename
          </button>
          <button className="ctx-item" onClick={(e) => { e.stopPropagation(); downloadItem(contextItem.name); }}>
            <Download size={14} /> Download
          </button>
          {!contextItem.isDir && contextItem.name.toLowerCase().endsWith('.deb') && (
            <>
              <button className="ctx-item" onClick={(e) => {
                e.stopPropagation(); setContextItem(null);
                const fullPath = path.replace(/\/$/, '') + '/' + contextItem.name;
                openWindow('deb-installer', 'DEB Installer', { path: fullPath });
              }}>
                <Package size={14} /> Install with DEB Installer
              </button>
            </>
          )}
          {!contextItem.isDir && contextItem.name.toLowerCase().endsWith('.zip') && (
            <>
              <button className="ctx-item" onClick={(e) => { e.stopPropagation(); extractItem(contextItem.name); }}>
                <FolderOpen size={14} /> Extract Here
              </button>
              <button className="ctx-item" onClick={async (e) => {
                e.stopPropagation();
                setContextItem(null);
                const itemPath = path.replace(/\/$/, '') + '/' + contextItem.name;
                const appName = contextItem.name.replace(/\.zip$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
                setLoading({ active: true, message: 'Installing as app...' });
                try {
                  await api.post('/apps/install/upload', { path: itemPath, app_name: appName });
                  document.dispatchEvent(new CustomEvent('apps-installed-refresh'));
                  setLoading({ active: true, message: `✅ App '${appName}' installed!` });
                  setTimeout(() => setLoading({ active: false, message: '' }), 1500);
                } catch (e) {
                  setError('Install error: ' + (e instanceof Error ? e.message : ''));
                  setLoading({ active: false, message: '' });
                }
              }}>
                <Package size={14} /> Install as App
              </button>
            </>
          )}
          <button className="ctx-item" onClick={(e) => { e.stopPropagation(); compressItem(contextItem.name); }}>
            <Package size={14} /> Compress to ZIP
          </button>

          {/* Multi-select operations */}
          {selectedSet.size >= 2 && (
            <>
              <div className="ctx-sep" />
              <button className="ctx-item" onClick={(e) => { e.stopPropagation(); compressSelected(); }}>
                <Package size={14} /> Compress ({selectedSet.size}) items to ZIP
              </button>
              <button className="ctx-item" onClick={(e) => { e.stopPropagation(); copySelected(); }}>
                <Copy size={14} /> Copy ({selectedSet.size}) items
              </button>
              <button className="ctx-item" onClick={(e) => { e.stopPropagation(); cutSelected(); }}>
                <Scissors size={14} /> Cut ({selectedSet.size}) items
              </button>
              <button className="ctx-item ctx-danger" onClick={(e) => { e.stopPropagation(); deleteSelected(); }}>
                <Trash2 size={14} /> Delete ({selectedSet.size}) items
              </button>
            </>
          )}

          <div className="ctx-sep" />
          <button className="ctx-item" onClick={(e) => { e.stopPropagation(); showProps(contextItem.name, contextItem.isDir); }}>
            <Info size={14} /> Properties
          </button>
          <button className="ctx-item" onClick={(e) => { e.stopPropagation(); loadFiles(path); setContextItem(null); }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <div className="ctx-sep" />
          <button className="ctx-item ctx-danger" onClick={(e) => { e.stopPropagation(); startDelete(path.replace(/\/$/, '') + '/' + contextItem.name, contextItem.name); }}>
            <Trash2 size={14} /> Delete
          </button>
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
              <p>Location: {path}</p>
              {propsTarget.size !== undefined && <p>Size: {fmtSize(propsTarget.size)}</p>}
              {propsTarget.modified && <p>Modified: {fmtDate(propsTarget.modified)}</p>}
            </div>
            <div className="modal-actions">
              <button className="modal-btn modal-btn-primary" onClick={() => setPropsTarget(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setDeleteTarget(null)}>
          <div className="modal-box" style={{ maxWidth: 380 }}>
            <div className="modal-title">{isTrashView ? 'Permanently Delete' : 'Move to Trash'}</div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.5rem 0' }}>
              {isTrashView ? (
                <>Are you sure you want to permanently delete <strong>{deleteTarget.name}</strong>? This cannot be undone.</>
              ) : (
                <>Are you sure you want to move <strong>{deleteTarget.name}</strong> to Trash?</>
              )}
            </p>
            <div className="modal-actions">
              <button className="modal-btn modal-btn-cancel" onClick={() => setDeleteTarget(null)}>{isTrashView ? 'Keep' : 'Cancel'}</button>
              <button className="modal-btn modal-btn-danger" onClick={deleteTarget.path ? deleteItem : confirmDeleteSelected}>
                {isTrashView ? 'Delete Forever' : 'Move to Trash'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty Trash confirmation */}
      {emptyTrashConfirm && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setEmptyTrashConfirm(false)}>
          <div className="modal-box" style={{ maxWidth: 380 }}>
            <div className="modal-title">Empty Trash</div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.5rem 0' }}>
              Are you sure you want to permanently delete all items in Trash? This cannot be undone.
            </p>
            <p style={{ fontSize: '0.78rem', color: 'var(--danger)', margin: '0.3rem 0' }}>
              {items.length} item(s) will be deleted forever.
            </p>
            <div className="modal-actions">
              <button className="modal-btn modal-btn-cancel" onClick={() => setEmptyTrashConfirm(false)}>Cancel</button>
              <button className="modal-btn modal-btn-danger" onClick={emptyTrash}>Empty Trash</button>
            </div>
          </div>
        </div>
      )}

      {/* Disk Properties */}
      {diskPropsOpen && diskPropsTarget && (
        <div className="modal-overlay" onClick={() => { setDiskPropsOpen(false); setDiskPropsTarget(null); }}>
          <div className="modal-box" style={{ width: 320 }}>
            <div className="modal-title">
              <HardDrive size={16} /> Drive Properties
            </div>
            <div className="st-content" style={{ margin: '0.75rem 0' }}>
              <div className="fm11-disk-prop-row"><span>Mount:</span><span>{diskPropsTarget.mount}</span></div>
              <div className="fm11-disk-prop-row"><span>Device:</span><span>{diskPropsTarget.device || '—'}</span></div>
              <div className="fm11-disk-prop-row"><span>Filesystem:</span><span>{diskPropsTarget.fstype || '—'}</span></div>
              <div className="fm11-disk-prop-row"><span>Total:</span><span>{fmtSize(diskPropsTarget.total)}</span></div>
              <div className="fm11-disk-prop-row"><span>Used:</span><span>{fmtSize(diskPropsTarget.used)}</span></div>
              <div className="fm11-disk-prop-row"><span>Free:</span><span>{fmtSize(diskPropsTarget.free)}</span></div>
              <div className="fm11-disk-prop-row"><span>Usage:</span><span>{diskPropsTarget.percent}%</span></div>
            </div>
            <div className="modal-actions">
              <button className="modal-btn modal-btn-primary" onClick={() => { setDiskPropsOpen(false); setDiskPropsTarget(null); }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Install confirmation for .deb files */}
      {debInstallTarget && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setDebInstallTarget(null); }}>
          <div className="modal-box" style={{ maxWidth: 420 }}>
            <div className="modal-title">Install Package</div>
            <p style={{ fontSize: 13, margin: '16px 0', lineHeight: 1.5 }}>
              Install <strong>{debInstallTarget.name}</strong>?
            </p>
            <div className="modal-actions">
              <button className="fm-btn" onClick={() => setDebInstallTarget(null)}>Cancel</button>
              <button className="fm-btn primary" onClick={() => {
                const path = debInstallTarget.path;
                setDebInstallTarget(null);
                openWindow('deb-installer', 'DEB Installer', { path });
              }}>
                <Package size={14} /> Install
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extract modal for .zip files */}
      {extractTarget && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setExtractTarget(null); setExtractMsg(''); } }}>
          <div className="modal-box" style={{ maxWidth: 380 }}>
            <div className="modal-title">
              <Package size={16} /> Extract ZIP
            </div>
            <p style={{ fontSize:'0.8rem', color:'var(--text-secondary)', margin:'0.75rem 0' }}>
              Extract <strong>{extractTarget.name}</strong> to current folder?
            </p>
            {extractMsg && (
              <p className={`msg show${extractMsg.includes('Error') ? ' error' : ''}`} style={{ margin:'0.5rem 0' }}>
                {extractMsg}
              </p>
            )}
            <div className="modal-actions">
              <button className="modal-btn modal-btn-cancel"
                onClick={() => { setExtractTarget(null); setExtractMsg(''); }}
                disabled={loading.active}>Cancel</button>
              <button className="modal-btn modal-btn-primary" onClick={doExtract}
                disabled={loading.active}>
                {loading.active ? 'Extracting...' : 'Extract Here'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* About modal */}
      {aboutOpen && (
        <div className="modal-overlay" onClick={() => setAboutOpen(false)}>
          <div className="modal-box" style={{ width: 300 }}>
            <div className="modal-title" style={{ display:'flex', alignItems:'center', gap:'0.3rem' }}>
              <Info size={16} /> File Manager
            </div>
            <div style={{ fontSize:'0.75rem', color:'var(--text-secondary)', margin:'0.5rem 0', lineHeight:1.5 }}>
              File manager for CloudBanana DE.<br />
              Manage files and folders on the server.
            </div>
            <div className="modal-actions">
              <button className="modal-btn modal-btn-primary" onClick={() => setAboutOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {loading.active && (
        <div className="fm11-loading-overlay">
          <div className="fm11-loading-box">
            <div className="fm11-loading-text">{loading.message}</div>
            <div className="fm11-loading-bar">
              <div className="fm11-loading-bar-indeterminate" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

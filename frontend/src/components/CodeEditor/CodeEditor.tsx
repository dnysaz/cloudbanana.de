import { useState, useEffect, useRef } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import { api } from '../../api';
import { useDesktopStore } from '../../store/desktopStore';
import { useAuthStore } from '../../store/authStore';
import type { FileItem } from '../../types';
import {
  Folder, FileText, Save, X, Plus,
  PanelLeftClose, PanelLeft, Info, FolderOpen, Terminal as TerminalIcon,
  Trash2, Edit3, Copy, ExternalLink,
} from 'lucide-react';
import TerminalPanel from '../Terminal/Terminal';

interface Props {
  winId?: string;
  winData?: Record<string, unknown>;
}

const LANG_MAP: Record<string, string> = {
  js: 'javascript', jsx: 'javascript', mjs: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  py: 'python', pyw: 'python', rb: 'ruby',
  go: 'go', rs: 'rust',
  c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp',
  java: 'java', kt: 'kotlin', swift: 'swift',
  dart: 'dart', php: 'php', phtml: 'php',
  html: 'html', htm: 'html', svg: 'xml',
  css: 'css', scss: 'scss', less: 'less',
  sql: 'sql', sh: 'shell', bash: 'shell', zsh: 'shell',
  yaml: 'yaml', yml: 'yaml', json: 'json', xml: 'xml',
  md: 'markdown', toml: 'plaintext', env: 'plaintext',
  ini: 'ini', cfg: 'ini', conf: 'ini',
  csv: 'plaintext', log: 'plaintext', txt: 'plaintext',
};

const isDark = () => document.documentElement.classList.contains('theme-dark');

loader.init().then(monaco => {
  monaco.editor.defineTheme('cloudbanana-dark', {
    base: 'vs-dark', inherit: true,
    rules: [
      { token: 'comment', foreground: '6a9955', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'c586c0' },
      { token: 'string', foreground: 'ce9178' },
      { token: 'number', foreground: 'b5cea8' },
      { token: 'type', foreground: '4ec9b0' },
      { token: 'function', foreground: 'dcdcaa' },
      { token: 'variable', foreground: '9cdcfe' },
    ],
    colors: {
      'editor.background': '#1a1a2e',
      'editor.foreground': '#d4d4d4',
      'editor.lineHighlightBackground': '#2a2a4e',
      'editor.selectionBackground': '#3a3a6e',
      'editorCursor.foreground': '#aeafad',
      'editorLineNumber.foreground': '#5a5a7a',
      'editorLineNumber.activeForeground': '#8a8aaa',
      'editorIndentGuide.background': '#2a2a4e',
      'editorWidget.background': '#1e1e3a',
      'input.background': '#2a2a4e',
      'input.foreground': '#d4d4d4',
      'list.hoverBackground': '#2a2a4e',
      'list.activeSelectionBackground': '#3a3a6e',
    },
  });
  monaco.editor.defineTheme('cloudbanana-light', {
    base: 'vs', inherit: true,
    rules: [
      { token: 'comment', foreground: '008000', fontStyle: 'italic' },
      { token: 'keyword', foreground: '0000ff' },
      { token: 'string', foreground: 'a31515' },
      { token: 'number', foreground: '098658' },
    ],
    colors: {
      'editor.background': '#fafafa',
      'editor.foreground': '#333',
      'editor.lineHighlightBackground': '#e8e8e8',
      'editor.selectionBackground': '#add6ff',
      'editorCursor.foreground': '#333',
      'editorLineNumber.foreground': '#ccc',
      'editorLineNumber.activeForeground': '#666',
      'editorIndentGuide.background': '#e0e0e0',
      'editorWidget.background': '#f5f5f5',
      'input.background': '#fff',
      'input.foreground': '#333',
      'list.hoverBackground': '#e8e8e8',
      'list.activeSelectionBackground': '#d4d4d4',
    },
  });
});

function getLang(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (filename.toLowerCase() === 'dockerfile') return 'dockerfile';
  return LANG_MAP[ext] || 'plaintext';
}

/** File icon colors by extension for sidebar tree */
const FILE_ICON_COLORS: Record<string, string> = {
  js: '#ca8a04', jsx: '#ca8a04', mjs: '#ca8a04',
  ts: '#2563eb', tsx: '#2563eb',
  py: '#2563eb', rb: '#dc2626', go: '#0891b2', rs: '#d97706',
  c: '#4f46e5', cpp: '#4f46e5', h: '#6366f1', java: '#dc2626',
  php: '#7c3aed', swift: '#f97316', kt: '#7c3aed', dart: '#0891b2',
  html: '#ea580c', htm: '#ea580c', css: '#db2777', scss: '#db2777', less: '#db2777',
  json: '#059669', xml: '#0d9488', yaml: '#b45309', yml: '#b45309', toml: '#b45309',
  md: '#1e293b', sql: '#e11d48', sh: '#16a34a', bash: '#16a34a', zsh: '#16a34a',
  txt: '#64748b', env: '#1d4ed8', cfg: '#4b5563', ini: '#4b5563', conf: '#4b5563',
  pdf: '#dc2626', csv: '#16a34a', log: '#64748b',
  zip: '#d97706', tar: '#92400e', gz: '#92400e', rar: '#92400e', '7z': '#92400e',
  mp4: '#7c3aed', avi: '#7c3aed', mkv: '#7c3aed', webm: '#7c3aed', mov: '#7c3aed',
  mp3: '#16a34a', wav: '#059669', flac: '#059669', ogg: '#059669',
  png: '#c084fc', jpg: '#c084fc', jpeg: '#c084fc', gif: '#c084fc', svg: '#0d9488',
  webp: '#c084fc', bmp: '#c084fc', ico: '#c084fc',
  dockerfile: '#2563eb',
};

function getFileIconColor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (name.toLowerCase() === 'dockerfile') return '#2563eb';
  return FILE_ICON_COLORS[ext] || '#569cd6';
}

interface OpenTab {
  path: string;
  name: string;
  language: string;
  content: string;
  original: string;
  saved: boolean;
}

export default function CodeEditor({ winId, winData }: Props) {
  const { closeWindow, openWindow, maximizeWindow } = useDesktopStore();
  const user = useAuthStore(s => s.user);
  const homeDir = user?.home || (user?.username === 'root' ? '/root' : '/home/' + (user?.username || 'root')) || '/root';
  const desktopDir = homeDir + '/Desktop';
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rootPath, setRootPath] = useState('');
  const [showMenu, setShowMenu] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<any>(null);
  const openFileRef = useRef<(filePath: string) => Promise<void>>(async () => {});
  const loadTreeRef = useRef<(dir: string) => Promise<void>>(async () => {});
  const pendingNewFileRef = useRef(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveDirPath, setSaveDirPath] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [untitledCounter, setUntitledCounter] = useState(1);
  const [showTerminal, setShowTerminal] = useState(false);
  const [showEmptyNewFile, setShowEmptyNewFile] = useState(false);
  const [sidebarCtx, setSidebarCtx] = useState<{ x: number; y: number; item: { name: string; path: string; is_dir: boolean } } | null>(null);
  const [renameSidebar, setRenameSidebar] = useState<string | null>(null);
  const [renameSidebarVal, setRenameSidebarVal] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ name: string; path: string } | null>(null);
  const renameSidebarRef = useRef<HTMLInputElement>(null);
  const dragTabRef = useRef<number | null>(null);
  const activePathRef = useRef(activePath);
  useEffect(() => { activePathRef.current = activePath; }, [activePath]);
  const tabsRef = useRef(tabs);
  useEffect(() => { tabsRef.current = tabs; }, [tabs]);

  const dark = isDark();

  const c = {
    bg: dark ? '#1a1a2e' : '#fafafa',
    bgAlt: dark ? '#16162a' : '#f0f0f0',
    bgMenu: dark ? '#12121e' : '#e8e8e8',
    border: dark ? '#2a2a4e' : '#d0d0d0',
    text: dark ? '#d4d4d4' : '#333',
    textMuted: dark ? '#8a8aaa' : '#888',
    textDim: dark ? '#666' : '#aaa',
    tabActiveBg: dark ? '#1a1a2e' : '#fafafa',
    tabInactiveBg: dark ? '#16162a' : '#f0f0f0',
    sidebarHover: dark ? '#2a2a4e' : '#e0e0e0',
    sidebarActive: dark ? '#2a2a5e' : '#d4d4ff',
    dropdownBg: dark ? '#1e1e3a' : '#f8f8f8',
    dropdownBorder: dark ? '#2a2a4e' : '#d0d0d0',
    btnBg: dark ? '#3a3a6e' : '#e0e0f0',
    btnText: dark ? '#d4d4d4' : '#333',
    treeText: dark ? '#d4d4d4' : '#333',
    treeTextFile: dark ? '#c0c0d0' : '#555',
    statusBg: dark ? '#12121e' : '#e8e8e8',
    overlay: 'rgba(0,0,0,0.5)',
    dialogBg: dark ? '#1e1e3a' : '#f8f8f8',
    iconColor: dark ? '#8a8aaa' : '#888',
    fileIconColor: dark ? '#569cd6' : '#2563eb',
  };

  const storageKey = 'ce-state' + (winId ? '-' + winId : '');

  // Track whether restore completed (even if no data found) and whether tabs were actually restored
  const restored = useRef(false);
  const tabsRestored = useRef(false);
  // Restore state from localStorage on mount (runs once)
  // IMPORTANT: This must be declared BEFORE the persist effect so it runs first
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    let savedRootPath: string | null = null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw);
        savedRootPath = saved.rootPath || null;
        if (saved.rootPath) setRootPath(saved.rootPath);
        if (saved.untitledCounter) setUntitledCounter(saved.untitledCounter);
        if (Array.isArray(saved.tabs) && saved.tabs.length > 0) {
          setTabs(saved.tabs);
          tabsRestored.current = true;
          setActivePath(
            saved.activePath && saved.tabs.some((t: any) => t.path === saved.activePath)
              ? saved.activePath
              : saved.tabs[saved.tabs.length - 1].path
          );
        }
      }
    } catch {}
    // Load tree after potential restore if we have a saved path
    if (savedRootPath) {
      loadTree(savedRootPath);
    }
  }, []);

  // Persist state to localStorage (only after restore has run)
  useEffect(() => {
    if (!restored.current) return; // Don't save until after restore
    try {
      localStorage.setItem(storageKey, JSON.stringify({ tabs, activePath, rootPath, untitledCounter }));
    } catch {}
  }, [tabs, activePath, rootPath, untitledCounter]);

  useEffect(() => {
    // Cleanup global callback on unmount
    return () => { delete (window as any).__cePickDir; };
  }, []);

  useEffect(() => {
    if (winId) maximizeWindow(winId);
    const p = winData?.path as string | undefined;
    if (p) {
      // If tabs were actually restored from localStorage, don't re-open (would cause duplicate)
      if (tabsRestored.current) return;
      const dir = p.startsWith('/') ? (p.split('/').slice(0, -1).join('/') || '/') : desktopDir;
      setRootPath(dir);
      loadTree(dir);
      openFile(p);
    }
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(null);
    };
    if (showMenu) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  const [tree, setTree] = useState<{ name: string; path: string; is_dir: boolean }[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);

  const loadTree = async (dir: string) => {
    setTreeLoading(true);
    try {
      const data = await api.get<{ path: string; items: FileItem[] }>(`/files?path=${encodeURIComponent(dir)}`);
      setTree(data.items.map(item => ({
        name: item.name,
        path: (data.path.endsWith('/') ? data.path : data.path + '/') + item.name,
        is_dir: item.is_dir,
      })));
    } catch { setTree([]); }
    setTreeLoading(false);
  };

  const navigateDir = async (dirPath: string) => {
    setShowEmptyNewFile(false);
    setRootPath(dirPath);
    await loadTree(dirPath);
  };

  const activeTab = tabs.find(t => t.path === activePath) || null;

  const openFile = async (filePath: string) => {
    if (tabs.find(t => t.path === filePath)) { setActivePath(filePath); return; }
    try {
      const data = await api.post<{ content: string }>('/files/read', { path: filePath });
      const name = filePath.split('/').pop() || 'untitled';
      const tab: OpenTab = {
        path: filePath, name, language: getLang(name),
        content: data.content, original: data.content, saved: true,
      };
      setTabs(prev => [...prev, tab]);
      setActivePath(filePath);
    } catch {}
  };

  const closeTab = (filePath: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setTabs(prev => prev.filter(t => t.path !== filePath));
    if (activePath === filePath) {
      const remaining = tabs.filter(t => t.path !== filePath);
      setActivePath(remaining.length > 0 ? remaining[remaining.length - 1].path : null);
    }
  };

  const handleSave = async () => {
    if (!activeTab) return;
    const content = editorRef.current?.getValue() ?? activeTab.content;
    
    // Untitled tab — trigger save-as flow
    if (!activeTab.path.includes('/')) {
      if (rootPath) {
        // Folder already opened — save directly to that folder
        setSaveDirPath(rootPath);
        setNewFileName(activeTab.name);
        setShowSaveDialog(true);
      } else {
        // No folder — open File Manager to pick directory & show save dialog
        const name = activeTab.name;
        (window as any).__cePickDir = (dirPath: string) => {
          setRootPath(dirPath);
          loadTree(dirPath);
          setSaveDirPath(dirPath);
          setNewFileName(name);
          setShowSaveDialog(true);
        };
        const id = 'fm-pickdir-' + Date.now();
        openWindow(id, 'Save File', { path: desktopDir, pickDir: true });
      }
      return;
    }
    
    // Normal save
    try {
      await api.post('/files/write', { path: activeTab.path, content });
      setTabs(prev => prev.map(t =>
        t.path === activeTab.path ? { ...t, content, original: content, saved: true } : t
      ));
    } catch {}
  };

  const handleContentChange = (val: string | undefined) => {
    if (!activePath || !val) return;
    setTabs(prev => prev.map(t =>
      t.path === activePath ? { ...t, content: val, saved: val === t.original } : t
    ));
  };

  const addUntitledTab = () => {
    const name = 'untitled-' + untitledCounter;
    const tab: OpenTab = {
      path: name, name, language: 'plaintext',
      content: '', original: '', saved: false,
    };
    setTabs(prev => [...prev, tab]);
    setActivePath(name);
    setUntitledCounter(prev => prev + 1);
  };

  const doSaveAs = async () => {
    if (!newFileName.trim() || !saveDirPath) return;
    const fullPath = saveDirPath.replace(/\/$/, '') + '/' + newFileName.trim();
    setShowSaveDialog(false);
    setNewFileName('');
    try {
      const content = editorRef.current?.getValue() ?? '';
      await api.post('/files/write', { path: fullPath, content });
      const name = newFileName.trim();
      setTabs(prev => prev.map(t =>
        t.path === activePath ? { ...t, path: fullPath, name, language: getLang(name), content, original: content, saved: true } : t
      ));
      setActivePath(fullPath);
      // Update sidebar to show the folder where file was saved
      setRootPath(saveDirPath);
      loadTree(saveDirPath);
    } catch {}
  };

  const handleEditorMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    editor.onDidChangeCursorPosition((e: any) => {
      setCursorPos({ line: e.position.lineNumber, col: e.position.column });
    });
    editor.addAction({
      id: 'save-file', label: 'Save File',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: () => handleSave(),
    });
  };

  const openFileDialog = () => {
    const id = 'fm-pick-' + Date.now();
    openWindow(id, 'Select File', { path: rootPath, pickMode: true });
  };
  const openFolderDialog = () => {
    pendingNewFileRef.current = false;
    const id = 'fm-pickdir-' + Date.now();
    // Set global callback so FileManager can call us directly
    (window as any).__cePickDir = (dirPath: string) => {
      console.log('[Debug] __cePickDir callback fired:', dirPath);
      setShowEmptyNewFile(false);
      setRootPath(dirPath);
      loadTree(dirPath);
    };
    openWindow(id, 'Select Folder', { path: rootPath, pickDir: true });
  };

  // Keep refs in sync with current function closures
  openFileRef.current = openFile;
  loadTreeRef.current = loadTree;

  useEffect(() => {
    const handler = (e: Event) => {
      const filePath = (e as CustomEvent).detail?.path;
      if (filePath) openFileRef.current(filePath);
    };
    document.addEventListener('fm-file-picked', handler);
    return () => document.removeEventListener('fm-file-picked', handler);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const dirPath = (e as CustomEvent).detail?.path;
      if (!dirPath) return;
      if (pendingNewFileRef.current) {
        pendingNewFileRef.current = false;
        setSaveDirPath(dirPath);
        setNewFileName((window as any).__pendingFileName || '');
        (window as any).__pendingFileName = '';
        setShowSaveDialog(true);
      } else {
        setRootPath(dirPath);
        loadTreeRef.current(dirPath);
      }
    };
    document.addEventListener('fm-dir-picked', handler);
    return () => document.removeEventListener('fm-dir-picked', handler);
  }, []);

  // === Keyboard shortcuts ===
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      if (!isCtrl) return;
      switch (e.key.toLowerCase()) {
        case 'n':
          e.preventDefault();
          addUntitledTab();
          break;
        case 'w':
          e.preventDefault();
          const closePath = activePathRef.current;
          if (closePath) {
            const remaining = tabsRef.current.filter(t => t.path !== closePath);
            setTabs(remaining);
            setActivePath(remaining.length > 0 ? remaining[remaining.length - 1].path : null);
          }
          break;
        case 'o':
          e.preventDefault();
          openFileDialog();
          break;
        case '`':
          e.preventDefault();
          setShowTerminal(prev => !prev);
          break;
        case 'e':
          if (e.shiftKey) {
            e.preventDefault();
            setSidebarOpen(prev => !prev);
          }
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // === Sidebar context menu handlers ===
  const handleSidebarContext = (e: React.MouseEvent, item: { name: string; path: string; is_dir: boolean }) => {
    e.preventDefault();
    e.stopPropagation();
    setSidebarCtx({ x: e.clientX, y: e.clientY, item });
  };
  const closeSidebarCtx = () => setSidebarCtx(null);

  useEffect(() => {
    const handler = () => closeSidebarCtx();
    if (sidebarCtx) {
      window.addEventListener('click', handler);
      return () => window.removeEventListener('click', handler);
    }
  }, [sidebarCtx]);

  const handleSidebarRename = (item: { name: string; path: string; is_dir: boolean }) => {
    const dot = item.name.lastIndexOf('.');
    const val = dot > 0 ? item.name.slice(0, dot) : item.name;
    setRenameSidebar(item.name);
    setRenameSidebarVal(val);
    setSidebarCtx(null);
    setTimeout(() => renameSidebarRef.current?.setSelectionRange(0, val.length), 50);
  };

  const doSidebarRename = async () => {
    if (!renameSidebar || !renameSidebarVal) { setRenameSidebar(null); return; }
    const dot = renameSidebar.lastIndexOf('.');
    const ext = dot > 0 ? renameSidebar.slice(dot) : '';
    const finalName = renameSidebarVal + ext;
    if (finalName === renameSidebar) { setRenameSidebar(null); return; }
    const src = rootPath.replace(/\/$/, '') + '/' + renameSidebar;
    try {
      await api.post('/files/rename', { path: src, new_name: finalName });
      setRenameSidebar(null);
      await loadTree(rootPath);
      // Update tabs if the renamed file is open
      setTabs(prev => prev.map(t => t.path === src ? { ...t, path: rootPath.replace(/\/$/, '') + '/' + finalName, name: finalName } : t));
      if (activePath === src) setActivePath(rootPath.replace(/\/$/, '') + '/' + finalName);
    } catch {}
  };

  const handleSidebarDelete = async (item: { name: string; path: string; is_dir: boolean }) => {
    setSidebarCtx(null);
    setDeleteConfirm({ name: item.name, path: item.path });
  };

  const doSidebarDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await api.post('/files/remove', { path: deleteConfirm.path });
      setDeleteConfirm(null);
      // Close tab if the deleted file was open
      closeTab(deleteConfirm.path);
      await loadTree(rootPath);
    } catch {}
    setDeleteConfirm(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setSidebarCtx(null);
  };

  const handleCreateInTree = async () => {
    if (!newFileName.trim() || !rootPath) return;
    const fullPath = rootPath.replace(/\/$/, '') + '/' + newFileName.trim();
    setShowEmptyNewFile(false);
    setNewFileName('');
    try {
      await api.post('/files/write', { path: fullPath, content: '' });
      await loadTree(rootPath);
      openFile(fullPath);
    } catch {}
  };

  const handleCreateNoFolder = async () => {
    if (!newFileName.trim()) return;
    setShowEmptyNewFile(false);
    const name = newFileName.trim();
    setNewFileName('');
    // Set global callback: open folder + show save dialog directly
    (window as any).__cePickDir = (dirPath: string) => {
      setShowEmptyNewFile(false);
      setRootPath(dirPath);
      loadTree(dirPath);
      setSaveDirPath(dirPath);
      setNewFileName(name);
      setShowSaveDialog(true);
    };
    const id = 'fm-pickdir-' + Date.now();
    openWindow(id, 'Save File', { path: desktopDir, pickDir: true });
  };

  const openLocalFile = () => fileInputRef.current?.click();
  const handleLocalFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const tab: OpenTab = {
      path: file.name, name: file.name, language: getLang(file.name),
      content: text, original: text, saved: true,
    };
    setTabs(prev => [...prev, tab]);
    setActivePath(file.name);
    e.target.value = '';
  };

  const openLocalFolder = () => folderInputRef.current?.click();
  const handleLocalFolder = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const tab: OpenTab = {
      path: file.name, name: file.name, language: getLang(file.name),
      content: text, original: text, saved: true,
    };
    setTabs(prev => [...prev, tab]);
    setActivePath(file.name);
    e.target.value = '';
  };

  const menuItems: Record<string, { label: string; action: () => void; divider?: boolean }[]> = {
    File: [
      { label: 'Open File...', action: openFileDialog },
      { label: 'Open Folder...', action: openFolderDialog },
      { label: 'Open Local File...', action: openLocalFile },
      { label: 'Open Local Folder...', action: openLocalFolder, divider: true },
      { label: 'Exit', action: () => winId && closeWindow(winId) },
    ],
    Terminal: [
      { label: showTerminal ? 'Hide Terminal' : 'Show Terminal', action: () => setShowTerminal(prev => !prev) },
    ],
    Help: [
      { label: 'About', action: () => setShowAbout(true) },
    ],
  };

  const monacoTheme = dark ? 'cloudbanana-dark' : 'cloudbanana-light';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: c.bg }}>
      {/* Menu Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: c.bgMenu, borderBottom: `1px solid ${c.border}`, padding: '0 4px', height: 32, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {['File', 'Terminal', 'Help'].map(menu => (
            <div key={menu} style={{ position: 'relative' }}>
              <button
                style={{ background: 'none', border: 'none', color: c.text, cursor: 'pointer', padding: '4px 10px', fontSize: 13, borderRadius: 4 }}
                onClick={() => setShowMenu(showMenu === menu ? null : menu)}
                onMouseEnter={() => showMenu && setShowMenu(menu)}
              >
                {menu}
              </button>
              {showMenu === menu && (
                <div ref={menuRef} style={{ position: 'absolute', top: '100%', left: 0, background: c.dropdownBg, border: `1px solid ${c.dropdownBorder}`, borderRadius: 6, minWidth: 200, padding: '4px 0', zIndex: 1000, boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
                  {menuItems[menu].map((item, i) => (
                    <div key={i}>
                      <button style={{ display: 'block', width: '100%', padding: '6px 16px', background: 'none', border: 'none', color: c.text, fontSize: 13, textAlign: 'left', cursor: 'pointer' }}
                        onClick={() => { setShowMenu(null); item.action(); }}>{item.label}
                      </button>
                      {item.divider && <div style={{ height: 1, background: c.border, margin: '4px 8px' }} />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button style={{ background: 'none', border: 'none', color: c.iconColor, cursor: 'pointer', padding: '4px 6px', borderRadius: 4, display: 'flex', alignItems: 'center' }}
            onClick={() => setSidebarOpen(!sidebarOpen)} title="Toggle Sidebar">
            {sidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeft size={15} />}
          </button>
          <button style={{ background: 'none', border: 'none', color: c.iconColor, cursor: 'pointer', padding: '4px 6px', borderRadius: 4, display: 'flex', alignItems: 'center' }}
            onClick={handleSave} title="Save (Ctrl+S)">
            <Save size={15} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar: Explorer only */}
        {sidebarOpen && (
          <div style={{ width: 220, minWidth: 220, display: 'flex', flexDirection: 'column', background: c.bgAlt, borderRight: `1px solid ${c.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', borderBottom: `1px solid ${c.border}` }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Explorer</span>
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {rootPath ? (
                <div style={{ padding: '0 8px 6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px', fontSize: 11, color: c.textDim, overflow: 'hidden' }}>
                    <Folder size={12} style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rootPath}</span>
                  </div>
                  {treeLoading ? (
                    <div style={{ padding: '6px', fontSize: 11, color: c.textDim }}>Loading...</div>
                  ) : tree.length === 0 ? (
                    <div style={{ padding: '6px' }}>
                      <div style={{ fontSize: 11, color: c.textDim, marginBottom: 6 }}>Empty folder</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {showEmptyNewFile ? (
                          <>
                            <input autoFocus value={newFileName}
                              onChange={e => setNewFileName(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleCreateInTree();
                                if (e.key === 'Escape') setShowEmptyNewFile(false);
                              }}
                              placeholder="filename.ext"
                              style={{
                                flex: 1, padding: '4px 6px', fontSize: 11,
                                border: `1px solid ${c.border}`, borderRadius: 4,
                                background: c.bg, color: c.text, outline: 'none',
                              }}
                            />
                            <button onClick={handleCreateInTree}
                              style={{
                                padding: '3px 8px', border: 'none', borderRadius: 4,
                                background: c.btnBg, color: c.btnText, fontSize: 11,
                                cursor: 'pointer', fontWeight: 600,
                              }}>Create</button>
                            <button onClick={() => setShowEmptyNewFile(false)}
                              style={{
                                padding: '3px 6px', border: `1px solid ${c.border}`, borderRadius: 4,
                                background: 'none', color: c.textMuted, fontSize: 11,
                                cursor: 'pointer',
                              }}><X size={11} /></button>
                          </>
                        ) : (
                          <button onClick={() => { setNewFileName(''); setShowEmptyNewFile(true); }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 4,
                              padding: '3px 8px', border: 'none', borderRadius: 4,
                              background: 'none', color: c.fileIconColor, fontSize: 11,
                              cursor: 'pointer', fontWeight: 500,
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = c.sidebarHover}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                          >
                            <Plus size={12} />
                            <span>New File</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    tree.map(item => (
                      <div key={item.path}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4, padding: '3px 6px 3px 16px',
                          cursor: 'pointer', borderRadius: 3, fontSize: 12,
                          color: c.textMuted,
                          position: 'relative',
                        }}
                        onClick={() => {
                          if (renameSidebar) { setRenameSidebar(null); return; }
                          item.is_dir ? navigateDir(item.path) : openFile(item.path);
                        }}
                        onContextMenu={e => handleSidebarContext(e, item)}
                        onMouseEnter={e => e.currentTarget.style.background = c.sidebarHover}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        {item.is_dir ? (
                          <Folder size={13} style={{ color: c.iconColor, flexShrink: 0 }} />
                        ) : (
                          <FileText size={13} style={{ color: getFileIconColor(item.name), flexShrink: 0 }} />
                        )}
                        {renameSidebar === item.name ? (
                          <input ref={renameSidebarRef} autoFocus value={renameSidebarVal}
                            onChange={e => setRenameSidebarVal(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') doSidebarRename(); if (e.key === 'Escape') setRenameSidebar(null); }}
                            onBlur={() => doSidebarRename()}
                            onClick={e => e.stopPropagation()}
                            style={{
                              flex: 1, padding: '1px 4px', fontSize: 12,
                              border: `1px solid ${c.border}`, borderRadius: 3,
                              background: c.bg, color: c.text, outline: 'none',
                            }}
                          />
                        ) : (
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div style={{ padding: '12px' }}>
                  <div style={{ fontSize: 11, color: c.textDim, marginBottom: 10, lineHeight: 1.5 }}>
                    No folder opened
                  </div>
                  <button onClick={openFolderDialog}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                      padding: '5px 8px', border: 'none', borderRadius: 4,
                      background: 'none', color: c.fileIconColor, fontSize: 12,
                      cursor: 'pointer', fontWeight: 500,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = c.sidebarHover}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <FolderOpen size={14} />
                    <span>Open Folder</span>
                  </button>
                  <button onClick={() => { setNewFileName(''); setShowEmptyNewFile(true); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                      padding: '5px 8px', border: 'none', borderRadius: 4,
                      background: 'none', color: c.fileIconColor, fontSize: 12,
                      cursor: 'pointer', fontWeight: 500, marginTop: 2,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = c.sidebarHover}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <FileText size={14} />
                    <span>Create File</span>
                  </button>
                  {showEmptyNewFile && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                      <input autoFocus value={newFileName}
                        onChange={e => setNewFileName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleCreateNoFolder();
                          if (e.key === 'Escape') setShowEmptyNewFile(false);
                        }}
                        placeholder="filename.ext"
                        style={{
                          flex: 1, padding: '4px 6px', fontSize: 11,
                          border: `1px solid ${c.border}`, borderRadius: 4,
                          background: c.bg, color: c.text, outline: 'none',
                        }}
                      />
                      <button onClick={handleCreateNoFolder}
                        style={{
                          padding: '3px 8px', border: 'none', borderRadius: 4,
                          background: c.btnBg, color: c.btnText, fontSize: 11,
                          cursor: 'pointer', fontWeight: 600,
                        }}>Create</button>
                      <button onClick={() => setShowEmptyNewFile(false)}
                        style={{
                          padding: '3px 6px', border: `1px solid ${c.border}`, borderRadius: 4,
                          background: 'none', color: c.textMuted, fontSize: 11,
                          cursor: 'pointer',
                        }}><X size={11} /></button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main area */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {/* Tabs */}
          {tabs.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', background: c.bgMenu, borderBottom: `1px solid ${c.border}`, minHeight: 35, flexShrink: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', overflow: 'auto', flex: 1, alignItems: 'center' }}>
                {tabs.map((tab, idx) => (
                  <div key={tab.path}
                    draggable
                    onDragStart={() => { dragTabRef.current = idx; }}
                    onDragOver={(e) => { e.preventDefault(); }}
                    onDrop={() => {
                      if (dragTabRef.current === null || dragTabRef.current === idx) return;
                      setTabs(prev => {
                        const arr = [...prev];
                        const [moved] = arr.splice(dragTabRef.current!, 1);
                        arr.splice(idx, 0, moved);
                        return arr;
                      });
                      dragTabRef.current = null;
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', padding: '6px 12px',
                      borderRight: `1px solid ${c.border}`, borderBottom: '1px solid transparent',
                      cursor: 'pointer', gap: 4, userSelect: 'none',
                      background: tab.path === activePath ? c.bg : c.tabInactiveBg,
                    }}
                    onClick={() => setActivePath(tab.path)}
                  >
                    <span style={{ fontSize: 13, color: tab.path === activePath ? c.text : c.textMuted, whiteSpace: 'nowrap' }}>
                      {tab.name}
                    </span>
                    {!tab.saved && <span style={{ color: '#ff9500', marginLeft: 4, fontSize: 16 }}>●</span>}
                    <X size={13} style={{ marginLeft: 6, cursor: 'pointer', color: c.textDim, flexShrink: 0 }}
                      onClick={(e) => closeTab(tab.path, e)} />
                  </div>
                ))}
                {/* | + new */}
                <span style={{ color: c.textDim, fontSize: 14, marginLeft: 4 }}>|</span>
                <button onClick={addUntitledTab}
                  style={{
                    background: 'none', border: 'none', color: c.textMuted, cursor: 'pointer',
                    padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 3,
                    fontSize: 13, fontWeight: 500,
                  }}
                  title="Create New File"
                  onMouseEnter={e => e.currentTarget.style.color = c.text}
                  onMouseLeave={e => e.currentTarget.style.color = c.textMuted}
                >
                  <Plus size={14} />
                  <span>new</span>
                </button>
              </div>
            </div>
          )}

          {/* Editor */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {activeTab ? (
              <Editor key={activeTab.path} defaultLanguage={activeTab.language} theme={monacoTheme}
                value={activeTab.content} onChange={handleContentChange} onMount={handleEditorMount}
                options={{
                  fontSize: 14,
                  fontFamily: "'Menlo', 'Monaco', 'Fira Code', 'Courier New', monospace",
                  minimap: { enabled: true }, scrollBeyondLastLine: false,
                  lineNumbers: 'on', tabSize: 2, automaticLayout: true,
                  wordWrap: 'off', smoothScrolling: true, cursorBlinking: 'smooth',
                  cursorSmoothCaretAnimation: 'on', padding: { top: 8 },
                }}
              />
            ) : (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: c.textDim }}>
                <div style={{ display: 'flex', gap: 48, alignItems: 'flex-start' }}>
                  {/* Left: Start section */}
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 200, color: c.text, marginBottom: 24, opacity: 0.8 }}>CloudBanana Code Editor</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>Start</div>
                    <button onClick={addUntitledTab}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                        padding: '6px 12px', background: 'none', border: 'none',
                        borderRadius: 4, color: c.text, fontSize: 13, cursor: 'pointer',
                        textAlign: 'left', transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = c.sidebarHover}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <FileText size={16} style={{ color: c.fileIconColor, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 13 }}>New File...</div>
                        <div style={{ fontSize: 11, color: c.textDim }}>Create a new file</div>
                      </div>
                    </button>
                    <button onClick={openFileDialog}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                        padding: '6px 12px', background: 'none', border: 'none',
                        borderRadius: 4, color: c.text, fontSize: 13, cursor: 'pointer',
                        textAlign: 'left', transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = c.sidebarHover}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <FolderOpen size={16} style={{ color: c.fileIconColor, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 13 }}>Open File...</div>
                        <div style={{ fontSize: 11, color: c.textDim }}>Browse and open a file</div>
                      </div>
                    </button>
                    <button onClick={openFolderDialog}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                        padding: '6px 12px', background: 'none', border: 'none',
                        borderRadius: 4, color: c.text, fontSize: 13, cursor: 'pointer',
                        textAlign: 'left', transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = c.sidebarHover}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <Folder size={16} style={{ color: c.fileIconColor, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 13 }}>Open Folder...</div>
                        <div style={{ fontSize: 11, color: c.textDim }}>Browse and open a folder</div>
                      </div>
                    </button>
                  </div>
                  {/* Right: Help section */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>Help</div>
                    <button onClick={() => setShowAbout(true)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                        padding: '6px 12px', background: 'none', border: 'none',
                        borderRadius: 4, color: c.text, fontSize: 13, cursor: 'pointer',
                        textAlign: 'left', transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = c.sidebarHover}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <Info size={16} style={{ color: c.fileIconColor, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 13 }}>About</div>
                        <div style={{ fontSize: 11, color: c.textDim }}>Version info</div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Status Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 12px', background: c.statusBg, borderTop: `1px solid ${c.border}`, minHeight: 24, flexShrink: 0, fontSize: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {activeTab && (
                <>
                  <span style={{ color: c.textMuted, fontSize: 12 }}>Ln {cursorPos.line}, Col {cursorPos.col}</span>
                  <span style={{ color: c.textMuted, fontSize: 12 }}>{activeTab.language}</span>
                  <span style={{ color: c.textMuted, fontSize: 12 }}>UTF-8</span>
                </>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {activeTab && (
                <span style={{ color: activeTab.saved ? c.textMuted : '#ff9500', fontSize: 12 }}>
                  {activeTab.saved ? 'Saved' : 'Unsaved'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
        {/* Terminal panel */}
        {showTerminal && (
          <div style={{ height: 200, borderTop: `1px solid ${c.border}`, display: 'flex', flexDirection: 'column', background: c.bgAlt }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 8px', background: c.bgMenu, borderBottom: `1px solid ${c.border}`, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <TerminalIcon size={13} style={{ color: c.textMuted }} />
                <span style={{ fontSize: 11, color: c.textMuted }}>Terminal</span>
              </div>
              <button onClick={() => setShowTerminal(false)}
                style={{ background: 'none', border: 'none', color: c.textDim, cursor: 'pointer', padding: 2, display: 'flex' }}
                title="Close Terminal">
                <X size={13} />
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <TerminalPanel winId={undefined} />
            </div>
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleLocalFile} />
      <input ref={folderInputRef} type="file" style={{ display: 'none' }} onChange={handleLocalFolder} {...{ webkitdirectory: '' as any }} />



      {/* Save As dialog: triggered when saving an untitled file */}
      {showSaveDialog && (
        <div style={{ position: 'fixed', inset: 0, background: c.overlay, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => { setShowSaveDialog(false); pendingNewFileRef.current = false; }}>
          <div style={{ background: c.dialogBg, border: `1px solid ${c.border}`, borderRadius: 12, padding: 20, maxWidth: 400, width: '90%' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 14, fontWeight: 600, color: c.text, marginBottom: 12 }}>Save File</div>
            <div style={{ fontSize: 12, color: c.textMuted, marginBottom: 4 }}>Location:</div>
            <div style={{ fontSize: 12, color: c.textDim, marginBottom: 12, wordBreak: 'break-all', padding: '4px 8px', background: c.bgAlt, borderRadius: 4 }}>{saveDirPath}</div>
            <input autoFocus value={newFileName}
              onChange={e => setNewFileName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') doSaveAs(); if (e.key === 'Escape') setShowSaveDialog(false); }}
              placeholder="filename.ext"
              style={{
                width: '100%', padding: '8px 10px', border: `1px solid ${c.border}`,
                borderRadius: 6, background: c.bg, color: c.text, fontSize: 13,
                outline: 'none', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button onClick={() => { setShowSaveDialog(false); pendingNewFileRef.current = false; }}
                style={{ padding: '6px 16px', border: `1px solid ${c.border}`, borderRadius: 6, background: 'none', color: c.textMuted, fontSize: 12, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={doSaveAs}
                style={{ padding: '6px 16px', border: 'none', borderRadius: 6, background: c.btnBg, color: c.btnText, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar context menu */}
      {sidebarCtx && (
        <div style={{ position: 'fixed', left: sidebarCtx.x, top: sidebarCtx.y, background: c.dropdownBg, border: `1px solid ${c.dropdownBorder}`, borderRadius: 6, minWidth: 160, padding: '4px 0', zIndex: 10000, boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
          {!sidebarCtx.item.is_dir && (
            <button style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 12px', background: 'none', border: 'none', color: c.text, fontSize: 12, cursor: 'pointer', textAlign: 'left' }}
              onClick={() => { openFile(sidebarCtx.item.path); closeSidebarCtx(); }}
              onMouseEnter={e => e.currentTarget.style.background = c.sidebarHover}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <ExternalLink size={13} style={{ color: c.iconColor }} /> Open
            </button>
          )}
          {sidebarCtx.item.is_dir && (
            <button style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 12px', background: 'none', border: 'none', color: c.text, fontSize: 12, cursor: 'pointer', textAlign: 'left' }}
              onClick={() => { navigateDir(sidebarCtx.item.path); closeSidebarCtx(); }}
              onMouseEnter={e => e.currentTarget.style.background = c.sidebarHover}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <Folder size={13} style={{ color: c.iconColor }} /> Open
            </button>
          )}
          <button style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 12px', background: 'none', border: 'none', color: c.text, fontSize: 12, cursor: 'pointer', textAlign: 'left' }}
            onClick={() => { handleSidebarRename(sidebarCtx.item); }}
            onMouseEnter={e => e.currentTarget.style.background = c.sidebarHover}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <Edit3 size={13} style={{ color: c.iconColor }} /> Rename
          </button>
          <button style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 12px', background: 'none', border: 'none', color: c.text, fontSize: 12, cursor: 'pointer', textAlign: 'left' }}
            onClick={() => { copyToClipboard(sidebarCtx.item.path); }}
            onMouseEnter={e => e.currentTarget.style.background = c.sidebarHover}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <Copy size={13} style={{ color: c.iconColor }} /> Copy Path
          </button>
          <div style={{ height: 1, background: c.border, margin: '4px 8px' }} />
          <button style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 12px', background: 'none', border: 'none', color: '#f87171', fontSize: 12, cursor: 'pointer', textAlign: 'left' }}
            onClick={() => { handleSidebarDelete(sidebarCtx.item); }}
            onMouseEnter={e => e.currentTarget.style.background = c.sidebarHover}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>
      )}

      {/* Delete confirm dialog */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: c.overlay, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setDeleteConfirm(null)}>
          <div style={{ background: c.dialogBg, border: `1px solid ${c.border}`, borderRadius: 12, padding: 24, maxWidth: 360, width: '90%' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 14, fontWeight: 600, color: c.text, marginBottom: 8 }}>Delete</div>
            <p style={{ fontSize: 13, color: c.textMuted, margin: '0 0 16px', lineHeight: 1.5 }}>
              Are you sure you want to delete <strong style={{ color: c.text }}>{deleteConfirm.name}</strong>?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setDeleteConfirm(null)}
                style={{ padding: '6px 16px', border: `1px solid ${c.border}`, borderRadius: 6, background: 'none', color: c.textMuted, fontSize: 12, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={doSidebarDelete}
                style={{ padding: '6px 16px', border: 'none', borderRadius: 6, background: '#dc2626', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showAbout && (
        <div style={{ position: 'fixed', inset: 0, background: c.overlay, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setShowAbout(false)}>
          <div style={{ background: c.dialogBg, border: `1px solid ${c.border}`, borderRadius: 12, padding: 24, maxWidth: 360, width: '90%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Info size={20} style={{ color: c.fileIconColor }} />
              <h3 style={{ margin: 0, fontSize: 15, color: c.text }}>About Code Editor</h3>
            </div>
            <p style={{ fontSize: 13, color: c.textMuted, margin: '0 0 8px', lineHeight: 1.5 }}>CloudBanana Code Editor v1.0</p>
            <p style={{ fontSize: 12, color: c.textDim, margin: 0, lineHeight: 1.5 }}>Built with Monaco Editor — the same engine that powers VS Code.</p>
            <button style={{ marginTop: 16, padding: '6px 20px', border: 'none', borderRadius: 6, background: c.btnBg, color: c.btnText, fontSize: 13, cursor: 'pointer', display: 'block', marginLeft: 'auto' }}
              onClick={() => setShowAbout(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

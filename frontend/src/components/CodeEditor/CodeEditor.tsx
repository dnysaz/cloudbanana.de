import { useState, useEffect, useRef } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import { api } from '../../api';
import { useDesktopStore } from '../../store/desktopStore';
import type { FileItem } from '../../types';
import {
  Folder, File, ChevronRight, ChevronDown, Save, X, PanelLeftClose, PanelLeft,
  Info, FileText,
} from 'lucide-react';

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
});

function getLang(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (filename.toLowerCase() === 'dockerfile') return 'dockerfile';
  return LANG_MAP[ext] || 'plaintext';
}

interface OpenTab {
  path: string;
  name: string;
  language: string;
  content: string;
  original: string;
  saved: boolean;
}

interface TreeNode {
  name: string;
  path: string;
  is_dir: boolean;
  expanded: boolean;
  children: TreeNode[];
  loading?: boolean;
}

function TreeIcon({ node, onToggle }: { node: TreeNode; onToggle: (path: string) => void }) {
  if (!node.is_dir) {
    const ext = node.name.split('.').pop()?.toLowerCase() || '';
    const isCode = !!LANG_MAP[ext] || ['dockerfile'].includes(node.name.toLowerCase());
    return (
      <span style={{ width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {isCode ? <CodeIcon /> : <FileIcon />}
      </span>
    );
  }
  return (
    <span
      onClick={(e) => { e.stopPropagation(); onToggle(node.path); }}
      style={{ width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}
    >
      {node.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
    </span>
  );
}

function CodeIcon() {
  return <FileText size={14} style={{ color: '#569cd6' }} />;
}

function FileIcon() {
  return <File size={14} style={{ color: '#8a8aaa' }} />;
}

export default function CodeEditor({ winId, winData }: Props) {
  const { closeWindow } = useDesktopStore();
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rootPath, setRootPath] = useState('/root');
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [showMenu, setShowMenu] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<any>(null);

  useEffect(() => {
    const p = winData?.path as string | undefined;
    if (p) {
      setRootPath(p.startsWith('/') ? (p.split('/').slice(0, -1).join('/') || '/') : '/root');
      openFile(p);
    } else {
      loadTree('/root');
    }
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(null);
    };
    if (showMenu) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  const activeTab = tabs.find(t => t.path === activePath) || null;

  const loadTree = async (dir: string) => {
    setTreeLoading(true);
    try {
      const data = await api.get<{ path: string; items: FileItem[] }>(`/files?path=${encodeURIComponent(dir)}`);
      const nodes: TreeNode[] = data.items.map((item: FileItem) => ({
        name: item.name,
        path: (data.path.endsWith('/') ? data.path : data.path + '/') + item.name,
        is_dir: item.is_dir,
        expanded: false,
        children: [],
      }));
      setTree(nodes);
    } catch { setTree([]); }
    setTreeLoading(false);
  };

  const expandDir = async (dirPath: string) => {
    const upd = (nodes: TreeNode[]): TreeNode[] => nodes.map(n => {
      if (n.path === dirPath && n.is_dir) {
        return { ...n, expanded: !n.expanded, loading: true };
      }
      if (n.expanded && n.children.length > 0) {
        return { ...n, children: upd(n.children) };
      }
      return n;
    });
    setTree(prev => upd(prev));
    try {
      const data = await api.get<{ path: string; items: FileItem[] }>(`/files?path=${encodeURIComponent(dirPath)}`);
      const children: TreeNode[] = data.items.map((item: FileItem) => ({
        name: item.name,
        path: (data.path.endsWith('/') ? data.path : data.path + '/') + item.name,
        is_dir: item.is_dir,
        expanded: false,
        children: [],
      }));
      const upd2 = (nodes: TreeNode[]): TreeNode[] => nodes.map(n => {
        if (n.path === dirPath && n.is_dir) {
          return { ...n, expanded: !n.expanded, children, loading: false };
        }
        if (n.expanded && n.children.length > 0) return { ...n, children: upd2(n.children) };
        return n;
      });
      setTree(prev => upd2(prev));
    } catch {
      const upd3 = (nodes: TreeNode[]): TreeNode[] => nodes.map(n => {
        if (n.path === dirPath) return { ...n, loading: false };
        return n;
      });
      setTree(prev => upd3(prev));
    }
  };

  const openFile = async (filePath: string) => {
    if (tabs.find(t => t.path === filePath)) {
      setActivePath(filePath);
      return;
    }
    try {
      const data = await api.post<{ content: string }>('/files/read', { path: filePath });
      const name = filePath.split('/').pop() || 'untitled';
      const tab: OpenTab = {
        path: filePath,
        name,
        language: getLang(name),
        content: data.content,
        original: data.content,
        saved: true,
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

  const handleEditorMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    editor.onDidChangeCursorPosition((e: any) => {
      setCursorPos({ line: e.position.lineNumber, col: e.position.column });
    });
    editor.addAction({
      id: 'save-file',
      label: 'Save File',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: () => handleSave(),
    });
  };

  const openFileDialog = () => {
    const p = prompt('Enter file path:');
    if (p) openFile(p);
  };

  const openFolderDialog = () => {
    const p = prompt('Enter folder path:');
    if (p) {
      setRootPath(p);
      loadTree(p);
    }
  };

  const openLocalFile = () => {
    fileInputRef.current?.click();
  };

  const handleLocalFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const tab: OpenTab = {
      path: file.name,
      name: file.name,
      language: getLang(file.name),
      content: text,
      original: text,
      saved: true,
    };
    setTabs(prev => [...prev, tab]);
    setActivePath(file.name);
    e.target.value = '';
  };

  const openLocalFolder = () => {
    folderInputRef.current?.click();
  };

  const handleLocalFolder = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const file = files[0];
    if (file) {
      const text = await file.text();
      const tab: OpenTab = {
        path: file.name,
        name: file.name,
        language: getLang(file.name),
        content: text,
        original: text,
        saved: true,
      };
      setTabs(prev => [...prev, tab]);
      setActivePath(file.name);
    }
    e.target.value = '';
  };

  const renderTree = (nodes: TreeNode[], depth = 0) => nodes.map(node => (
    <div key={node.path}>
      <div
        style={{
          ...treeItemStyle,
          paddingLeft: 8 + depth * 16,
          background: activePath === node.path ? '#2a2a5e' : undefined,
        }}
        onClick={() => {
          if (node.is_dir) expandDir(node.path);
          else openFile(node.path);
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <TreeIcon node={node} onToggle={expandDir} />
        <span style={{ marginLeft: 4, fontSize: 13, color: node.is_dir ? '#d4d4d4' : '#c0c0d0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.name}
        </span>
      </div>
      {node.expanded && node.children.length > 0 && renderTree(node.children, depth + 1)}
    </div>
  ));

  const menuItems: Record<string, { label: string; action: () => void; divider?: boolean }[]> = {
    File: [
      { label: 'Open File...', action: openFileDialog },
      { label: 'Open Folder...', action: openFolderDialog },
      { label: 'Open Local File...', action: openLocalFile },
      { label: 'Open Local Folder...', action: openLocalFolder, divider: true },
      { label: 'Exit', action: () => winId && closeWindow(winId) },
    ],
    Help: [
      { label: 'About', action: () => setShowAbout(true) },
    ],
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1a1a2e' }}>
      {/* Menu Bar */}
      <div style={menuBarStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {['File', 'Help'].map(menu => (
            <div key={menu} style={{ position: 'relative' }}>
              <button
                style={menuBtnStyle}
                onClick={() => setShowMenu(showMenu === menu ? null : menu)}
                onMouseEnter={() => showMenu && setShowMenu(menu)}
              >
                {menu}
              </button>
              {showMenu === menu && (
                <div ref={menuRef} style={menuDropdownStyle}>
                  {menuItems[menu].map((item, i) => (
                    <div key={i}>
                      <button style={menuItemStyle} onClick={() => { setShowMenu(null); item.action(); }}>
                        {item.label}
                      </button>
                      {item.divider && <div style={menuDividerStyle} />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button style={iconBtnStyle} onClick={() => setSidebarOpen(!sidebarOpen)} title="Toggle Sidebar">
            {sidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeft size={15} />}
          </button>
          <button style={iconBtnStyle} onClick={handleSave} title="Save (Ctrl+S)">
            <Save size={15} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        {sidebarOpen && (
          <div style={sidebarStyle}>
            <div style={sidebarHeaderStyle}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#8a8aaa', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Explorer
              </span>
            </div>
            <div style={{ padding: '4px 0' }}>
              <button style={sidebarBtnStyle} onClick={() => loadTree(rootPath)}>
                <Folder size={13} /> <span style={{ marginLeft: 4, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>{rootPath}</span>
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {treeLoading ? (
                <div style={{ padding: 12, color: '#666', fontSize: 12 }}>Loading...</div>
              ) : tree.length === 0 ? (
                <div style={{ padding: 12, color: '#666', fontSize: 12 }}>Open a folder to explore</div>
              ) : renderTree(tree)}
            </div>
          </div>
        )}

        {/* Main area */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {/* Tabs */}
          {tabs.length > 0 && (
            <div style={tabsBarStyle}>
              <div style={{ display: 'flex', overflow: 'auto', flex: 1 }}>
                {tabs.map(tab => (
                  <div
                    key={tab.path}
                    style={{
                      ...tabStyle,
                      background: tab.path === activePath ? '#1a1a2e' : '#16162a',
                      borderBottomColor: tab.path === activePath ? '#1a1a2e' : 'transparent',
                    }}
                    onClick={() => setActivePath(tab.path)}
                  >
                    <span style={{ fontSize: 13, color: tab.path === activePath ? '#d4d4d4' : '#8a8aaa', whiteSpace: 'nowrap' }}>
                      {tab.name}
                    </span>
                    {!tab.saved && <span style={{ color: '#ff9500', marginLeft: 4, fontSize: 16 }}>●</span>}
                    <X
                      size={13}
                      style={{ marginLeft: 6, cursor: 'pointer', color: '#666', flexShrink: 0 }}
                      onClick={(e) => closeTab(tab.path, e)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Editor */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {activeTab ? (
              <Editor
                key={activeTab.path}
                defaultLanguage={activeTab.language}
                theme="cloudbanana-dark"
                value={activeTab.content}
                onChange={handleContentChange}
                onMount={handleEditorMount}
                options={{
                  fontSize: 14,
                  fontFamily: "'Menlo', 'Monaco', 'Fira Code', 'Courier New', monospace",
                  minimap: { enabled: true },
                  scrollBeyondLastLine: false,
                  lineNumbers: 'on',
                  tabSize: 2,
                  automaticLayout: true,
                  wordWrap: 'off',
                  smoothScrolling: true,
                  cursorBlinking: 'smooth',
                  cursorSmoothCaretAnimation: 'on',
                  padding: { top: 8 },
                }}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#555', gap: 16 }}>
                <FileText size={48} style={{ opacity: 0.3 }} />
                <div style={{ fontSize: 14, color: '#666' }}>No file open</div>
                <div style={{ fontSize: 12, color: '#555' }}>
                  Use File &gt; Open File or browse files in the sidebar
                </div>
              </div>
            )}
          </div>

          {/* Status Bar */}
          <div style={statusBarStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {activeTab && (
                <>
                  <span style={statusItemStyle}>Ln {cursorPos.line}, Col {cursorPos.col}</span>
                  <span style={statusItemStyle}>{activeTab.language}</span>
                  <span style={statusItemStyle}>UTF-8</span>
                </>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {activeTab && (
                <span style={{ ...statusItemStyle, color: activeTab.saved ? '#8a8aaa' : '#ff9500' }}>
                  {activeTab.saved ? 'Saved' : 'Unsaved'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleLocalFile} />
      <input ref={folderInputRef} type="file" style={{ display: 'none' }} onChange={handleLocalFolder} {...{ webkitdirectory: '' as any }} />

      {/* About Dialog */}
      {showAbout && (
        <div style={overlayStyle} onClick={() => setShowAbout(false)}>
          <div style={dialogStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Info size={20} style={{ color: '#569cd6' }} />
              <h3 style={{ margin: 0, fontSize: 15, color: '#d4d4d4' }}>About Code Editor</h3>
            </div>
            <p style={{ fontSize: 13, color: '#8a8aaa', margin: '0 0 8px', lineHeight: 1.5 }}>
              CloudBanana Code Editor v1.0
            </p>
            <p style={{ fontSize: 12, color: '#666', margin: 0, lineHeight: 1.5 }}>
              Built with Monaco Editor — the same engine that powers VS Code.
            </p>
            <button style={dialogBtnStyle} onClick={() => setShowAbout(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

const menuBarStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  background: '#12121e', borderBottom: '1px solid #2a2a4e',
  padding: '0 4px', height: 32, flexShrink: 0,
};

const menuBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: '#b0b0c0', cursor: 'pointer',
  padding: '4px 10px', fontSize: 13, borderRadius: 4,
};

const menuDropdownStyle: React.CSSProperties = {
  position: 'absolute', top: '100%', left: 0, background: '#1e1e3a',
  border: '1px solid #2a2a4e', borderRadius: 6, minWidth: 200,
  padding: '4px 0', zIndex: 1000, boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
};

const menuItemStyle: React.CSSProperties = {
  display: 'block', width: '100%', padding: '6px 16px', background: 'none',
  border: 'none', color: '#d4d4d4', fontSize: 13, textAlign: 'left', cursor: 'pointer',
};

const menuDividerStyle: React.CSSProperties = {
  height: 1, background: '#2a2a4e', margin: '4px 8px',
};

const iconBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: '#8a8aaa', cursor: 'pointer',
  padding: '4px 6px', borderRadius: 4, display: 'flex', alignItems: 'center',
};

const sidebarStyle: React.CSSProperties = {
  width: 240, minWidth: 240, display: 'flex', flexDirection: 'column',
  background: '#16162a', borderRight: '1px solid #2a2a4e', overflow: 'hidden',
};

const sidebarHeaderStyle: React.CSSProperties = {
  padding: '8px 12px', borderBottom: '1px solid #2a2a4e',
};

const sidebarBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', width: '100%', padding: '3px 12px',
  background: 'none', border: 'none', color: '#8a8aaa', cursor: 'pointer', fontSize: 12,
};

const treeItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 2, padding: '2px 8px',
  cursor: 'pointer', borderRadius: 0, userSelect: 'none',
};

const tabsBarStyle: React.CSSProperties = {
  display: 'flex', background: '#12121e', borderBottom: '1px solid #2a2a4e',
  minHeight: 35, flexShrink: 0, overflow: 'hidden',
};

const tabStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', padding: '6px 12px',
  borderRight: '1px solid #2a2a4e', borderBottom: '1px solid transparent',
  cursor: 'pointer', gap: 4, userSelect: 'none',
};

const statusBarStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '2px 12px', background: '#12121e', borderTop: '1px solid #2a2a4e',
  minHeight: 24, flexShrink: 0, fontSize: 12,
};

const statusItemStyle: React.CSSProperties = {
  color: '#8a8aaa', fontSize: 12,
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
};

const dialogStyle: React.CSSProperties = {
  background: '#1e1e3a', border: '1px solid #2a2a4e', borderRadius: 12,
  padding: 24, maxWidth: 360, width: '90%',
};

const dialogBtnStyle: React.CSSProperties = {
  marginTop: 16, padding: '6px 20px', border: 'none', borderRadius: 6,
  background: '#3a3a6e', color: '#d4d4d4', fontSize: 13, cursor: 'pointer',
  display: 'block', marginLeft: 'auto',
};

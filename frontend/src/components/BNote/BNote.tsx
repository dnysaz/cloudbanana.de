import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../api';
import { useDesktopStore } from '../../store/desktopStore';
import { FileText, Save, Download, X, Plus, Folder, ChevronRight, ArrowUpCircle, FolderOpen, Info } from 'lucide-react';

interface Props {
  winId?: string;
  winData?: Record<string, unknown>;
}

const LANG_MAP: Record<string, string> = {
  html: 'HTML', htm: 'HTML', xml: 'XML', svg: 'SVG',
  css: 'CSS', scss: 'SCSS', less: 'LESS',
  js: 'JavaScript', jsx: 'JSX', mjs: 'JavaScript',
  ts: 'TypeScript', tsx: 'TSX',
  json: 'JSON',
  py: 'Python', pyw: 'Python',
  php: 'PHP',
  sh: 'Shell', bash: 'Shell', zsh: 'Shell',
  sql: 'SQL',
  yaml: 'YAML', yml: 'YAML',
  md: 'Markdown', markdown: 'Markdown',
  c: 'C', h: 'C',
  cpp: 'C++', cc: 'C++', cxx: 'C++', hpp: 'C++',
  java: 'Java',
  go: 'Go',
  rs: 'Rust',
  rb: 'Ruby',
  swift: 'Swift',
  kt: 'Kotlin',
  dart: 'Dart',
  txt: 'Text', log: 'Log',
};

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getLangLabel(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return LANG_MAP[ext] || 'Text';
}

interface TabData {
  id: string;
  filePath?: string;
  fileName: string;
  content: string;
  originalContent: string;
  saved: boolean;
  error: string;
  loading: boolean;
  cursorLine: number;
  cursorCol: number;
}

let globalTabId = 1;
function nextTabId(): string {
  return 'tab_' + (globalTabId++);
}

function createTab(filePath?: string, fileName?: string): TabData {
  return {
    id: nextTabId(),
    filePath,
    fileName: fileName || 'Untitled',
    content: '',
    originalContent: '',
    saved: false,
    error: '',
    loading: !!filePath,
    cursorLine: 1,
    cursorCol: 1,
  };
}

export default function BNote({ winId, winData }: Props) {
  const { setWindowData, openWindow } = useDesktopStore();
  const { closeWindow } = useDesktopStore();

  const initialPath = winData?.path as string | undefined;
  const initialFileName = initialPath?.split('/').pop() || (winData?.fileName as string) || 'Untitled';

  const [tabs, setTabs] = useState<TabData[]>(() => [createTab(initialPath, initialFileName)]);
  const [activeTab, setActiveTab] = useState(0);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showSaveAs, setShowSaveAs] = useState(false);
  const [saveAsPath, setSaveAsPath] = useState('/root');
  const [saveAsName, setSaveAsName] = useState('untitled.txt');
  const [browseItems, setBrowseItems] = useState<{ name: string; is_dir: boolean }[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState('');
  const [showOpenFile, setShowOpenFile] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [openFilePath, setOpenFilePath] = useState('/root');
  const [openFileItems, setOpenFileItems] = useState<{ name: string; is_dir: boolean; size: number }[]>([]);
  const [openFileLoading, setOpenFileLoading] = useState(false);
  const [openFileError, setOpenFileError] = useState('');
  const [wordWrap, setWordWrap] = useState(true);
  const [fontSize, setFontSize] = useState(14);
  const justSavedRef = useRef(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const linesRef = useRef<HTMLDivElement>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);

  const tab = tabs[activeTab];
  const isNewFile = !tab?.filePath;
  const hasChanges = tab ? tab.content !== tab.originalContent : false;
  const lang = tab ? getLangLabel(tab.fileName) : 'Text';
  const lineCount = tab ? tab.content.split('\n').length : 1;

  // Load file content for initial tab
  useEffect(() => {
    if (!initialPath || !tab || tab.loading === false) return;
    (async () => {
      if (justSavedRef.current) {
        justSavedRef.current = false;
        setTabs(prev => {
          const next = [...prev];
          if (next[0]) next[0] = { ...next[0], loading: false };
          return next;
        });
        return;
      }
      try {
        const data = await api.post<{ content: string }>('/files/read', { path: initialPath });
        setTabs(prev => {
          const next = [...prev];
          if (next[0]) next[0] = { ...next[0], content: data.content, originalContent: data.content, loading: false };
          return next;
        });
      } catch (e) {
        setTabs(prev => {
          const next = [...prev];
          if (next[0]) next[0] = { ...next[0], error: 'Failed to load: ' + (e instanceof Error ? e.message : ''), loading: false };
          return next;
        });
      }
    })();
  }, [initialPath]);

  // Update window data when tab changes
  useEffect(() => {
    if (winId && tab) {
      setWindowData(winId, { path: tab.filePath, fileName: tab.fileName });
    }
  }, [winId, tab?.filePath, tab?.fileName, setWindowData]);

  // Scroll sync
  const handleScroll = useCallback(() => {
    if (linesRef.current && taRef.current) {
      linesRef.current.scrollTop = taRef.current.scrollTop;
    }
  }, []);

  // Update cursor position
  const updateCursor = useCallback(() => {
    const ta = taRef.current;
    if (!ta || !tab) return;
    const pos = ta.selectionStart;
    const text = ta.value;
    let line = 1;
    let col = 1;
    for (let i = 0; i < pos; i++) {
      if (text[i] === '\n') { line++; col = 1; }
      else { col++; }
    }
    setTabs(prev => {
      const next = [...prev];
      const idx = activeTab;
      if (next[idx]) next[idx] = { ...next[idx], cursorLine: line, cursorCol: col };
      return next;
    });
  }, [activeTab]);

  // Load browse dir for Save As
  const loadBrowseDir = useCallback(async (dir: string) => {
    setBrowseLoading(true);
    setBrowseError('');
    try {
      const data = await api.get<{ path: string; items: { name: string; is_dir: boolean; size: number; mtime: string }[] }>('/files?path=' + encodeURIComponent(dir));
      setBrowseItems(data.items.filter(e => e.is_dir).sort((a, b) => a.name.localeCompare(b.name)));
      setSaveAsPath(dir);
    } catch (e) {
      setBrowseError('Failed to load directory: ' + (e instanceof Error ? e.message : ''));
      setBrowseItems([]);
    }
    setBrowseLoading(false);
  }, []);

  // Load files for Open File dialog
  const loadOpenDir = useCallback(async (dir: string) => {
    setOpenFileLoading(true);
    setOpenFileError('');
    try {
      const data = await api.get<{ path: string; items: { name: string; is_dir: boolean; size: number; mtime: string }[] }>('/files?path=' + encodeURIComponent(dir));
      const sorted = data.items.sort((a, b) => {
        if (a.is_dir && !b.is_dir) return -1;
        if (!a.is_dir && b.is_dir) return 1;
        return a.name.localeCompare(b.name);
      });
      setOpenFileItems(sorted);
      setOpenFilePath(dir);
    } catch (e) {
      setOpenFileError('Failed to load: ' + (e instanceof Error ? e.message : ''));
      setOpenFileItems([]);
    }
    setOpenFileLoading(false);
  }, []);

  useEffect(() => {
    if (showSaveAs) loadBrowseDir(saveAsPath);
  }, [showSaveAs, loadBrowseDir, saveAsPath]);

  useEffect(() => {
    if (showOpenFile) loadOpenDir(openFilePath);
  }, [showOpenFile, loadOpenDir, openFilePath]);

  // Tab operations
  const addTab = useCallback(() => {
    const newTab = createTab();
    // Clear draft for the new tab
    localStorage.removeItem('bnote-draft');
    setTabs(prev => [...prev, newTab]);
    setActiveTab(tabs.length);
  }, [tabs.length]);

  const closeTab = useCallback((idx: number) => {
    setTabs(prev => {
      const next = prev.filter((_, i) => i !== idx);
      if (next.length === 0) {
        if (winId) closeWindow(winId);
        return [createTab()];
      }
      return next;
    });
    setActiveTab(prev => {
      if (prev >= idx) return Math.max(0, prev - 1);
      return prev;
    });
  }, [winId, closeWindow]);

  const switchTab = useCallback((idx: number) => {
    setActiveTab(idx);
    setOpenMenu(null);
  }, []);

  const updateContent = useCallback((newContent: string) => {
    setTabs(prev => {
      const next = [...prev];
      if (next[activeTab]) next[activeTab] = { ...next[activeTab], content: newContent };
      return next;
    });
  }, [activeTab]);

  // Save
  const doSave = async (path: string) => {
    if (!tab) return;
    try {
      await api.post('/files/write', { path, content: tab.content });
      localStorage.removeItem('bnote-draft');
      justSavedRef.current = true;
      const newName = path.split('/').pop() || 'Untitled';
      setTabs(prev => {
        const next = [...prev];
        if (next[activeTab]) next[activeTab] = {
          ...next[activeTab],
          filePath: path,
          fileName: newName,
          originalContent: tab.content,
          saved: true,
        };
        return next;
      });
      if (winId) setWindowData(winId, { path, fileName: newName });
      setShowSaveAs(false);
      document.dispatchEvent(new CustomEvent('fm-navigate', { detail: { path: path.substring(0, path.lastIndexOf('/')) || '/' } }));
      setTimeout(() => {
        setTabs(prev => {
          const next = [...prev];
          if (next[activeTab]) next[activeTab] = { ...next[activeTab], saved: false };
          return next;
        });
      }, 2000);
    } catch (e) {
      setTabs(prev => {
        const next = [...prev];
        if (next[activeTab]) next[activeTab] = { ...next[activeTab], error: 'Save error: ' + (e instanceof Error ? e.message : '') };
        return next;
      });
    }
  };

  const handleSave = async () => {
    if (!tab) return;
    if (tab.filePath) await doSave(tab.filePath);
    else setShowSaveAs(true);
  };

  // Keyboard
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
      e.preventDefault();
      closeTab(activeTab);
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = taRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const curContent = tab?.content || '';
      const newVal = curContent.substring(0, start) + '  ' + curContent.substring(end);
      updateContent(newVal);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
        updateCursor();
      });
    }
  };

  const openFile = async (filePath: string) => {
    try {
      const data = await api.post<{ content: string }>('/files/read', { path: filePath });
      const name = filePath.split('/').pop() || 'Untitled';
      const newTab = createTab(filePath, name);
      newTab.content = data.content;
      newTab.originalContent = data.content;
      newTab.loading = false;
      setTabs(prev => [...prev, newTab]);
      setActiveTab(tabs.length);
      setShowOpenFile(false);
    } catch (e) {
      setOpenFileError('Failed to open: ' + (e instanceof Error ? e.message : ''));
    }
  };

  const downloadFile = () => {
    if (!tab) return;
    const name = isNewFile ? 'untitled.txt' : tab.fileName;
    const blob = new Blob([tab.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const lineNumWidth = lineCount > 999 ? '44px' : lineCount > 99 ? '38px' : '32px';

  if (tab?.loading) {
    return (
      <div className="bn">
        <div className="bn-loading">
          <FileText size={20} className="bn-spin" />
          <span>Loading file...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bn">
      {/* Tab Bar */}
      <div className="bn-tabbar" ref={tabBarRef}>
        <div className="bn-tablist">
          {tabs.map((t, i) => (
            <div
              key={t.id}
              className={`bn-tab${i === activeTab ? ' active' : ''}${t.content !== t.originalContent ? ' modified' : ''}`}
              onClick={() => switchTab(i)}
              onMouseDown={(e) => {
                // Middle-click to close
                if (e.button === 1) { e.preventDefault(); closeTab(i); }
              }}
            >
              <span className="bn-tab-icon"><FileText size={11} /></span>
              <span className="bn-tab-name">{t.fileName}</span>
              {t.content !== t.originalContent && <span className="bn-tab-dot">●</span>}
              <button
                className="bn-tab-close"
                onClick={(e) => { e.stopPropagation(); closeTab(i); }}
                title="Close tab"
              >
                <X size={10} />
              </button>
            </div>
          ))}
          <button className="bn-tab-add" onClick={addTab} title="New tab">
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Menu Bar */}
      <div className="bn-menubar">
        <div className="bn-menubar-left">
          <span className="bn-menubar-label">Notepad</span>
          <div className="bn-menubar-sep" />
          <div className="bn-menubar-menu" onMouseLeave={() => setOpenMenu(null)}>
            <button
              className={`bn-menu-btn${openMenu === 'File' ? ' open' : ''}`}
              onClick={() => setOpenMenu(openMenu === 'File' ? null : 'File')}
              onMouseEnter={() => openMenu && setOpenMenu('File')}
            >
              File
            </button>
            {openMenu === 'File' && (
              <div className="bn-menu-drop">
                <button className="bn-menu-item" onClick={() => { setShowOpenFile(true); setOpenMenu(null); }}>
                  <FolderOpen size={13} /> Open File...
                </button>
                <div className="bn-menu-sep" />
                <button className="bn-menu-item" onClick={() => { addTab(); setOpenMenu(null); }}>
                  <Plus size={13} /> New Tab
                </button>
                <button className="bn-menu-item" onClick={() => {
                  openWindow('bnote-' + Date.now(), 'Notepad', {});
                  setOpenMenu(null);
                }}>
                  <Plus size={13} /> New Window
                </button>
                <div className="bn-menu-sep" />
                <button className="bn-menu-item" onClick={() => { handleSave(); setOpenMenu(null); }}>
                  <Save size={13} /> Save
                </button>
                <button className="bn-menu-item" onClick={() => { setShowSaveAs(true); setOpenMenu(null); }}>
                  <Save size={13} /> Save As...
                </button>
                <button className="bn-menu-item" onClick={() => { downloadFile(); setOpenMenu(null); }}>
                  <Download size={13} /> Download
                </button>
                <div className="bn-menu-sep" />
                <button className="bn-menu-item" onClick={() => {
                  if (winId) closeWindow(winId);
                  setOpenMenu(null);
                }}>
                  <X size={13} /> Close Window
                </button>
                <div className="bn-menu-sep" />
                <button className="bn-menu-item" onClick={() => { setShowAbout(true); setOpenMenu(null); }}>
                  <Info size={13} /> About Notepad
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="bn-menubar-file">
          <span className="bn-file-icon"><FileText size={13} /></span>
          <span className="bn-file-name">{tab?.fileName || 'Untitled'}</span>
        </div>
        <div className="bn-menubar-right">
          <span className="bn-lang-badge">{lang}</span>
          <div className="bn-menubar-sep" />
          <button
            className={`bn-toggle-btn${wordWrap ? ' active' : ''}`}
            onClick={() => setWordWrap(!wordWrap)}
            title="Word Wrap"
          >
            <span style={{ fontSize: '0.55rem', fontWeight: 700 }}>W</span>
          </button>
          <select
            className="bn-font-select"
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            title="Font Size"
          >
            {[12, 13, 14, 15, 16, 18, 20, 22, 24].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {tab?.error && <div className="bn-error">{tab.error}</div>}

      {/* Editor */}
      <div className="bn-editor" key={tab?.id}>
        <div ref={linesRef} className="bn-lines" style={{ width: lineNumWidth }}>
          {Array.from({ length: lineCount || 1 }, (_, i) => (
            <div key={i} className="bn-line-num" style={{ fontSize: `${fontSize}px` }}>{i + 1}</div>
          ))}
        </div>
        <textarea
          ref={taRef}
          className="bn-textarea"
          style={{
            fontSize: `${fontSize}px`,
            left: lineNumWidth,
            width: `calc(100% - ${lineNumWidth})`,
            whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
            wordBreak: wordWrap ? 'break-all' : undefined,
          }}
          value={tab?.content || ''}
          onChange={(e) => {
            updateContent(e.target.value);
            requestAnimationFrame(updateCursor);
          }}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          onClick={updateCursor}
          onKeyUp={updateCursor}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          wrap={wordWrap ? 'on' : 'off'}
        />
      </div>

      {/* Status Bar */}
      <div className="bn-status">
        <span className="bn-status-item">Tab {activeTab + 1}/{tabs.length}</span>
        <span className="bn-status-sep" />
        <span className="bn-status-item">{lang}</span>
        <span className="bn-status-sep" />
        <span className="bn-status-item">Ln {tab?.cursorLine || 1}, Col {tab?.cursorCol || 1}</span>
        <span className="bn-status-sep" />
        <span className="bn-status-item">{lineCount} lines</span>
        <span className="bn-status-sep" />
        <span className="bn-status-item">{(tab?.content.length || 0)} chars</span>
        <span className="bn-status-sep" />
        <span className="bn-status-item">{new Blob([tab?.content || '']).size} bytes</span>
        <span className="bn-status-spacer" />
        {hasChanges && <span className="bn-status-modified">Modified</span>}
        {tab?.saved && <span className="bn-status-saved">Saved</span>}
      </div>

      {/* About Modal */}
      {showAbout && (
        <div className="dm-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowAbout(false); }}>
          <div className="dm-about-modal">
            <div className="dm-about">
              <div className="dm-about-header">
                <FileText size={20} />
                Notepad
              </div>
              <div className="dm-about-version">v1.0.0</div>
              <div className="dm-about-desc">
                A simple multi-tab notepad for editing code and text files.
                Supports syntax detection for HTML, JavaScript, Python, PHP, CSS, and many more.
              </div>
              <div className="dm-about-section">
                <h4>Features</h4>
                <ul>
                  <li>Multi-tab editing</li>
                  <li>Open files from server</li>
                  <li>Save / Save As</li>
                  <li>Word wrap toggle</li>
                  <li>Font size adjustment</li>
                  <li>Line numbers with cursor tracking</li>
                </ul>
              </div>
              <div className="dm-about-section">
                <h4>Shortcuts</h4>
                <ul>
                  <li><code>Ctrl+S</code> — Save</li>
                  <li><code>Ctrl+W</code> — Close tab</li>
                  <li><code>Tab</code> — Indent (2 spaces)</li>
                </ul>
              </div>
              <div className="dm-about-actions">
                <button className="dm-btn dm-btn-primary" onClick={() => setShowAbout(false)}>Got it</button>
              </div>
            </div>
            <button className="dm-about-close" onClick={() => setShowAbout(false)}>
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Open File Modal */}
      {showOpenFile && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowOpenFile(false); }}>
          <div className="modal-box bn-saveas">
            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <FolderOpen size={16} /> Open File
            </div>
            <div className="bn-saveas-pathbar">
              <button className="bn-saveas-up" onClick={() => {
                const parent = openFilePath.substring(0, openFilePath.lastIndexOf('/')) || '/';
                loadOpenDir(parent);
              }} disabled={openFilePath === '/'} title="Go up">
                <ArrowUpCircle size={15} />
              </button>
              <span className="bn-saveas-path">{openFilePath}</span>
            </div>
            <div className="bn-saveas-browser">
              {openFileLoading ? (
                <div className="bn-saveas-loading">Loading...</div>
              ) : openFileError ? (
                <div className="bn-saveas-error">{openFileError}</div>
              ) : openFileItems.length === 0 ? (
                <div className="bn-saveas-empty">Folder is empty</div>
              ) : (
                openFileItems.map((item) => (
                  <button key={item.name} className="bn-saveas-item"
                    onDoubleClick={() => {
                      const fullPath = openFilePath.replace(/\/$/, '') + '/' + item.name;
                      if (item.is_dir) loadOpenDir(fullPath);
                      else openFile(fullPath);
                    }}
                    onClick={() => {
                      if (item.is_dir) {
                        loadOpenDir(openFilePath.replace(/\/$/, '') + '/' + item.name);
                      }
                    }}>
                    {item.is_dir ? (
                      <Folder size={15} className="bn-saveas-item-icon" />
                    ) : (
                      <FileText size={15} className="bn-saveas-item-icon" style={{ color: '#9ca3af' }} />
                    )}
                    <span className="bn-saveas-item-name">{item.name}</span>
                    <span className="bn-saveas-item-size">{item.is_dir ? '' : formatFileSize(item.size)}</span>
                    {item.is_dir && <ChevronRight size={12} className="bn-saveas-item-arrow" />}
                  </button>
                ))
              )}
            </div>
            <div className="modal-actions" style={{ marginTop: '0.5rem' }}>
              <button className="modal-btn modal-btn-cancel" onClick={() => setShowOpenFile(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Save As Modal */}
      {showSaveAs && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowSaveAs(false); }}>
          <div className="modal-box bn-saveas">
            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Save size={16} /> Save As
            </div>
            <div className="bn-saveas-pathbar">
              <button className="bn-saveas-up" onClick={() => {
                const parent = saveAsPath.substring(0, saveAsPath.lastIndexOf('/')) || '/';
                loadBrowseDir(parent);
              }} disabled={saveAsPath === '/'} title="Go up">
                <ArrowUpCircle size={15} />
              </button>
              <span className="bn-saveas-path">{saveAsPath}</span>
            </div>
            <div className="bn-saveas-browser">
              {browseLoading ? (
                <div className="bn-saveas-loading">Loading...</div>
              ) : browseError ? (
                <div className="bn-saveas-error">{browseError}</div>
              ) : browseItems.length === 0 ? (
                <div className="bn-saveas-empty">No folders</div>
              ) : (
                browseItems.map((item) => (
                  <button key={item.name} className="bn-saveas-item"
                    onDoubleClick={() => loadBrowseDir(saveAsPath.replace(/\/$/, '') + '/' + item.name)}
                    onClick={() => loadBrowseDir(saveAsPath.replace(/\/$/, '') + '/' + item.name)}>
                    <Folder size={15} className="bn-saveas-item-icon" />
                    <span className="bn-saveas-item-name">{item.name}</span>
                    <ChevronRight size={12} className="bn-saveas-item-arrow" />
                  </button>
                ))
              )}
            </div>
            <div className="bn-saveas-footer">
              <label className="bn-saveas-label">File name:</label>
              <input className="bn-saveas-input" value={saveAsName}
                onChange={(e) => setSaveAsName(e.target.value)}
                placeholder="myfile.txt"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') doSave(saveAsPath.replace(/\/$/, '') + '/' + saveAsName);
                  if (e.key === 'Escape') setShowSaveAs(false);
                }} />
            </div>
            <div className="bn-saveas-preview">
              <Save size={12} />
              <span>{saveAsPath.replace(/\/$/, '') + '/' + saveAsName}</span>
            </div>
            <div className="modal-actions" style={{ marginTop: '0' }}>
              <button className="modal-btn modal-btn-cancel" onClick={() => setShowSaveAs(false)}>Cancel</button>
              <button className="modal-btn modal-btn-primary" onClick={() => doSave(saveAsPath.replace(/\/$/, '') + '/' + saveAsName)} disabled={!saveAsName.trim()}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

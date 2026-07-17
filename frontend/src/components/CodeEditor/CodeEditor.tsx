import { useState, useEffect, useRef, useCallback } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import { api } from '../../api';
import { Save, Check } from 'lucide-react';

interface Props {
  winId?: string;
  winData?: Record<string, unknown>;
}

const LANG_MAP: Record<string, string> = {
  js: 'javascript', jsx: 'javascript', mjs: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  py: 'python', pyw: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp',
  java: 'java', kt: 'kotlin', swift: 'swift',
  dart: 'dart',
  php: 'php', phtml: 'php', php3: 'php', php4: 'php', php5: 'php',
  html: 'html', htm: 'html', svg: 'xml',
  css: 'css', scss: 'scss', less: 'less',
  sql: 'sql',
  sh: 'shell', bash: 'shell', zsh: 'shell',
  yaml: 'yaml', yml: 'yaml',
  json: 'json',
  xml: 'xml',
  md: 'markdown', markdown: 'markdown',
  dockerfile: 'dockerfile',
  toml: 'plaintext',
  env: 'plaintext',
  ini: 'ini', cfg: 'ini', conf: 'ini',
  csv: 'plaintext',
  log: 'plaintext',
  txt: 'plaintext',
};

loader.init().then(monaco => {
  monaco.editor.defineTheme('cloudbanana-dark', {
    base: 'vs-dark',
    inherit: true,
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

export default function CodeEditor({ winId, winData }: Props) {
  const [content, setContent] = useState('');
  const [path, setPath] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);

  useEffect(() => {
    if (!winData) return;
    const filePath = winData.path as string | undefined;
    if (!filePath) { setLoading(false); return; }
    setPath(filePath);
    api.post<{ content: string }>('/files/read', { path: filePath })
      .then(data => {
        setContent(data.content);
        setOriginalContent(data.content);
        setLoading(false);
      })
      .catch(e => {
        setMsg('Failed to load: ' + (e instanceof Error ? e.message : ''));
        setLoading(false);
      });
  }, [winData, winId]);

  const handleEditorMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    editor.addAction({
      id: 'save-file',
      label: 'Save File',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: () => handleSave(editor.getValue()),
    });
  };

  const handleSave = useCallback(async (text?: string) => {
    const contentToSave = text ?? content;
    if (!path) return;
    setSaving(true);
    setMsg('');
    try {
      await api.post('/files/write', { path, content: contentToSave });
      setOriginalContent(contentToSave);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setMsg('Save failed: ' + (e instanceof Error ? e.message : ''));
    } finally {
      setSaving(false);
    }
  }, [path, content]);

  const getLang = (p: string): string => {
    const name = p.split('/').pop() || '';
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (name.toLowerCase() === 'dockerfile') return 'dockerfile';
    return LANG_MAP[ext] || 'plaintext';
  };

  const isModified = content !== originalContent;

  return (
    <div style={containerStyle}>
      <div style={toolbarStyle}>
        <div style={leftStyle}>
          {path && <span style={pathStyle}>{path}</span>}
          {isModified && <span style={unsavedStyle}>● Unsaved</span>}
        </div>
        <div style={rightStyle}>
          {msg && <span style={errorStyle}>{msg}</span>}
          {saved && <span style={savedIndicatorStyle}><Check size={14} /> Saved</span>}
          {saving && <span style={savingStyle}><Save size={14} /> Saving...</span>}
          <button style={btnStyle} onClick={() => handleSave()} disabled={saving || !isModified}>
            <Save size={15} /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#888', fontSize: 13 }}>
            Loading...
          </div>
        ) : path ? (
          <Editor
            defaultLanguage={getLang(path)}
            theme="cloudbanana-dark"
            value={content}
            onChange={(val) => setContent(val || '')}
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
              renderWhitespace: 'selection',
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              padding: { top: 8 },
            }}
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#888', fontSize: 13 }}>
            No file specified
          </div>
        )}
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', height: '100%', background: '#1a1a2e',
};

const toolbarStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '6px 12px', background: '#16162a', borderBottom: '1px solid #2a2a4e',
  gap: 12, minHeight: 40, flexShrink: 0,
};

const leftStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0,
};

const rightStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
};

const pathStyle: React.CSSProperties = {
  color: '#8a8aaa', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden',
  textOverflow: 'ellipsis', maxWidth: 400,
};

const unsavedStyle: React.CSSProperties = {
  color: '#ff9500', fontSize: 11, whiteSpace: 'nowrap',
};

const btnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px', border: 'none',
  borderRadius: 6, background: '#3a3a6e', color: '#d4d4d4', cursor: 'pointer',
  fontSize: 12, fontWeight: 500,
};

const savedIndicatorStyle: React.CSSProperties = {
  color: '#30d158', fontSize: 12, display: 'flex', alignItems: 'center', gap: 3,
};

const savingStyle: React.CSSProperties = {
  color: '#8a8aaa', fontSize: 12, display: 'flex', alignItems: 'center', gap: 3,
};

const errorStyle: React.CSSProperties = {
  color: '#ff453a', fontSize: 12, maxWidth: 300, overflow: 'hidden',
  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};

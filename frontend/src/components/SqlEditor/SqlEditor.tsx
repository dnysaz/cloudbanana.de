import { useState, useEffect, useCallback, useRef } from 'react';
import { api, ApiError } from '../../api';
import { useDesktopStore } from '../../store/desktopStore';
import {
  Play, Table2, Database, Terminal, AlertCircle, CheckCircle, Clock,
  X, FileText, Copy, Download, RefreshCw, Info, FolderOpen, Upload, Edit3, Save,
} from 'lucide-react';

interface QueryResult {
  columns: string[];
  rows: (string | null)[][];
  affected: number;
  elapsed: number;
  truncated: boolean;
}

interface TableSchema {
  name: string;
  type: string;
  notnull: boolean;
  default: string | null;
  pk: boolean;
}

interface TableInfo {
  columns: TableSchema[];
  row_count: number;
  create_stmt?: string;
}

interface SqlEditorProps {
  winId?: string;
  winData?: Record<string, unknown>;
}

export default function SqlEditor({ winId }: SqlEditorProps) {
  const { closeWindow, openWindow } = useDesktopStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState('');
  const [executing, setExecuting] = useState(false);
  const [tables, setTables] = useState<string[]>([]);
  const [schemas, setSchemas] = useState<Record<string, TableInfo>>({});
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [loadingTables, setLoadingTables] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [currentDbPath, setCurrentDbPath] = useState('');
  const [editCell, setEditCell] = useState<{
    table: string;
    column: string;
    value: string;
    rowIdx: number;
    colIdx: number;
    rowValues: (string | null)[];
  } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [sidebarWidth, setSidebarWidth] = useState(200);
  const [dragging, setDragging] = useState(false);

  // Retry helper: retries a function up to 3 times for network errors
  const retryOnNetError = async <T,>(fn: () => Promise<T>, maxRetries = 3): Promise<T> => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (e) {
        const isNetworkErr = e instanceof ApiError && (e.status === 0 || e.status === 408 || e.status === 502 || e.status === 503);
        if (attempt < maxRetries - 1 && isNetworkErr) {
          await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
          continue;
        }
        throw e;
      }
    }
    // Should never reach here
    throw new Error('Retry failed');
  };

  // Load tables from a given path (or default app DB if empty)
  const loadTables = useCallback(async (dbPath?: string) => {
    setLoadingTables(true);
    setError('');
    try {
      const queryPath = dbPath ? '?path=' + encodeURIComponent(dbPath) : '';
      const data = await retryOnNetError(() =>
        api.get<{ tables: string[]; schemas: Record<string, TableInfo> }>('/sql/tables' + queryPath)
      );
      setTables(data.tables);
      setSchemas(data.schemas);
      setCurrentDbPath(dbPath || '');
    } catch (e) {
      if (e instanceof ApiError && (e.status === 0 || e.status === 408)) {
        setError('Cannot reach the database server. The backend may be temporarily down. Please try again.');
      } else {
        setError(e instanceof ApiError ? e.message : (e instanceof Error ? e.message : 'Failed to load database'));
      }
    }
    setLoadingTables(false);
  }, []);

  // Listen for file pick events from File Manager
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.path) {
        loadTables(detail.path);
      }
    };
    document.addEventListener('fm-file-picked', handler);
    return () => document.removeEventListener('fm-file-picked', handler);
  }, [loadTables]);

  // Execute query
  const executeQuery = useCallback(async (sql?: string) => {
    const q = (sql || query).trim();
    if (!q) return;
    setError('');
    setResult(null);
    setExecuting(true);

    // Add to history
    setHistory(prev => {
      const next = [q, ...prev.filter(h => h !== q)].slice(0, 50);
      return next;
    });
    setHistoryIdx(-1);

    try {
      const body: Record<string, string> = { query: q };
      if (currentDbPath) body.path = currentDbPath;
      const data = await retryOnNetError(() =>
        api.post<QueryResult>('/sql/execute', body)
      );
      setResult(data);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 0 || e.status === 408)) {
        setError('Cannot reach the database server. The backend may be temporarily down. Please try again.');
      } else {
        setError(e instanceof ApiError ? e.message : (e instanceof Error ? e.message : 'Query failed'));
      }
    }
    setExecuting(false);
  }, [query, currentDbPath]);

  // Table click: SELECT * FROM table
  const viewTable = (table: string) => {
    const sql = `SELECT * FROM "${table}" LIMIT 100`;
    setQuery(sql);
    setSelectedTable(table);
    executeQuery(sql);
  };

  // Get schema for selected table
  const viewSchema = (table: string) => {
    setSelectedTable(table);
    setQuery(`SELECT sql FROM sqlite_master WHERE type='table' AND name='${table}'`);
    executeQuery(`SELECT sql FROM sqlite_master WHERE type='table' AND name='${table}'`);
  };

  // Keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      executeQuery();
    }
    // History navigation
    if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const nextIdx = historyIdx < history.length - 1 ? historyIdx + 1 : historyIdx;
        setHistoryIdx(nextIdx);
        setQuery(history[nextIdx]);
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx > 0) {
        const nextIdx = historyIdx - 1;
        setHistoryIdx(nextIdx);
        setQuery(history[nextIdx]);
      } else if (historyIdx === 0) {
        setHistoryIdx(-1);
        setQuery('');
      }
    }
  };

  // Copy result to clipboard
  const copyResult = () => {
    if (!result) return;
    const header = result.columns.join('\t');
    const rows = result.rows.map(r => r.map(v => v ?? 'NULL').join('\t')).join('\n');
    navigator.clipboard.writeText(header + '\n' + rows).catch(() => {});
  };

  // Download result as CSV
  const downloadCsv = () => {
    if (!result) return;
    const header = result.columns.join(',');
    const rows = result.rows.map(r =>
      r.map(v => {
        if (v === null) return 'NULL';
        if (v.includes(',') || v.includes('"') || v.includes('\n')) {
          return `"${v.replace(/"/g, '""')}"`;
        }
        return v;
      }).join(',')
    ).join('\n');
    const blob = new Blob([header + '\n' + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query_result_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Edit cell: open modal
  const handleCellClick = (colIdx: number, rowIdx: number) => {
    if (!result || !selectedTable) {
      setError('Select a table first before editing cells');
      return;
    }
    const colName = result.columns[colIdx];
    const val = result.rows[rowIdx][colIdx];
    const rowValues = result.rows[rowIdx];
    setEditCell({
      table: selectedTable,
      column: colName,
      value: val ?? '',
      rowIdx,
      colIdx,
      rowValues,
    });
    setEditValue(val ?? '');
  };

  // Save edited cell
  const saveEdit = async () => {
    if (!editCell) return;
    setError('');
    setSaving(true);

    // Build WHERE clause using all row values
    const conditions: string[] = [];
    for (let i = 0; i < result!.columns.length; i++) {
      const col = result!.columns[i];
      const val = editCell.rowValues[i];
      if (val === null) {
        conditions.push(`"${col}" IS NULL`);
      } else {
        // Escape single quotes by doubling them
        const escaped = val.replace(/'/g, "''");
        conditions.push(`"${col}" = '${escaped}'`);
      }
    }

    const whereClause = conditions.join(' AND ');
    const escapedValue = editValue.replace(/'/g, "''");
    const updateSql = `UPDATE "${editCell.table}" SET "${editCell.column}" = '${escapedValue}' WHERE ${whereClause}`;

    try {
      const body: Record<string, string> = { query: updateSql };
      if (currentDbPath) body.path = currentDbPath;
      await api.post('/sql/execute', body);
      setEditCell(null);
      // Refresh the result set
      const reQuery = query;
      const data = await api.post<QueryResult>('/sql/execute', { query: reQuery, ...(currentDbPath ? { path: currentDbPath } : {}) });
      setResult(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e instanceof Error ? e.message : 'Failed to save'));
    }
    setSaving(false);
  };

  // Open .db file via File Manager (server-side file picker)
  const openLocalFile = () => {
    const id = 'fm-pickdb-' + Date.now();
    openWindow(id, 'Select Database File', { path: '/root', pickMode: true });
  };

  // Upload .db file from client machine
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.db') && !file.name.endsWith('.sqlite') && !file.name.endsWith('.sqlite3')) {
      setError('Please select a SQLite database file (.db, .sqlite, .sqlite3)');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setLoadingTables(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', '/tmp');
      const uploadResult = await retryOnNetError(() =>
        api.post<{ status: string; path: string }>('/files/upload', formData, true)
      );
      if (uploadResult.status === 'ok') {
        await loadTables(uploadResult.path);
      }
    } catch (e) {
      if (e instanceof ApiError && (e.status === 0 || e.status === 408)) {
        setError('Cannot reach server for upload. The backend may be temporarily down. Please try again.');
      } else {
        setError(e instanceof ApiError ? e.message : (e instanceof Error ? e.message : 'Upload failed'));
      }
    }
    setLoadingTables(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Sidebar drag handler
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (sidebarRef.current) {
        const rect = sidebarRef.current.parentElement?.getBoundingClientRect();
        if (rect) {
          const newWidth = Math.max(120, Math.min(500, e.clientX - rect.left));
          setSidebarWidth(newWidth);
        }
      }
    };
    const handleMouseUp = () => setDragging(false);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [dragging]);

  return (
    <div className={`sqle${dragging ? ' sqle-dragging' : ''}`}>
      {/* Toolbar */}
      <div className="sqle-toolbar">
        <div className="sqle-toolbar-left">
          <span className="sqle-toolbar-title">
            <Database size={15} style={{ color: '#3b82f6' }} /> SQLite Editor
          </span>
          <div className="sqle-toolbar-menu" onMouseLeave={() => setOpenMenu(null)}>
            <button className={`gc-menu-btn${openMenu === 'File' ? ' open' : ''}`}
              onClick={() => setOpenMenu(openMenu === 'File' ? null : 'File')}
              onMouseEnter={() => openMenu && setOpenMenu('File')}>
              File
            </button>
            {openMenu === 'File' && (
              <div className="gc-menu-drop">
                <button className="gc-menu-item" onClick={() => { openLocalFile(); setOpenMenu(null); }}>
                  <FolderOpen size={14} /> Open Local File...
                </button>
                <button className="gc-menu-item" onClick={() => { fileInputRef.current?.click(); setOpenMenu(null); }}>
                  <Upload size={14} /> Upload Database...
                </button>
                <div className="gc-menu-sep" />
                <button className="gc-menu-item" onClick={() => { loadTables(); setOpenMenu(null); }}>
                  <RefreshCw size={14} /> Refresh Tables
                </button>
                <div className="gc-menu-sep" />
                <button className="gc-menu-item" onClick={() => { if (winId) closeWindow(winId); setOpenMenu(null); }}>
                  <X size={14} /> Close
                </button>
              </div>
            )}
          </div>
          <div className="sqle-toolbar-menu" onMouseLeave={() => setOpenMenu(null)}>
            <button className={`gc-menu-btn${openMenu === 'About' ? ' open' : ''}`}
              onClick={() => setOpenMenu(openMenu === 'About' ? null : 'About')}
              onMouseEnter={() => openMenu === 'File' && setOpenMenu('About')}>
              About
            </button>
            {openMenu === 'About' && (
              <div className="gc-menu-drop" style={{ left: 'auto', right: 0 }}>
                <button className="gc-menu-item" onClick={() => { setOpenMenu(null); setAboutOpen(true); }}>
                  <Info size={14} /> About SQLite Editor
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="sqle-body">
        {/* Sidebar: Tables */}
        <div ref={sidebarRef} className="sqle-sidebar" style={{ width: sidebarWidth }}>
          <div className="sqle-sidebar-header">
            <Database size={12} className={currentDbPath ? '' : 'sqle-ico-inactive'} />
            <span>{currentDbPath ? 'DB: ' + currentDbPath.split('/').pop() : 'No Database'}</span>
            {currentDbPath && (
              <button className="sqle-sidebar-refresh" onClick={() => loadTables(currentDbPath)} title="Refresh">
                <RefreshCw size={11} />
              </button>
            )}
          </div>
          <div className="sqle-sidebar-list">
            {loadingTables ? (
              <div className="sqle-sidebar-status">Loading...</div>
            ) : !currentDbPath ? (
              <div className="sqle-sidebar-status sqle-sidebar-empty">
                <Database size={24} />
                <span>No database loaded</span>
                <span className="sqle-sidebar-hint">File → Open Local File or Upload Database</span>
              </div>
            ) : tables.length === 0 ? (
              <div className="sqle-sidebar-status sqle-sidebar-empty">
                <Table2 size={24} />
                <span>No tables found</span>
              </div>
            ) : (
              tables.map(tbl => (
                <div key={tbl} className={`sqle-sidebar-item${selectedTable === tbl ? ' active' : ''}`}>
                  <button className="sqle-sidebar-item-name" onClick={() => viewTable(tbl)}
                    title={`SELECT * FROM "${tbl}" LIMIT 100`}>
                    <Table2 size={12} className="sqle-sidebar-item-icon" />
                    <span>{tbl}</span>
                  </button>
                  <button className="sqle-sidebar-item-info" onClick={() => viewSchema(tbl)}
                    title="View schema">
                    <FileText size={10} />
                  </button>
                </div>
              ))
            )}
          </div>
          {selectedTable && schemas[selectedTable] && (
            <div className="sqle-sidebar-schema">
              <div className="sqle-sidebar-schema-title">
                <FileText size={11} /> Schema
              </div>
              <div className="sqle-sidebar-schema-rows">
                <span className="sqle-schema-count">{schemas[selectedTable].row_count.toLocaleString()} rows</span>
              </div>
              {schemas[selectedTable].columns.map(col => (
                <div key={col.name} className="sqle-sidebar-schema-col">
                  <span className="sqle-schema-col-name">{col.name}</span>
                  <span className="sqle-schema-col-type">{col.type}</span>
                  {col.pk && <span className="sqle-schema-col-pk">PK</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Drag handle */}
        <div className="sqle-drag-handle" onMouseDown={handleMouseDown} />

        {/* Main area */}
        <div className="sqle-main">
          {/* Query input */}
          <div className="sqle-editor">
            <div className="sqle-editor-header">
              <Terminal size={13} />
              <span>SQL Query</span>
              <span className="sqle-shortcut-hint">Ctrl+Enter to execute</span>
            </div>
            <textarea
              className="sqle-textarea"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter SQL query...&#10;Example: SELECT * FROM user&#10;Ctrl+Enter to execute"
              spellCheck={false}
            />
            <div className="sqle-editor-actions">
              <button className="sqle-btn sqle-btn-execute" onClick={() => executeQuery()}
                disabled={executing || !query.trim()}>
                {executing ? <Clock size={14} className="sqle-spin" /> : <Play size={14} />}
                {executing ? 'Executing...' : 'Execute'}
              </button>
              <button className="sqle-btn sqle-btn-outline" onClick={() => { setQuery(''); setResult(null); setError(''); }}
                disabled={executing}>
                <X size={14} /> Clear
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="sqle-error">
              <AlertCircle size={14} />
              <span className="sqle-error-text">{error}</span>
              <button className="sqle-btn-icon sqle-error-copy" onClick={() => { navigator.clipboard.writeText(error).catch(() => {}); }}
                title="Copy error">
                <Copy size={11} />
              </button>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="sqle-results">
              <div className="sqle-results-header">
                <div className="sqle-results-info">
                  {result.columns.length > 0 ? (
                    <>
                      <CheckCircle size={14} className="sqle-ico-success" />
                      <span>{result.affected} rows returned</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle size={14} className="sqle-ico-success" />
                      <span>Query OK, {result.affected} rows affected</span>
                    </>
                  )}
                  <span className="sqle-elapsed">{result.elapsed}s</span>
                  {result.truncated && <span className="sqle-truncated">(truncated at 500 rows)</span>}
                </div>
                <div className="sqle-results-actions">
                  <button className="sqle-btn-icon" onClick={copyResult} title="Copy as TSV">
                    <Copy size={13} />
                  </button>
                  <button className="sqle-btn-icon" onClick={downloadCsv} title="Download CSV">
                    <Download size={13} />
                  </button>
                </div>
              </div>

              {/* Data table */}
              {result.columns.length > 0 && (
                <div className="sqle-data-table-wrap">
                  <table className="sqle-data-table">
                    <thead>
                      <tr>
                        <th className="sqle-row-num">#</th>
                        {result.columns.map(col => (
                          <th key={col}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((row, i) => (
                        <tr key={i}>
                          <td className="sqle-row-num">{i + 1}</td>
                          {row.map((val, j) => (
                            <td key={j}
                              className={val === null ? 'sqle-null sqle-cell-editable' : 'sqle-cell-editable'}
                              onClick={() => handleCellClick(j, i)}
                              title={`Edit "${result!.columns[j]}"`}>
                              {val ?? 'NULL'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit cell modal */}
      {editCell && (
        <div className="modal-overlay" onClick={() => !saving && setEditCell(null)}>
          <div className="modal-box" style={{ width: 400 }}>
            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Edit3 size={15} style={{ color: '#3b82f6' }} /> Edit Cell
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: '0.5rem 0 0.75rem', lineHeight: 1.5 }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                <span><strong>Table:</strong> {editCell.table}</span>
                <span><strong>Column:</strong> <code style={{ background: 'var(--bg-surface)', padding: '0.05rem 0.3rem', borderRadius: 3 }}>{editCell.column}</code></span>
                <span><strong>Row:</strong> #{editCell.rowIdx + 1}</span>
              </div>
              <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                Value
              </label>
              <textarea
                className="modal-input"
                style={{ minHeight: 60, resize: 'vertical', fontFamily: 'monospace', fontSize: '0.72rem', marginBottom: 0 }}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                autoFocus
                spellCheck={false}
              />
            </div>
            <div className="modal-actions">
              <button className="modal-btn modal-btn-cancel" onClick={() => setEditCell(null)} disabled={saving}>Cancel</button>
              <button className="modal-btn modal-btn-primary" onClick={saveEdit} disabled={saving}>
                {saving ? <><Clock size={13} className="sqle-spin" /> Saving...</> : <><Save size={13} /> Save</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input for upload */}
      <input ref={fileInputRef} type="file" accept=".db,.sqlite,.sqlite3,.db-wal,.db-shm"
        style={{ display: 'none' }} onChange={handleFileUpload} />

      {/* About modal */}
      {aboutOpen && (
        <div className="modal-overlay" onClick={() => setAboutOpen(false)}>
          <div className="modal-box" style={{ width: 340 }}>
            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Database size={16} style={{ color: '#3b82f6' }} /> SQLite Editor
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.5rem 0', lineHeight: 1.5 }}>
              A simple SQLite database browser and query tool for CloudBanana DE.<br /><br />
              <strong>Features:</strong>
              <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0 }}>
                <li>Execute SQL queries against SQLite databases</li>
                <li>Browse tables and view schema</li>
                <li>Open custom .db files</li>
                <li>Export results as CSV</li>
                <li>Query history (Ctrl+Up/Down)</li>
              </ul>
              <br />
              <strong>Shortcuts:</strong>
              <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0 }}>
                <li>Ctrl+Enter — Execute query</li>
                <li>Ctrl+↑ — Previous query in history</li>
                <li>Ctrl+↓ — Next query in history</li>
              </ul>
            </div>
            <div className="modal-actions">
              <button className="modal-btn modal-btn-primary" onClick={() => setAboutOpen(false)}>Got it</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

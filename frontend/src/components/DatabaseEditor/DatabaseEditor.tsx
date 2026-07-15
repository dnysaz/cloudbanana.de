import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api';
import { RefreshCw, Database, Table, Play } from 'lucide-react';

interface Props {
  winId?: string;
  winData?: Record<string, unknown>;
}

interface DbServer {
  type: string;
  binary: string;
  available: boolean;
  databases: string[];
}

interface QueryResult {
  columns: string[];
  rows: string[][];
}

export default function DatabaseEditor(_props: Props) {
  const [servers, setServers] = useState<DbServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedServer, setSelectedServer] = useState('');
  const [selectedDb, setSelectedDb] = useState('');
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [queryError, setQueryError] = useState('');
  const [queryLoading, setQueryLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get<{ servers: DbServer[] }>('/databases/servers');
      setServers(r.servers);
      const avail = r.servers.find(s => s.available);
      if (avail) {
        setSelectedServer(avail.type);
        if (avail.databases.length > 0) {
          setSelectedDb(avail.databases[0]);
        }
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const currentServer = servers.find(s => s.type === selectedServer);

  const runQuery = async () => {
    if (!query.trim() || !selectedServer || !selectedDb) return;
    setQueryLoading(true);
    setQueryError('');
    setResult(null);
    try {
      const r = await api.post<QueryResult>('/databases/query', {
        type: selectedServer,
        database: selectedDb,
        query: query.trim(),
      });
      setResult(r);
    } catch (e) {
      setQueryError(e instanceof Error ? e.message : 'Query failed');
    }
    setQueryLoading(false);
  };

  return (
    <div className="db-root">
      <div className="db-header">
        <span className="db-title">Database Editor</span>
        <button className="he-btn he-btn-refresh" onClick={load} title="Refresh">
          <RefreshCw size={13} />
        </button>
      </div>

      {loading ? (
        <div className="he-loading">Loading...</div>
      ) : servers.every(s => !s.available) ? (
        <div className="cm-empty">
          <Database size={24} />
          <p>No database servers available.</p>
          <p className="cm-empty-hint">Install MySQL (mysql-server) or PostgreSQL (postgresql).</p>
        </div>
      ) : (
        <div className="db-layout">
          <div className="db-sidebar">
            <div className="db-select-group">
              <label className="db-label">Server</label>
              <select className="db-select" value={selectedServer} onChange={e => { setSelectedServer(e.target.value); setSelectedDb(''); setResult(null); }}>
                {servers.filter(s => s.available).map(s => (
                  <option key={s.type} value={s.type}>{s.type.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div className="db-select-group">
              <label className="db-label">Database</label>
              <select className="db-select" value={selectedDb} onChange={e => { setSelectedDb(e.target.value); setResult(null); }}>
                {currentServer?.databases.map(db => (
                  <option key={db} value={db}>{db}</option>
                ))}
              </select>
            </div>
            <div className="db-quick">
              <div className="db-label">Quick Queries</div>
              <button className="db-q-btn" onClick={() => setQuery('SHOW TABLES;')}>SHOW TABLES</button>
              <button className="db-q-btn" onClick={() => setQuery('SELECT * FROM information_schema.tables WHERE table_schema = DATABASE();')}>List Tables</button>
            </div>
          </div>
          <div className="db-main">
            <div className="db-editor-area">
              <textarea
                className="db-editor"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={`Enter SQL query for ${selectedServer.toUpperCase()}...`}
                spellCheck={false}
              />
              <button className="db-run-btn" onClick={runQuery} disabled={queryLoading || !query.trim() || !selectedDb}>
                <Play size={14} /> Run
              </button>
            </div>
            {queryLoading && <div className="he-loading">Running query...</div>}
            {queryError && <div className="he-status error">{queryError}</div>}
            {result && (
              <div className="db-result">
                <div className="db-result-info">
                  <Table size={13} /> {result.columns.length} columns, {result.rows.length} rows
                </div>
                <div className="db-table-wrap">
                  <table className="db-table">
                    <thead>
                      <tr>{result.columns.map((c, i) => <th key={i}>{c}</th>)}</tr>
                    </thead>
                    <tbody>
                      {result.rows.map((row, i) => (
                        <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
                      ))}
                      {result.rows.length === 0 && (
                        <tr><td colSpan={result.columns.length} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>No results</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api';
import { RefreshCw, Play, Square, RotateCcw, Trash2, AlertTriangle } from 'lucide-react';

interface Props {
  winId?: string;
  winData?: Record<string, unknown>;
}

interface Pm2Process {
  name: string;
  pid: number | null;
  status: string;
  cpu: number;
  memory: number;
  uptime: number;
  restarts: number;
  exec_mode: string;
  instances: number;
}

export default function PM2Manager(_props: Props) {
  const [processes, setProcesses] = useState<Pm2Process[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: 'ok' | 'error' | ''; msg: string }>({ type: '', msg: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await api.get<{ processes: Pm2Process[]; error?: string }>('/pm2/processes');
      setProcesses(r.processes);
      if (r.error) setError(r.error);
    } catch {
      setError('PM2 not available');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const doAction = async (name: string, action: string) => {
    setActionLoading(`${name}:${action}`);
    try {
      await api.post('/pm2/action', { name, action });
      setStatus({ type: 'ok', msg: `${action}ed ${name}` });
      setTimeout(() => setStatus({ type: '', msg: '' }), 2000);
      load();
    } catch (e) {
      setStatus({ type: 'error', msg: e instanceof Error ? e.message : `Failed to ${action}` });
    }
    setActionLoading(null);
  };

  const formatUptime = (ts: number) => {
    if (!ts) return '-';
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
    return `${Math.floor(sec / 86400)}d`;
  };

  const formatMem = (bytes: number) => {
    if (!bytes) return '-';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${(bytes / 1024).toFixed(0)}K`;
    return `${mb.toFixed(1)}M`;
  };

  return (
    <div className="pm2-root">
      <div className="pm2-header">
        <span className="pm2-title">PM2 Process Manager</span>
        <button className="he-btn he-btn-refresh" onClick={load} title="Refresh">
          <RefreshCw size={13} />
        </button>
      </div>

      {status.msg && (
        <div className={`he-status ${status.type}`}>{status.msg}</div>
      )}

      {loading ? (
        <div className="he-loading">Loading...</div>
      ) : error && processes.length === 0 ? (
        <div className="cm-empty">
          <AlertTriangle size={24} />
          <p>PM2 is not available or not running.</p>
          <p className="cm-empty-hint">Install PM2: npm install -g pm2</p>
        </div>
      ) : processes.length === 0 ? (
        <div className="cm-empty">
          <p>No PM2 processes running.</p>
        </div>
      ) : (
        <div className="pm2-table-wrap">
          <table className="pm2-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Name</th>
                <th>PID</th>
                <th>CPU</th>
                <th>Memory</th>
                <th>Uptime</th>
                <th>Restarts</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {processes.map(p => (
                <tr key={p.name}>
                  <td>
                    <span className={`pm2-status pm2-status-${p.status}`}>{p.status}</span>
                  </td>
                  <td className="pm2-name">{p.name}</td>
                  <td>{p.pid ?? '-'}</td>
                  <td>{p.cpu}%</td>
                  <td>{formatMem(p.memory)}</td>
                  <td>{formatUptime(p.uptime)}</td>
                  <td>{p.restarts}</td>
                  <td>
                    <div className="pm2-actions">
                      {p.status !== 'online' && (
                        <button className="pm2-act-btn pm2-act-start" onClick={() => doAction(p.name, 'start')} disabled={actionLoading === `${p.name}:start`} title="Start">
                          <Play size={12} />
                        </button>
                      )}
                      {p.status === 'online' && (
                        <button className="pm2-act-btn pm2-act-stop" onClick={() => doAction(p.name, 'stop')} disabled={actionLoading === `${p.name}:stop`} title="Stop">
                          <Square size={12} />
                        </button>
                      )}
                      <button className="pm2-act-btn pm2-act-restart" onClick={() => doAction(p.name, 'restart')} disabled={actionLoading === `${p.name}:restart`} title="Restart">
                        <RotateCcw size={12} />
                      </button>
                      <button className="pm2-act-btn pm2-act-delete" onClick={() => doAction(p.name, 'delete')} disabled={actionLoading === `${p.name}:delete`} title="Delete">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

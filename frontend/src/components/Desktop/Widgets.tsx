import { useState, useEffect, useRef } from 'react';
import { api } from '../../api';
import type { SystemStats } from '../../types';
import {
  Activity, Pause, Wifi, ScrollText, Cpu, HardDrive,
  Zap, Gauge, ChevronUp, ChevronDown,
} from 'lucide-react';

/* ── Helpers ── */

function fmtBytesRate(bps: number): string {
  if (bps >= 1_000_000_000) return (bps / 1_000_000_000).toFixed(2) + ' Gbps';
  if (bps >= 1_000_000) return (bps / 1_000_000).toFixed(2) + ' Mbps';
  if (bps >= 1_000) return (bps / 1_000).toFixed(1) + ' Kbps';
  return bps.toFixed(0) + ' bps';
}

function fmtBytes(n: number): string {
  if (n >= 1_073_741_824) return (n / 1_073_741_824).toFixed(1) + ' GB';
  if (n >= 1_048_576) return (n / 1_048_576).toFixed(1) + ' MB';
  if (n >= 1_024) return (n / 1_024).toFixed(0) + ' KB';
  return n + ' B';
}

function getTzOpts(): { timeZone: string; hour12: boolean } {
  const tz = localStorage.getItem('cb-timezone') || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const cf = localStorage.getItem('cb-clock-format') || '24h';
  return { timeZone: tz, hour12: cf === '12h' };
}

/* ── Sub-widgets ── */

function ClockWidget() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const opts = getTzOpts();
  const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: opts.hour12, timeZone: opts.timeZone });
  const dateStr = time.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: opts.timeZone });

  return (
    <div className="wgt-card wgt-clock">
      <div className="wgt-clock-time">{timeStr}</div>
      <div className="wgt-clock-date">{dateStr}</div>
    </div>
  );
}

function ConnectionWidget({ stats, prevStats }: { stats: SystemStats | null; prevStats: SystemStats | null }) {
  const [history, setHistory] = useState<{ up: number; down: number }[]>([]);

  useEffect(() => {
    if (!stats || !prevStats) return;
    const dt = 2; // poll interval in seconds
    const upRate = Math.max(0, (stats.net_bytes_sent - prevStats.net_bytes_sent) / dt);
    const downRate = Math.max(0, (stats.net_bytes_recv - prevStats.net_bytes_recv) / dt);
    setHistory(prev => [...prev.slice(-19), { up: upRate, down: downRate }]);
  }, [stats, prevStats]);

  const latest = history[history.length - 1] || { up: 0, down: 0 };
  const maxVal = Math.max(1, ...history.flatMap(h => [h.up, h.down]));

  return (
    <div className="wgt-card">
      <div className="wgt-header"><Wifi size={14} /> Connection</div>
      <div className="wgt-net-rows">
        <div className="wgt-net-row">
          <ChevronUp size={13} className="wgt-net-up" />
          <span className="wgt-net-label">Upload</span>
          <span className="wgt-net-value">{fmtBytesRate(latest.up)}</span>
        </div>
        <div className="wgt-net-row">
          <ChevronDown size={13} className="wgt-net-down" />
          <span className="wgt-net-label">Download</span>
          <span className="wgt-net-value">{fmtBytesRate(latest.down)}</span>
        </div>
      </div>
      {/* Mini sparkline */}
      <div className="wgt-sparkline">
        {history.map((h, i) => (
          <div key={i} className="wgt-spark-bar-group">
            <div
              className="wgt-spark-bar wgt-spark-up"
              style={{ height: `${(h.up / maxVal) * 100}%` }}
            />
            <div
              className="wgt-spark-bar wgt-spark-down"
              style={{ height: `${(h.down / maxVal) * 100}%` }}
            />
          </div>
        ))}
      </div>
      {stats && (
        <div className="wgt-net-total">
          <span>Total: ↑{fmtBytes(stats.net_bytes_sent)} ↓{fmtBytes(stats.net_bytes_recv)}</span>
        </div>
      )}
    </div>
  );
}

function fmtLogTime(iso: string | null): string {
  if (!iso) return '--';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return '--'; }
}

function actionColor(action: string): string {
  if (action.includes('success') || action === 'change_password') return 'var(--log-ok, #4ade80)';
  if (action.includes('fail') || action.includes('error') || action.includes('locked')) return 'var(--log-err, #f87171)';
  if (action.includes('logout')) return 'var(--log-warn, #fbbf24)';
  if (action.includes('login')) return 'var(--log-info, #60a5fa)';
  return 'var(--log-muted, #a0a8c0)';
}

function LogWidget() {
  const [logs, setLogs] = useState<any[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchLogs = async () => {
      try {
        const data = await api.get<any[]>('/audit/logs');
        if (!mounted) return;
        setLogs(data.slice(0, 40));
        setError(false);
      } catch {
        if (mounted) setError(true);
      }
    };
    fetchLogs();
    const interval = setInterval(fetchLogs, 4000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  return (
    <div className="wgt-card wgt-log-card">
      <div className="wgt-header"><ScrollText size={14} /> Live Log</div>
      <div className="wgt-log-container">
        {error ? (
          <div className="wgt-log-empty">Could not connect to log stream</div>
        ) : logs.length === 0 ? (
          <div className="wgt-log-empty">Waiting for events...</div>
        ) : (
          logs.map((log, i) => (
            <div key={log.id || i} className="wgt-log-line">
              <span className="wgt-log-time">{fmtLogTime(log.created_at)}</span>
              <span className="wgt-log-action" style={{ color: actionColor(log.action) }}>{log.action}</span>
              <span className="wgt-log-user">{log.username || '—'}</span>
              {log.detail && <span className="wgt-log-detail">{log.detail}</span>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ResRing({ percent, size = 56, strokeWidth = 5, color }: { percent: number; size?: number; strokeWidth?: number; color: string }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(percent, 100) / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
    </svg>
  );
}

function ResourceWidget({ stats }: { stats: SystemStats | null }) {
  if (!stats) {
    return (
      <div className="wgt-card wgt-res-card">
        <div className="wgt-header"><Activity size={14} /> Resources</div>
        <div className="wgt-loading">Loading...</div>
      </div>
    );
  }

  const rootDisk = stats.disks?.find(d => d.mount === '/');
  const cpuColor = stats.cpu > 80 ? '#ef4444' : stats.cpu > 60 ? '#f59e0b' : '#6366f1';
  const ramColor = stats.ram_percent > 80 ? '#ef4444' : stats.ram_percent > 60 ? '#f59e0b' : '#22c55e';
  const diskPct = rootDisk ? rootDisk.percent : 0;

  return (
    <div className="wgt-card wgt-res-card">
      <div className="wgt-header"><Activity size={14} /> Resources</div>

      {/* Ring charts row for CPU + RAM */}
      <div className="wgt-res-rings">
        <div className="wgt-res-ring-item">
          <div className="wgt-res-ring-svg">
            <ResRing percent={stats.cpu} color={cpuColor} size={52} strokeWidth={4} />
            <div className="wgt-res-ring-label">
              <Cpu size={13} />
              <span>{stats.cpu.toFixed(1)}%</span>
            </div>
          </div>
          <div className="wgt-res-ring-meta">
            <span className="wgt-res-ring-name">CPU</span>
            {stats.cpu_freq ? <span className="wgt-res-ring-sub">{stats.cpu_freq.toFixed(0)} MHz</span> : null}
            <span className="wgt-res-ring-sub">{stats.cpu_cores} cores</span>
          </div>
        </div>
        <div className="wgt-res-ring-item">
          <div className="wgt-res-ring-svg">
            <ResRing percent={stats.ram_percent} color={ramColor} size={52} strokeWidth={4} />
            <div className="wgt-res-ring-label">
              <Zap size={13} />
              <span>{stats.ram_percent.toFixed(1)}%</span>
            </div>
          </div>
          <div className="wgt-res-ring-meta">
            <span className="wgt-res-ring-name">RAM</span>
            <span className="wgt-res-ring-sub">{fmtBytes(stats.ram_used)} / {fmtBytes(stats.ram_total)}</span>
            <span className="wgt-res-ring-sub">Avail: {fmtBytes(stats.ram_available)}</span>
          </div>
        </div>
      </div>

      {/* Bar chart section for SWAP + DISK */}
      <div className="wgt-res-bars">
        <div className="wgt-res-bar-row">
          <div className="wgt-res-bar-header">
            <span className="wgt-res-bar-icon"><Gauge size={11} /></span>
            <span className="wgt-res-bar-label">SWAP</span>
            <span className="wgt-res-bar-pct">{stats.swap_percent.toFixed(1)}%</span>
          </div>
          <div className="wgt-res-bar-track">
            <div className="wgt-res-bar-fill" style={{ width: `${Math.min(stats.swap_percent, 100)}%`, background: '#f59e0b' }} />
          </div>
          {stats.swap_total > 0 && (
            <div className="wgt-res-bar-sub">{fmtBytes(stats.swap_used)} / {fmtBytes(stats.swap_total)}</div>
          )}
        </div>
        {rootDisk && (
          <div className="wgt-res-bar-row">
            <div className="wgt-res-bar-header">
              <span className="wgt-res-bar-icon"><HardDrive size={11} /></span>
              <span className="wgt-res-bar-label">DISK</span>
              <span className="wgt-res-bar-pct">{diskPct.toFixed(1)}%</span>
            </div>
            <div className="wgt-res-bar-track">
              <div className="wgt-res-bar-fill" style={{
                width: `${Math.min(diskPct, 100)}%`,
                background: diskPct > 85 ? '#ef4444' : diskPct > 60 ? '#f59e0b' : '#3b82f6'
              }} />
            </div>
            <div className="wgt-res-bar-sub">{fmtBytes(rootDisk.used)} / {fmtBytes(rootDisk.total)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main Widgets Container ── */

export default function Widgets() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [prevStats, setPrevStats] = useState<SystemStats | null>(null);
  const [opacity, setOpacity] = useState(() => parseFloat(localStorage.getItem('cb-widget-opacity') || '0.55'));
  const [polling, setPolling] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statsRef = useRef<SystemStats | null>(null);

  useEffect(() => {
    if (!polling) return;
    const fetchStats = async () => {
      try {
        const data = await api.get<SystemStats>('/system/stats');
        const prev = statsRef.current;
        statsRef.current = data;
        setPrevStats(prev);
        setStats(data);
      } catch {}
    };
    fetchStats();
    intervalRef.current = setInterval(fetchStats, 2000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [polling]);

  const handleOpacityChange = (val: number) => {
    setOpacity(val);
    localStorage.setItem('cb-widget-opacity', String(val));
  };

  const wgtStyle: React.CSSProperties = {
    opacity: opacity + 0.1, // 0.2 min so it's always slightly visible (0.1 + 0.1 = 0.2)
  };

  return (
    <div className="wgt-container" style={wgtStyle}>
      {/* Top row: transparency slider + polling toggle */}
      <div className="wgt-controls">
        <div className="wgt-opacity-row">
          <span className="wgt-opacity-label">Opacity</span>
          <input type="range" min="0" max="90" value={Math.round((opacity - 0.1) * 100)}
            onChange={e => handleOpacityChange(parseFloat(e.target.value) / 100 + 0.1)}
            className="wgt-opacity-slider" />
          <span className="wgt-opacity-val">{Math.round(opacity * 100)}%</span>
        </div>
        <button className={`wgt-poll-btn${polling ? '' : ' wgt-poll-paused'}`}
          onClick={() => setPolling(!polling)} title={polling ? 'Pause updates' : 'Resume updates'}>
          {polling ? <Activity size={12} /> : <Pause size={12} />}
        </button>
      </div>

      {/* Widget grid — left: Clock + Connection, right: Resources (2 rows), bottom: Log full-width */}
      <div className="wgt-grid">
        <ClockWidget />
        <div className="wgt-res-span">
          <ResourceWidget stats={stats} />
        </div>
        <ConnectionWidget stats={stats} prevStats={prevStats} />
        <LogWidget />
      </div>
    </div>
  );
}

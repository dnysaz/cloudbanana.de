import { useEffect, useRef, useState } from 'react';
import { api } from '../../api';
import { useDesktopStore } from '../../store/desktopStore';
import type { SystemStats } from '../../types';
import { Cpu, HardDrive, MemoryStick, Activity, Gauge, Network, Server, Clock, X, Search, Minus } from 'lucide-react';

const CHART_POINTS = 50;

function formatUptime(s: number) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return (d ? d + 'd ' : '') + (h ? h + 'h ' : '') + m + 'm';
}

function bytes(v: number) {
  if (v === 0) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(v) / Math.log(1024));
  return (v / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + u[i];
}

function drawChart(canvas: HTMLCanvasElement, history: number[], color: string, fillColor?: string) {
  const rect = canvas.parentElement!.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(100, rect.width) * dpr;
  const h = rect.height * dpr;
  canvas.width = w; canvas.height = h;
  canvas.style.width = (w / dpr) + 'px'; canvas.style.height = (h / dpr) + 'px';

  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  const pad = 4 * dpr, cw = w - pad * 2, ch = h - pad * 2;
  const pts = history.map((v, i) => ({
    x: (i / (CHART_POINTS - 1)) * cw + pad,
    y: ch + pad - (v / 100) * ch,
  }));
  if (pts.length < 2) return;
  const last = pts[pts.length - 1];

  // Fill area under curve
  ctx.beginPath();
  ctx.moveTo(pts[0].x, ch + pad);
  ctx.lineTo(pts[0].x, pts[0].y);
  for (let i = 0; i < pts.length - 2; i++) {
    const xc = (pts[i].x + pts[i + 1].x) / 2;
    const yc = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
  }
  ctx.lineTo(last.x, last.y); ctx.lineTo(last.x, ch + pad); ctx.closePath();
  const fc = fillColor || color;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, fc + '30');
  grad.addColorStop(0.5, fc + '10');
  grad.addColorStop(1, fc + '05');
  ctx.fillStyle = grad; ctx.fill();

  // Draw line
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < pts.length - 2; i++) {
    const xc = (pts[i].x + pts[i + 1].x) / 2;
    const yc = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
  }
  ctx.lineTo(last.x, last.y);
  ctx.strokeStyle = color; ctx.lineWidth = 1.5 * dpr;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
}

function Bar({ pct, color, label, value }: { pct: number; color: string; label?: string; value?: string }) {
  return (
    <div className="tm-bar2">
      {label && <span className="tm-bar2-label">{label}</span>}
      <div className="tm-bar2-track">
        <div className="tm-bar2-fill" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
      <span className="tm-bar2-pct">{value || pct.toFixed(1) + '%'}</span>
    </div>
  );
}

interface SysProcess {
  pid: number;
  name: string;
  cpu: number;
  mem: number;
  mem_mb: number;
  status: string;
  user: string;
  created: string;
}

export default function TaskManager() {
  const { windows, closeWindow, focusWindow, minimizeWindow } = useDesktopStore();
  const [activeTab, setActiveTab] = useState<'processes' | 'performance'>('processes');
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [processes, setProcesses] = useState<SysProcess[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const cpuCanvas = useRef<HTMLCanvasElement>(null);
  const memCanvas = useRef<HTMLCanvasElement>(null);
  const cpuHist = useRef<number[]>(new Array(CHART_POINTS).fill(0));
  const memHist = useRef<number[]>(new Array(CHART_POINTS).fill(0));

  // Fetch stats & processes
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsData, procsData] = await Promise.all([
          api.get<SystemStats>('/system/stats'),
          api.get<SysProcess[]>('/system/processes'),
        ]);
        setStats(statsData);
        setProcesses(procsData);

        cpuHist.current.push(statsData.cpu);
        cpuHist.current.shift();
        memHist.current.push(statsData.ram_percent);
        memHist.current.shift();

        const isDark = document.documentElement.classList.contains('theme-dark');
        const cpuColor = isDark ? '#60a5fa' : '#3b82f6';
        const memColor = isDark ? '#a78bfa' : '#8b5cf6';
        if (cpuCanvas.current) drawChart(cpuCanvas.current, cpuHist.current, cpuColor);
        if (memCanvas.current) drawChart(memCanvas.current, memHist.current, memColor);
      } catch {}
    };
    fetchData();
    const interval = setInterval(fetchData, 2500);
    const resize = () => {
      const isDark = document.documentElement.classList.contains('theme-dark');
      const cpuColor = isDark ? '#60a5fa' : '#3b82f6';
      const memColor = isDark ? '#a78bfa' : '#8b5cf6';
      if (cpuCanvas.current) drawChart(cpuCanvas.current, cpuHist.current, cpuColor);
      if (memCanvas.current) drawChart(memCanvas.current, memHist.current, memColor);
    };
    window.addEventListener('resize', resize);
    return () => { clearInterval(interval); window.removeEventListener('resize', resize); };
  }, []);

  const openWindows = Object.values(windows);
  const filteredProcesses = searchQuery
    ? processes.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : processes;

  const memUsedGb = stats ? bytes(stats.ram_used) : '';
  const memTotalGb = stats ? bytes(stats.ram_total) : '';
  const memAvailGb = stats ? bytes(stats.ram_available) : '';

  return (
    <div className="tm2">
      {/* ===== Tab Bar (Windows Task Manager style) ===== */}
      <div className="tm2-tabs">
        <button className={`tm2-tab ${activeTab === 'processes' ? 'active' : ''}`}
          onClick={() => setActiveTab('processes')}>
          <Activity size={13} /> Processes
        </button>
        <button className={`tm2-tab ${activeTab === 'performance' ? 'active' : ''}`}
          onClick={() => setActiveTab('performance')}>
          <Gauge size={13} /> Performance
        </button>
      </div>

      {/* ===== PROCESSES TAB ===== */}
      {activeTab === 'processes' && (
        <div className="tm2-body">
          {/* Search */}
          <div className="tm2-proc-toolbar">
            <div className="tm2-proc-search">
              <Search size={13} />
              <input type="text" placeholder="Filter processes..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <span className="tm2-proc-count">
              {openWindows.length} windows / {processes.length} processes
            </span>
          </div>

          {/* Open Windows section */}
          {openWindows.length > 0 && (
            <div className="tm2-section">
              <div className="tm2-section-title">
                <Server size={12} /> Open Windows
              </div>
              <div className="tm2-win-list">
                {openWindows.map((w) => (
                  <div key={w.id} className="tm2-win-row" onClick={() => focusWindow(w.id)}>
                    <div className="tm2-win-info">
                      <span className="tm2-win-title">{w.title}</span>
                      <span className="tm2-win-id">{w.id}</span>
                      {w.minimized && <span className="tm2-win-badge">Minimized</span>}
                    </div>
                    <div className="tm2-win-actions">
                      <button className="tm2-win-btn tm2-win-minimize" title="Minimize"
                        onClick={(e) => { e.stopPropagation(); minimizeWindow(w.id); }}>
                        <Minus size={12} />
                      </button>
                      <button className="tm2-win-btn tm2-win-endtask" title="End Task"
                        onClick={(e) => { e.stopPropagation(); closeWindow(w.id); }}>
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* System Processes */}
          <div className="tm2-section" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="tm2-section-title">
              <Cpu size={12} /> System Processes
            </div>
            <div className="tm2-proc-list">
              <div className="tm2-proc-header">
                <span className="tm2-proc-col-name">Process Name</span>
                <span className="tm2-proc-col-pid">PID</span>
                <span className="tm2-proc-col-cpu">CPU</span>
                <span className="tm2-proc-col-mem">Memory</span>
                <span className="tm2-proc-col-user">User</span>
                <span className="tm2-proc-col-status">Status</span>
              </div>
              <div className="tm2-proc-rows">
                {filteredProcesses.slice(0, 50).map((p) => (
                  <div key={p.pid} className="tm2-proc-row">
                    <span className="tm2-proc-col-name" title={p.name}>{p.name}</span>
                    <span className="tm2-proc-col-pid">{p.pid}</span>
                    <span className="tm2-proc-col-cpu">{p.cpu}%</span>
                    <span className="tm2-proc-col-mem">{p.mem_mb} MB</span>
                    <span className="tm2-proc-col-user">{p.user}</span>
                    <span className="tm2-proc-col-status">{p.status}</span>
                  </div>
                ))}
                {filteredProcesses.length === 0 && (
                  <div className="tm2-proc-empty">No processes found</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== PERFORMANCE TAB ===== */}
      {activeTab === 'performance' && stats && (
        <div className="tm2-body tm2-perf-body">
          {/* CPU */}
          <div className="tm2-perf-card">
            <div className="tm2-perf-header">
              <Cpu size={16} />
              <span>CPU</span>
              <span className="tm2-perf-value">{stats.cpu}%</span>
            </div>
            <div className="tm2-perf-chart"><canvas ref={cpuCanvas} /></div>
            <div className="tm2-perf-details">
              <div className="tm2-perf-detail">
                <span>Utilization</span>
                <span className="tm2-perf-detail-val">{stats.cpu}%</span>
              </div>
              <div className="tm2-perf-detail">
                <span>Speed</span>
                <span className="tm2-perf-detail-val">{stats.cpu_freq?.toFixed(0) || '?'} MHz</span>
              </div>
              <div className="tm2-perf-detail">
                <span>Cores</span>
                <span className="tm2-perf-detail-val">{stats.cpu_cores} logical ({stats.cpu_phys} physical)</span>
              </div>
              <div className="tm2-perf-detail">
                <span>Load (1/5/15m)</span>
                <span className="tm2-perf-detail-val">{stats.load_1} / {stats.load_5} / {stats.load_15}</span>
              </div>
            </div>
            <div className="tm2-perf-core-grid">
              {stats.cpu_per_core?.map((p, i) => (
                <div key={i} className="tm2-core-item">
                  <span className="tm2-core-label">CPU {i}</span>
                  <div className="tm2-core-track">
                    <div className="tm2-core-fill" style={{
                      width: `${Math.min(p, 100)}%`,
                      background: p > 80 ? 'var(--chart-danger)' : p > 50 ? 'var(--chart-warn)' : 'var(--chart-cpu)'
                    }} />
                  </div>
                  <span className="tm2-core-val">{p.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Memory */}
          <div className="tm2-perf-card">
            <div className="tm2-perf-header">
              <MemoryStick size={16} />
              <span>Memory</span>
              <span className="tm2-perf-value">{stats.ram_percent.toFixed(1)}%</span>
            </div>
            <div className="tm2-perf-chart"><canvas ref={memCanvas} /></div>
            <div className="tm2-perf-bar-section">
              <Bar pct={stats.ram_percent} color="var(--chart-mem)" />
            </div>
            <div className="tm2-perf-details">
              <div className="tm2-perf-detail">
                <span>In use</span>
                <span className="tm2-perf-detail-val">{memUsedGb} / {memTotalGb}</span>
              </div>
              <div className="tm2-perf-detail">
                <span>Available</span>
                <span className="tm2-perf-detail-val">{memAvailGb}</span>
              </div>
              <div className="tm2-perf-detail">
                <span>Cached</span>
                <span className="tm2-perf-detail-val">{bytes(stats.ram_cached)}</span>
              </div>
              <div className="tm2-perf-detail">
                <span>Free</span>
                <span className="tm2-perf-detail-val">{bytes(stats.ram_free)}</span>
              </div>
            </div>
            {stats.swap_total > 0 && (
              <>
                <div className="tm2-perf-spacer" />
                <div className="tm2-perf-header" style={{ fontSize: '0.7rem' }}>
                  <Activity size={13} />
                  <span>Swap</span>
                  <span className="tm2-perf-value" style={{ fontSize: '0.7rem' }}>{stats.swap_percent.toFixed(1)}%</span>
                </div>
                <div className="tm2-perf-bar-section">
                  <Bar pct={stats.swap_percent} color="var(--chart-swap)" />
                </div>
              </>
            )}
          </div>

          {/* Storage */}
          <div className="tm2-perf-card">
            <div className="tm2-perf-header">
              <HardDrive size={16} />
              <span>Storage</span>
            </div>
            {stats.disks?.map((d) => (
              <div key={d.mount} className="tm2-perf-disk-item">
                <div className="tm2-perf-disk-head">
                  <span className="tm2-perf-disk-mount">{d.mount}</span>
                  <span className="tm2-perf-disk-pct">{d.percent.toFixed(0)}%</span>
                </div>
                <div className="tm2-perf-bar-section">
                  <Bar pct={d.percent} color={d.percent > 85 ? 'var(--chart-danger)' : d.percent > 60 ? 'var(--chart-warn)' : 'var(--chart-disk)'}
                    value={`${bytes(d.used)} / ${bytes(d.total)}`} />
                </div>
              </div>
            ))}
          </div>

          {/* System Info */}
          <div className="tm2-perf-card">
            <div className="tm2-perf-header">
              <Server size={16} />
              <span>System</span>
            </div>
            <div className="tm2-perf-details">
              <div className="tm2-perf-detail">
                <span><Clock size={11} /> Uptime</span>
                <span className="tm2-perf-detail-val">{formatUptime(stats.uptime_seconds)}</span>
              </div>
              <div className="tm2-perf-detail">
                <span><Activity size={11} /> Processes</span>
                <span className="tm2-perf-detail-val">{stats.processes}</span>
              </div>
            </div>
            <div className="tm2-perf-spacer" />
            <div className="tm2-perf-header" style={{ fontSize: '0.7rem' }}>
              <Network size={13} />
              <span>Network</span>
            </div>
            <div className="tm2-perf-details">
              <div className="tm2-perf-detail">
                <span>Sent</span>
                <span className="tm2-perf-detail-val">{bytes(stats.net_bytes_sent)}</span>
              </div>
              <div className="tm2-perf-detail">
                <span>Received</span>
                <span className="tm2-perf-detail-val">{bytes(stats.net_bytes_recv)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'performance' && !stats && (
        <div className="tm-loading" style={{ height: '100%' }}>Loading system data...</div>
      )}
    </div>
  );
}

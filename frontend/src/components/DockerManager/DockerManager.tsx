import { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../../api';
import {
  Container, Box, Play, Square, RotateCcw, Trash2, RefreshCw, Download,
  Activity, FileText, Search, X, AlertTriangle, Server, HardDrive,
  Info,
} from 'lucide-react';

interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: string;
  state: string;
  ports: string;
  created: string;
  size: string;
}

interface DockerImage {
  id: string;
  repository: string;
  tag: string;
  size: string;
  created: string;
}

interface DockerInfo {
  installed: boolean;
  running: boolean;
  accessible?: boolean;
  version: string | null;
  containers?: number;
  containers_running?: number;
  images?: number;
  os?: string;
  cpu?: number;
  memory?: number;
  storage_driver?: string;
  error?: string;
}

type Tab = 'containers' | 'images' | 'logs' | 'stats';

function formatSize(s: string | undefined): string {
  if (!s) return '-';
  const m = s.match(/^([\d.]+)\s*([A-Z]+)/);
  if (m) return `${m[1]} ${m[2]}`;
  return s;
}

function formatPorts(s: string): string {
  if (!s || s === '<no port>') return '-';
  return s.replace(/0\.0\.0\.0:/g, '').replace(/:::/g, '');
}

function shortId(id: string): string {
  return id.substring(0, 12);
}

export default function DockerManager() {
  const [tab, setTab] = useState<Tab>('containers');
  const [info, setInfo] = useState<DockerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [images, setImages] = useState<DockerImage[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null);
  const [containerLogs, setContainerLogs] = useState('');
  const [containerStats, setContainerStats] = useState<any>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [imgSearchQuery, setImgSearchQuery] = useState('');
  const [pullImage, setPullImage] = useState('');
  const [pullStatus, setPullStatus] = useState<{ task_id: string; status: string; output: string } | null>(null);
  const [pullLoading, setPullLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [confirmRemoveImg, setConfirmRemoveImg] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const loadTimer = useRef<number | null>(null);

  const loadInfo = useCallback(async () => {
    try {
      const data = await api.get<DockerInfo>('/docker/check');
      setInfo(data);
      return data;
    } catch {
      setInfo({ installed: false, running: false, version: null });
      return null;
    }
  }, []);

  const loadContainers = useCallback(async () => {
    try {
      const data = await api.get<DockerContainer[]>('/docker/containers');
      setContainers(data);
    } catch (e) {
      setError('Failed to load containers: ' + (e instanceof Error ? e.message : ''));
    }
  }, []);

  const loadImages = useCallback(async () => {
    try {
      const data = await api.get<DockerImage[]>('/docker/images');
      setImages(data);
    } catch (e) {
      setError('Failed to load images: ' + (e instanceof Error ? e.message : ''));
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const d = await loadInfo();
      if (d?.installed && d?.running) {
        await Promise.all([loadContainers(), loadImages()]);
      }
      setLoading(false);
    };
    init();
  }, []);

  // Auto-refresh containers every 3s when on containers tab
  useEffect(() => {
    if (tab === 'containers' && info?.installed && info?.running) {
      loadTimer.current = window.setInterval(loadContainers, 3000);
    }
    return () => {
      if (loadTimer.current) {
        clearInterval(loadTimer.current);
        loadTimer.current = null;
      }
    };
  }, [tab, info?.installed, info?.running, loadContainers]);

  const handleRefresh = async () => {
    setError('');
    setLoading(true);
    const d = await loadInfo();
    if (d?.installed && d?.running) {
      await Promise.all([loadContainers(), loadImages()]);
    }
    setLoading(false);
  };

  const containerAction = async (id: string, action: 'start' | 'stop' | 'restart' | 'remove') => {
    setActionLoading(id);
    setError('');
    try {
      if (action === 'remove') {
        await api.del(`/docker/containers/${id}`);
      } else {
        await api.post(`/docker/containers/${id}/${action}`);
      }
      await loadContainers();
      setConfirmRemove(null);
    } catch (e) {
      setError(`${action} failed: ${e instanceof Error ? e.message : ''}`);
    }
    setActionLoading(null);
  };

  const viewLogs = async (id: string) => {
    setSelectedContainer(id);
    setTab('logs');
    setLogsLoading(true);
    try {
      const data = await api.get<{ logs: string }>(`/docker/containers/${id}/logs?tail=200`);
      setContainerLogs(data.logs);
    } catch (e) {
      setContainerLogs('Error loading logs: ' + (e instanceof Error ? e.message : ''));
    }
    setLogsLoading(false);
  };

  const viewStats = async (id: string) => {
    setSelectedContainer(id);
    setTab('stats');
    setStatsLoading(true);
    try {
      const data = await api.get<any>(`/docker/containers/${id}/stats`);
      setContainerStats(data);
    } catch (e) {
      setContainerStats({ error: 'Failed to load stats: ' + (e instanceof Error ? e.message : '') });
    }
    setStatsLoading(false);
  };

  const handlePullImage = async () => {
    if (!pullImage.trim()) return;
    setPullLoading(true);
    setError('');
    setPullStatus(null);
    try {
      const data = await api.post<{ task_id: string; status: string }>('/docker/images/pull', { image: pullImage.trim() });
      setPullStatus({ task_id: data.task_id, status: 'running', output: '' });

      // Poll for status
      const iv = setInterval(async () => {
        try {
          const st = await api.get<{ status: string; output: string }>(`/docker/images/pull/status/${data.task_id}`);
          setPullStatus({ ...st, task_id: data.task_id });
          if (st.status === 'done' || st.status === 'error') {
            clearInterval(iv);
            setPullLoading(false);
            if (st.status === 'done') {
              await loadImages();
            }
          }
        } catch {
          clearInterval(iv);
          setPullLoading(false);
        }
      }, 1500);
    } catch (e) {
      setError('Pull failed: ' + (e instanceof Error ? e.message : ''));
      setPullLoading(false);
    }
  };

  const removeImage = async (id: string) => {
    setActionLoading(id);
    setError('');
    try {
      await api.del(`/docker/images/${id}`);
      await loadImages();
      setConfirmRemoveImg(null);
    } catch (e) {
      setError('Remove failed: ' + (e instanceof Error ? e.message : ''));
    }
    setActionLoading(null);
  };

  const filteredContainers = searchQuery
    ? containers.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.image.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.id.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : containers;

  const filteredImages = imgSearchQuery
    ? images.filter(i =>
        i.repository.toLowerCase().includes(imgSearchQuery.toLowerCase()) ||
        i.id.toLowerCase().includes(imgSearchQuery.toLowerCase()) ||
        i.tag.toLowerCase().includes(imgSearchQuery.toLowerCase())
      )
    : images;

  const stateColor = (state: string) => {
    switch (state) {
      case 'running': return 'var(--success)';
      case 'exited': case 'dead': return 'var(--danger)';
      case 'paused': return 'var(--chart-warn)';
      default: return 'var(--text-muted)';
    }
  };

  // Help/About modal
  const helpContent = (
    <div className="dm-about">
      <div className="dm-about-header">
        <Container size={24} />
        <span>Docker Manager</span>
      </div>
      <div className="dm-about-version">v{info?.version || '—'}</div>
      <p className="dm-about-desc">
        Docker Manager is a visual interface for managing Docker containers, images, and resources
        on your server. No need to remember CLI commands — everything is one click away.
      </p>

      <div className="dm-about-section">
        <h4>Containers Tab</h4>
        <p>View all running and stopped containers. Each container shows its status (color-coded dot), name, image, port mappings, and size.</p>
        <ul>
          <li><strong>Start</strong> — Start a stopped container</li>
          <li><strong>Stop</strong> — Gracefully stop a running container</li>
          <li><strong>Restart</strong> — Restart a running container</li>
          <li><strong>Logs</strong> — View real-time container logs</li>
          <li><strong>Stats</strong> — View CPU, memory, and network stats</li>
          <li><strong>Remove</strong> — Delete a container (confirmation required)</li>
        </ul>
        <p>Use the search bar to filter containers by name, image, or ID. The list auto-refreshes every 3 seconds.</p>
      </div>

      <div className="dm-about-section">
        <h4>Images Tab</h4>
        <p>Browse all Docker images stored on this server. Each image shows its repository, tag, ID, and disk size.</p>
        <ul>
          <li><strong>Pull Image</strong> — Download a new image from Docker Hub (e.g. <code>nginx:latest</code>, <code>ubuntu:22.04</code>)</li>
          <li><strong>Remove</strong> — Delete an image from disk (confirmation required)</li>
        </ul>
        <p>Use the search bar to filter images by name, tag, or ID.</p>
      </div>

      <div className="dm-about-section">
        <h4>Logs Tab</h4>
        <p>View the last 200 lines of logs from any container. Useful for debugging application errors, checking startup sequences, or monitoring output.</p>
        <p><em>Select a container from the Containers tab first, then click the Logs button to open logs here.</em></p>
      </div>

      <div className="dm-about-section">
        <h4>Stats Tab</h4>
        <p>View real-time resource usage for any running container: CPU, memory, network I/O, block I/O, and process count.</p>
        <p><em>Select a container from the Containers tab first, then click the Stats button to open stats here.</em></p>
      </div>

      <div className="dm-about-section">
        <h4>Tips & Shortcuts</h4>
        <ul>
          <li>Containers list auto-refreshes every 3 seconds on the Containers tab</li>
          <li>Use <strong>Ctrl+F</strong> / search bar to quickly find containers or images</li>
          <li>Click <strong>Remove</strong> twice to confirm deletion (safety measure)</li>
          <li>Pull images by name from Docker Hub — no need to add <code>docker.io/library/</code></li>
          <li>Docker must be installed and the daemon running for all features to work</li>
        </ul>
      </div>

      <div className="dm-about-actions">
        <button className="dm-btn dm-btn-primary" onClick={() => setShowHelp(false)}>
          Got it
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="dm-loading">
        <div className="dm-spinner" />
        <span>Connecting to Docker daemon...</span>
      </div>
    );
  }

  if (!info?.installed) {
    return (
      <div className="dm-error-state">
        <Container size={48} />
        <h2>Docker Not Found</h2>
        <p>Docker binary is not available on this server.</p>
        {info?.error && <p className="dm-hint dm-error-detail">{info.error}</p>}
        <p className="dm-hint">Install Docker from the Software Center first, then try again.</p>
        <button className="dm-btn dm-btn-primary" onClick={handleRefresh}>
          <RefreshCw size={14} /> Check Again
        </button>
      </div>
    );
  }

  if (info.installed && !info.running) {
    return (
      <div className="dm-error-state">
        <Server size={48} />
        <h2>Docker Daemon Not Running</h2>
        <p>Docker is installed but the daemon is not running.</p>
        {info?.error && <p className="dm-hint dm-error-detail">{info.error}</p>}
        <p className="dm-hint">Start the service with: <code>systemctl start docker</code></p>
        <button className="dm-btn dm-btn-primary" onClick={handleRefresh}>
          <RefreshCw size={14} /> Check Again
        </button>
      </div>
    );
  }

  if (info.installed && info.running && info.accessible === false) {
    return (
      <div className="dm-error-state">
        <Server size={48} />
        <h2>Docker Not Accessible</h2>
        <p>Docker is installed and running, but the CloudBanana service cannot access it.</p>
        {info?.error && <p className="dm-hint dm-error-detail dm-error-perm">{info.error}</p>}
        <p className="dm-hint">Add the <code>cloudbanana</code> user to the <code>docker</code> group and check sudoers permissions.</p>
        <button className="dm-btn dm-btn-primary" onClick={handleRefresh}>
          <RefreshCw size={14} /> Check Again
        </button>
      </div>
    );
  }

  return (
    <div className="dm">
      {/* Menu Bar */}
      <div className="dm-menubar win-drag-area" onMouseDown={(e) => e.stopPropagation()}>
        <span className="dm-menubar-title">
          <Container size={15} /> Docker Manager
        </span>
        <div className="dm-menubar-spacer" />
        {info && (
          <div className="dm-header-meta">
            <span className="dm-badge dm-badge-ok">v{info.version}</span>
            <span>{info.containers_running || 0}/{info.containers || 0} containers</span>
            <span>{info.images || 0} images</span>
          </div>
        )}
        <div className="dm-menubar-sep" />
        <button className="dm-menubar-btn" onClick={handleRefresh} title="Refresh">
          <RefreshCw size={12} /> Refresh
        </button>
        <div className="dm-menubar-menu" onMouseLeave={() => setOpenMenu(null)}
          onMouseDown={(e) => e.stopPropagation()}>
          <button className={`dm-menubar-btn${openMenu === 'Help' ? ' open' : ''}`}
            onClick={() => setOpenMenu(openMenu === 'Help' ? null : 'Help')}
            onMouseEnter={() => openMenu === 'Help' && setOpenMenu('Help')}>
            <Info size={12} /> Help
          </button>
          {openMenu === 'Help' && (
            <div className="dm-menubar-drop" style={{ left: 'auto', right: 0 }}>
              <button className="dm-menubar-item" onClick={() => { setOpenMenu(null); setShowHelp(true); }}>
                <Info size={14} /> About Docker Manager
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="dm-msg dm-msg-error">
          <AlertTriangle size={12} />
          <span>{error}</span>
          <button onClick={() => setError('')}><X size={12} /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="dm-tabs">
        <button className={`dm-tab${tab === 'containers' ? ' active' : ''}`} onClick={() => setTab('containers')}>
          <Box size={13} /> Containers
          {containers.length > 0 && <span className="dm-tab-count">{containers.length}</span>}
        </button>
        <button className={`dm-tab${tab === 'images' ? ' active' : ''}`} onClick={() => setTab('images')}>
          <HardDrive size={13} /> Images
          {images.length > 0 && <span className="dm-tab-count">{images.length}</span>}
        </button>
        <button className={`dm-tab${tab === 'logs' ? ' active' : ''}`} onClick={() => setTab('logs')} disabled={!selectedContainer}>
          <FileText size={13} /> Logs
        </button>
        <button className={`dm-tab${tab === 'stats' ? ' active' : ''}`} onClick={() => setTab('stats')} disabled={!selectedContainer}>
          <Activity size={13} /> Stats
        </button>
      </div>

      <div className="dm-body">
        {/* ===== CONTAINERS TAB ===== */}
        {tab === 'containers' && (
          <div className="dm-panel">
            <div className="dm-toolbar">
              <div className="dm-search">
                <Search size={12} />
                <input type="text" placeholder="Search containers..." value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <span className="dm-count">{filteredContainers.length} containers</span>
            </div>
            <div className="dm-table-wrap">
              <table className="dm-table">
                <thead>
                  <tr>
                    <th style={{ width: 80 }}>Status</th>
                    <th>Name</th>
                    <th>Image</th>
                    <th style={{ width: 100 }}>Ports</th>
                    <th style={{ width: 80 }}>Size</th>
                    <th style={{ width: 180 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContainers.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <span className="dm-state-dot" style={{ background: stateColor(c.state) }} />
                        <span className="dm-state-text" style={{ color: stateColor(c.state) }}>{c.state}</span>
                      </td>
                      <td>
                        <span className="dm-container-name">{c.name}</span>
                        <span className="dm-container-id">{shortId(c.id)}</span>
                      </td>
                      <td><span className="dm-cell-mono">{c.image}</span></td>
                      <td><span className="dm-ports">{formatPorts(c.ports)}</span></td>
                      <td><span className="dm-cell-size">{formatSize(c.size)}</span></td>
                      <td>
                        <div className="dm-actions">
                          {c.state !== 'running' && (
                            <button className="dm-act dm-act-start" onClick={() => containerAction(c.id, 'start')}
                              disabled={actionLoading === c.id} title="Start">
                              <Play size={12} />
                            </button>
                          )}
                          {c.state === 'running' && (
                            <button className="dm-act dm-act-stop" onClick={() => containerAction(c.id, 'stop')}
                              disabled={actionLoading === c.id} title="Stop">
                              <Square size={12} />
                            </button>
                          )}
                          <button className="dm-act dm-act-restart" onClick={() => containerAction(c.id, 'restart')}
                            disabled={actionLoading === c.id} title="Restart">
                            <RotateCcw size={11} />
                          </button>
                          <button className="dm-act dm-act-logs" onClick={() => viewLogs(c.id)} title="View Logs">
                            <FileText size={11} />
                          </button>
                          <button className="dm-act dm-act-stats" onClick={() => viewStats(c.id)} title="View Stats">
                            <Activity size={11} />
                          </button>
                          {confirmRemove === c.id ? (
                            <div className="dm-confirm-actions">
                              <button className="dm-act dm-act-confirm" onClick={() => containerAction(c.id, 'remove')}
                                disabled={actionLoading === c.id}>Remove?</button>
                              <button className="dm-act dm-act-cancel" onClick={() => setConfirmRemove(null)}><X size={11} /></button>
                            </div>
                          ) : (
                            <button className="dm-act dm-act-remove" onClick={() => setConfirmRemove(c.id)}
                              title="Remove">
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredContainers.length === 0 && (
                    <tr><td colSpan={6} className="dm-empty">No containers found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== IMAGES TAB ===== */}
        {tab === 'images' && (
          <div className="dm-panel">
            {/* Pull image */}
            <div className="dm-pull-row">
              <input className="dm-input" type="text" placeholder="Pull an image (e.g. nginx:latest, ubuntu:22.04)"
                value={pullImage} onChange={(e) => setPullImage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePullImage()} />
              <button className="dm-btn dm-btn-primary" onClick={handlePullImage} disabled={pullLoading || !pullImage.trim()}>
                <Download size={13} /> {pullLoading ? 'Pulling...' : 'Pull'}
              </button>
            </div>

            {pullStatus && (
              <div className={`dm-pull-status dm-pull-${pullStatus.status}`}>
                <span>{pullStatus.status === 'running' ? 'Pulling...' : pullStatus.status === 'done' ? 'Pull completed!' : 'Pull failed'}</span>
                {pullStatus.output && <pre className="dm-pull-output">{pullStatus.output}</pre>}
              </div>
            )}

            <div className="dm-toolbar" style={{ marginTop: 8 }}>
              <div className="dm-search">
                <Search size={12} />
                <input type="text" placeholder="Search images..." value={imgSearchQuery}
                  onChange={(e) => setImgSearchQuery(e.target.value)} />
              </div>
              <span className="dm-count">{filteredImages.length} images</span>
            </div>
            <div className="dm-table-wrap">
              <table className="dm-table">
                <thead>
                  <tr>
                    <th>Repository</th>
                    <th style={{ width: 80 }}>Tag</th>
                    <th style={{ width: 90 }}>Image ID</th>
                    <th style={{ width: 80 }}>Size</th>
                    <th style={{ width: 80 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredImages.map((img) => (
                    <tr key={img.id}>
                      <td><span className="dm-cell-mono">{img.repository || '(untagged)'}</span></td>
                      <td><span className="dm-tag">{img.tag || 'latest'}</span></td>
                      <td><span className="dm-cell-mono dm-id">{shortId(img.id)}</span></td>
                      <td><span className="dm-cell-size">{formatSize(img.size)}</span></td>
                      <td>
                        {confirmRemoveImg === img.id ? (
                          <div className="dm-confirm-actions">
                            <button className="dm-act dm-act-confirm" onClick={() => removeImage(img.id)}
                              disabled={actionLoading === img.id}>Remove?</button>
                            <button className="dm-act dm-act-cancel" onClick={() => setConfirmRemoveImg(null)}><X size={11} /></button>
                          </div>
                        ) : (
                          <button className="dm-act dm-act-remove" onClick={() => setConfirmRemoveImg(img.id)} title="Remove image">
                            <Trash2 size={11} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredImages.length === 0 && (
                    <tr><td colSpan={5} className="dm-empty">No images found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== LOGS TAB ===== */}
        {tab === 'logs' && (
          <div className="dm-panel dm-panel-logs">
            <div className="dm-logs-header">
              <span>Container: <strong>{selectedContainer ? shortId(selectedContainer) : '—'}</strong></span>
              <div className="dm-logs-actions">
                <button className="dm-btn dm-btn-small" onClick={async () => {
                  if (!selectedContainer) return;
                  setLogsLoading(true);
                  try {
                    const data = await api.get<{ logs: string }>(`/docker/containers/${selectedContainer}/logs?tail=200`);
                    setContainerLogs(data.logs);
                  } catch (e) {
                    setContainerLogs('Error: ' + (e instanceof Error ? e.message : ''));
                  }
                  setLogsLoading(false);
                }}>
                  <RefreshCw size={11} /> Refresh
                </button>
              </div>
            </div>
            <div className="dm-logs-body">
              {logsLoading ? (
                <div className="dm-loading-inline"><div className="dm-spinner" /> Loading logs...</div>
              ) : (
                <pre className="dm-logs-output">{containerLogs || 'No logs available'}</pre>
              )}
            </div>
          </div>
        )}

        {/* ===== STATS TAB ===== */}
        {tab === 'stats' && (
          <div className="dm-panel">
            <div className="dm-stats-header">
              <span>Container: <strong>{selectedContainer ? shortId(selectedContainer) : '—'}</strong></span>
              <button className="dm-btn dm-btn-small" onClick={async () => {
                if (!selectedContainer) return;
                setStatsLoading(true);
                try {
                  const data = await api.get<any>(`/docker/containers/${selectedContainer}/stats`);
                  setContainerStats(data);
                } catch {
                  setContainerStats({ error: 'Failed to load stats' });
                }
                setStatsLoading(false);
              }}>
                <RefreshCw size={11} /> Refresh
              </button>
            </div>
            {statsLoading ? (
              <div className="dm-loading-inline"><div className="dm-spinner" /> Loading stats...</div>
            ) : containerStats?.error ? (
              <div className="dm-empty">{containerStats.error}</div>
            ) : (
              <div className="dm-stats-grid">
                {containerStats && Object.entries(containerStats).filter(([k]) => !k.startsWith('error')).map(([key, val]) => (
                  <div key={key} className="dm-stat-item">
                    <span className="dm-stat-label">{key}</span>
                    <span className="dm-stat-value">{typeof val === 'string' ? val : JSON.stringify(val)}</span>
                  </div>
                ))}
                {(!containerStats || Object.keys(containerStats).length === 0) && (
                  <div className="dm-empty">No stats available. Container may not be running.</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Help/About modal */}
      {showHelp && (
        <div className="dm-overlay" onClick={() => setShowHelp(false)}>
          <div className="dm-about-modal" onClick={(e) => e.stopPropagation()}>
            <button className="dm-about-close" onClick={() => setShowHelp(false)}>
              <X size={14} />
            </button>
            {helpContent}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import {
  Download, Trash2, Edit3, Info, Link, X,
  Play, Pause, SkipBack, SkipForward, Volume2, Volume1, VolumeX,
  Maximize, Minimize, Image, Film, Music, File,
} from 'lucide-react';
import { api, getToken } from '../../api';
import { useDesktopStore } from '../../store/desktopStore';
import { getLinkId, setLinkId, updateLinkPath } from './fileLinks';

interface Props {
  winId?: string;
  winData?: Record<string, unknown>;
}

const IMG_EXTS = ['png','jpg','jpeg','gif','svg','webp','bmp','ico'];
const VID_EXTS = ['mp4','avi','mkv','webm','mov','wmv'];
const AUD_EXTS = ['mp3','wav','flac','ogg','aac','m4a'];

function isImage(n: string) { return IMG_EXTS.includes(n.split('.').pop()?.toLowerCase() || ''); }
function isVideo(n: string) { return VID_EXTS.includes(n.split('.').pop()?.toLowerCase() || ''); }
function isAudio(n: string) { return AUD_EXTS.includes(n.split('.').pop()?.toLowerCase() || ''); }

function fmtBytes(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

export default function BPlayer({ winId, winData }: Props) {
  const initialPath = (winData?.path as string) || '';
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [fileId, setFileId] = useState('');
  const [blobUrl, setBlobUrl] = useState('');
  const [error, setError] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState('');
  const [aboutOpen, setAboutOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { setWindowData, closeWindow } = useDesktopStore();
  const loadedRef = useRef(false);
  const mountedRef = useRef(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [imgFit, setImgFit] = useState(true);

  const fileName = currentPath.split('/').pop() || 'file';
  const mediaType = isVideo(fileName) ? 'video' : isAudio(fileName) ? 'audio' : isImage(fileName) ? 'image' : 'unknown';

  // Load file
  useEffect(() => {
    if (!currentPath || loadedRef.current) return;
    mountedRef.current = true;
    loadedRef.current = true;

    const existingId = getLinkId(currentPath);
    if (existingId) {
      setFileId(existingId);
      loadBlob(existingId);
      return;
    }

    // Use the api helper so CSRF token and Authorization header are sent correctly
    api.post<{ id: string; size?: number }>('/files/link', { path: currentPath }).then(data => {
      if (!mountedRef.current) return;
      if (data.id) {
        setLinkId(currentPath, data.id);
        setFileId(data.id);
        if (data.size) setFileSize(data.size);
        loadBlob(data.id);
      } else {
        setError('Failed to create link');
      }
    }).catch(e => {
      if (mountedRef.current) setError(e.message || 'Failed to create link');
    });
  }, [currentPath]);

  function loadBlob(id: string) {
    const token = getToken();
    fetch(`/api/v1/files/raw/${id}`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    }).then(r => {
      if (!r.ok) throw new Error('Failed to load');
      const size = parseInt(r.headers.get('content-length') || '0');
      if (size) setFileSize(size);
      return r.blob();
    }).then(blob => {
      if (mountedRef.current) setBlobUrl(URL.createObjectURL(blob));
    }).catch(e => {
      if (mountedRef.current) setError(e.message);
    });
  }

  useEffect(() => {
    return () => { mountedRef.current = false; if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, []);

  const publicUrl = fileId ? `${location.origin}/api/v1/files/raw/${fileId}` : '';

  const formatTime = (t: number) => {
    if (!t || !isFinite(t)) return '0:00';
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = Math.floor(t % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // === Video/Audio controls ===
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play(); else v.pause();
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (v) { setCurrentTime(v.currentTime); setPlaying(!v.paused); }
  };

  const handleLoadedMeta = () => {
    const v = videoRef.current;
    if (v) {
      setDuration(v.duration);
      setVolume(v.volume);
      setMuted(v.muted);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = pct * duration;
  };

  const handleVolumeChange = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const vol = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.volume = vol;
    v.muted = vol === 0;
    setVolume(vol);
    setMuted(v.muted);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const skipForward = () => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.min(v.duration, v.currentTime + 10);
  };

  const skipBackward = () => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, v.currentTime - 10);
  };

  // === Image controls ===
  const zoomIn = () => { setZoom(z => Math.min(5, z + 0.25)); setImgFit(false); };
  const zoomOut = () => { setZoom(z => Math.max(0.25, z - 0.25)); };
  const resetZoom = () => { setZoom(1); setImgFit(true); };
  const fitToWindow = () => { setImgFit(true); setZoom(1); };

  // === File operations ===
  const copyPublicUrl = async () => {
    try { await navigator.clipboard.writeText(publicUrl); }
    catch {
      const ta = document.createElement('textarea');
      ta.value = publicUrl;
      ta.style.position = 'fixed'; ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const download = () => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    a.click();
    setOpenMenu(null);
  };

  const startRename = () => {
    const dot = fileName.lastIndexOf('.');
    setRenameVal(dot > 0 ? fileName.slice(0, dot) : fileName);
    setRenaming(true);
    setOpenMenu(null);
  };

  const doRename = async () => {
    if (!renameVal.trim()) { setRenaming(false); return; }
    const dot = fileName.lastIndexOf('.');
    const ext = dot > 0 ? fileName.slice(dot) : '';
    const newName = renameVal.trim() + ext;
    if (newName === fileName) { setRenaming(false); return; }
    try {
      const oldPath = currentPath;
      const newPath = oldPath.slice(0, oldPath.lastIndexOf('/') + 1) + newName;
      await api.post('/files/rename', { path: oldPath, new_name: newName });
      if (fileId) {
        await api.patch(`/files/link/${fileId}`, { path: newPath });
        updateLinkPath(oldPath, newPath);
      }
      setCurrentPath(newPath);
      if (winId) setWindowData(winId, { path: newPath });
      setRenaming(false);
    } catch (e) {
      setError('Rename error: ' + (e instanceof Error ? e.message : ''));
    }
  };

  const deleteFile = async () => {
    if (!confirm('Delete ' + fileName + '?')) return;
    try {
      await api.post('/files/remove', { path: currentPath });
      setOpenMenu(null);
      if (winId && blobUrl) { URL.revokeObjectURL(blobUrl); closeWindow(winId); }
    } catch (e) {
      setError('Delete error: ' + (e instanceof Error ? e.message : ''));
    }
  };

  const openNewFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*,audio/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      // Upload first, then open
      const form = new FormData();
      form.append('file', file);
      form.append('path', '/tmp');
      try {
        const data = await api.post<{ path?: string }>('/files/upload', form, true);
        if (data.path) {
          loadedRef.current = false;
          setCurrentPath(data.path);
          setBlobUrl('');
          setFileId('');
          setFileSize(0);
          setError('');
          setPlaying(false);
          setCurrentTime(0);
          setDuration(0);
        }
      } catch (e) {
        setError('Upload error');
      }
    };
    input.click();
    setOpenMenu(null);
  };

  // === Empty state ===
  if (!currentPath) {
    return (
      <div className="bp">
        <div className="bp-menubar">
          <div className="bp-menu" onMouseLeave={() => setOpenMenu(null)}
            onMouseDown={(e) => e.stopPropagation()}>
            <button className={`bp-menu-btn${openMenu === 'Media' ? ' open' : ''}`}
              onClick={() => setOpenMenu(openMenu === 'Media' ? null : 'Media')}
              onMouseEnter={() => openMenu && setOpenMenu('Media')}>
              Media
            </button>
            {openMenu === 'Media' && (
              <div className="bp-menu-drop">
                <button className="bp-menu-item" onClick={openNewFile}><Play size={12} /> Open File...</button>
                <div className="bp-menu-sep" />
                <button className="bp-menu-item" onClick={() => { setOpenMenu(null); setAboutOpen(true); }}>
                  <Info size={12} /> About BPlayer
                </button>
              </div>
            )}
          </div>
          <div className="bp-menu" onMouseLeave={() => setOpenMenu(null)}
            onMouseDown={(e) => e.stopPropagation()}>
            <button className={`bp-menu-btn${openMenu === 'Playback' ? ' open' : ''}`}
              onClick={() => setOpenMenu(openMenu === 'Playback' ? null : 'Playback')}
              onMouseEnter={() => openMenu && setOpenMenu('Playback')}>
              Playback
            </button>
            {openMenu === 'Playback' && (
              <div className="bp-menu-drop">
                <button className="bp-menu-item" disabled style={{opacity:0.3}}>
                  <Play size={12} /> No media loaded
                </button>
              </div>
            )}
          </div>
          <div className="bp-menu" onMouseLeave={() => setOpenMenu(null)}
            onMouseDown={(e) => e.stopPropagation()}>
            <button className={`bp-menu-btn${openMenu === 'View' ? ' open' : ''}`}
              onClick={() => setOpenMenu(openMenu === 'View' ? null : 'View')}
              onMouseEnter={() => (openMenu === 'Media' || openMenu === 'Playback') && setOpenMenu('View')}>
              View
            </button>
            {openMenu === 'View' && (
              <div className="bp-menu-drop">
                <button className="bp-menu-item" onClick={() => { setOpenMenu(null); }}>
                  <Info size={12} /> File Info
                </button>
              </div>
            )}
          </div>
          <div className="bp-menubar-title">BPlayer</div>
        </div>
        <div className="bp-body">
          <div className="bp-empty">
            <Film size={48} className="bp-empty-icon" />
            <div className="bp-empty-text">BPlayer</div>
            <div className="bp-empty-hint">Click Media → Open File to play a file</div>
          </div>
        </div>
        <div className="bp-status">
          <span className="bp-status-item">No file opened</span>
        </div>
        {aboutOpen && renderAbout()}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bp">
        <div className="bp-menubar">
          <div className="bp-menubar-title">BPlayer</div>
        </div>
        <div className="bp-body">
          <div className="bp-empty">
            <X size={32} className="bp-empty-icon" style={{color:'#ff6b6b'}} />
            <div className="bp-empty-text" style={{color:'#ff6b6b'}}>{error}</div>
          </div>
        </div>
      </div>
    );
  }

  function renderAbout() {
    return (
      <div className="modal-overlay" onClick={() => setAboutOpen(false)}>
        <div className="modal-box" style={{ width: 320 }}>
          <div className="bp-about">
            <div className="bp-about-logo">BPlayer</div>
            <div className="bp-about-ver">Version 1.0</div>
            <div className="bp-about-desc">
              VLC-style media player for CloudBanana DE.<br />
              Supports images, videos, and audio playback.
            </div>
            <div className="modal-actions" style={{ justifyContent: 'center', marginTop: '0.75rem' }}>
              <button className="modal-btn modal-btn-primary" onClick={() => setAboutOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const VolIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div className="bp">
      {/* Hidden video/audio element for playback */}
      {(mediaType === 'video' || mediaType === 'audio') && (
        <video ref={videoRef} src={blobUrl}
          onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleLoadedMeta}
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          style={{ display: 'none' }} />
      )}

      {/* ===== VLC Menu Bar ===== */}
      <div className="bp-menubar">
        <div className="bp-menu" onMouseLeave={() => setOpenMenu(null)}
          onMouseDown={(e) => e.stopPropagation()}>
          <button className={`bp-menu-btn${openMenu === 'Media' ? ' open' : ''}`}
            onClick={() => setOpenMenu(openMenu === 'Media' ? null : 'Media')}
            onMouseEnter={() => openMenu && setOpenMenu('Media')}>
            Media
          </button>
          {openMenu === 'Media' && (
            <div className="bp-menu-drop">
              <button className="bp-menu-item" onClick={openNewFile}><Play size={12} /> Open File...</button>
              {currentPath && <button className="bp-menu-item" onClick={download}><Download size={12} /> Download</button>}
              {currentPath && <button className="bp-menu-item" onClick={startRename}><Edit3 size={12} /> Rename</button>}
              <div className="bp-menu-sep" />
              <button className="bp-menu-item" onClick={copyPublicUrl}><Link size={12} /> {copied ? 'Copied!' : 'Copy URL'}</button>
              <div className="bp-menu-sep" />
              {currentPath && (
                <button className="bp-menu-item danger" onClick={deleteFile}><Trash2 size={12} /> Delete</button>
              )}
              <div className="bp-menu-sep" />
              <button className="bp-menu-item" onClick={() => { setOpenMenu(null); setAboutOpen(true); }}>
                <Info size={12} /> About BPlayer
              </button>
            </div>
          )}
        </div>
        <div className="bp-menu" onMouseLeave={() => setOpenMenu(null)}
          onMouseDown={(e) => e.stopPropagation()}>
          <button className={`bp-menu-btn${openMenu === 'Playback' ? ' open' : ''}`}
            onClick={() => setOpenMenu(openMenu === 'Playback' ? null : 'Playback')}
            onMouseEnter={() => openMenu && setOpenMenu('Playback')}>
            Playback
          </button>
          {openMenu === 'Playback' && (
            <div className="bp-menu-drop">
              <button className="bp-menu-item" onClick={() => { togglePlay(); setOpenMenu(null); }}>
                {playing ? <Pause size={12} /> : <Play size={12} />} {playing ? 'Pause' : 'Play'}
              </button>
              <button className="bp-menu-item" onClick={() => { skipBackward(); setOpenMenu(null); }}>
                <SkipBack size={12} /> Skip Back 10s
              </button>
              <button className="bp-menu-item" onClick={() => { skipForward(); setOpenMenu(null); }}>
                <SkipForward size={12} /> Skip Forward 10s
              </button>
            </div>
          )}
        </div>
        <div className="bp-menu" onMouseLeave={() => setOpenMenu(null)}
          onMouseDown={(e) => e.stopPropagation()}>
          <button className={`bp-menu-btn${openMenu === 'View' ? ' open' : ''}`}
            onClick={() => setOpenMenu(openMenu === 'View' ? null : 'View')}
            onMouseEnter={() => (openMenu === 'Media' || openMenu === 'Playback') && setOpenMenu('View')}>
            View
          </button>
          {openMenu === 'View' && (
            <div className="bp-menu-drop">
              {mediaType === 'image' && (
                <>
                  <button className="bp-menu-item" onClick={() => { zoomIn(); setOpenMenu(null); }}>
                    <Maximize size={12} /> Zoom In
                  </button>
                  <button className="bp-menu-item" onClick={() => { zoomOut(); setOpenMenu(null); }}>
                    <Minimize size={12} /> Zoom Out
                  </button>
                  <button className="bp-menu-item" onClick={() => { resetZoom(); setOpenMenu(null); }}>
                    <Image size={12} /> Fit to Window
                  </button>
                  <div className="bp-menu-sep" />
                </>
              )}
              <button className="bp-menu-item" onClick={() => { setOpenMenu(null); }}>
                <Info size={12} /> File Info
              </button>
            </div>
          )}
        </div>
        <div className="bp-menubar-title">BPlayer</div>
      </div>

      {/* ===== Toolbar ===== */}
      <div className="bp-toolbar">
        <button className="bp-tb-btn" onClick={openNewFile} title="Open File"><Play size={14} /></button>
        <button className="bp-tb-btn" onClick={download} title="Download"><Download size={14} /></button>
        <div className="bp-tb-spacer" />
        {mediaType === 'image' && (
          <>
            <button className="bp-tb-btn" onClick={zoomOut} title="Zoom Out"><Minimize size={14} /></button>
            <span className="bp-tb-label">{Math.round(zoom * 100)}%</span>
            <button className="bp-tb-btn" onClick={zoomIn} title="Zoom In"><Maximize size={14} /></button>
            <button className="bp-tb-btn" onClick={fitToWindow} title="Fit to Window"><Image size={14} /></button>
          </>
        )}
      </div>

      {/* ===== File Info Bar ===== */}
      <div className="bp-filebar">
        <span className="bp-filebar-icon">
          {mediaType === 'image' ? <Image size={13} /> : mediaType === 'video' ? <Film size={13} /> : mediaType === 'audio' ? <Music size={13} /> : <File size={13} />}
        </span>
        {renaming ? (
          <input className="bp-filebar-input" autoFocus value={renameVal}
            onChange={e => setRenameVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') doRename(); if (e.key === 'Escape') setRenaming(false); }}
            onBlur={() => doRename()} />
        ) : (
          <>
            <span className="bp-filebar-name" onDoubleClick={startRename}>{fileName}</span>
            {fileSize > 0 && <span className="bp-filebar-size">{fmtBytes(fileSize)}</span>}
          </>
        )}
      </div>

      {/* ===== Media Display ===== */}
      <div className="bp-body">
        {mediaType === 'image' ? (
          <img src={blobUrl} alt="" className="bp-media"
            style={imgFit ? {} : { maxWidth: 'none', maxHeight: 'none', width: 'auto', height: 'auto', transform: `scale(${zoom})` }} />
        ) : mediaType === 'video' ? (
          <video ref={videoRef} src={blobUrl} autoPlay className="bp-media"
            onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleLoadedMeta}
            onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onClick={togglePlay} />
        ) : mediaType === 'audio' ? (
          <div className="bp-empty">
            <Music size={48} className="bp-empty-icon" />
            <div className="bp-empty-text">Now Playing</div>
            <div className="bp-empty-hint">{fileName}</div>
          </div>
        ) : (
          <div className="bp-empty">
            <File size={48} className="bp-empty-icon" />
            <div className="bp-empty-text">Unknown file type</div>
          </div>
        )}

        {/* Image zoom controls (overlay) */}
        {mediaType === 'image' && (
          <div className="bp-img-controls">
            <button className="bp-zoom-btn" onClick={zoomOut}><Minimize size={12} /></button>
            <span className="bp-zoom-label">{Math.round(zoom * 100)}%</span>
            <button className="bp-zoom-btn" onClick={zoomIn}><Maximize size={12} /></button>
            <button className="bp-zoom-btn" onClick={fitToWindow}><Image size={12} /></button>
          </div>
        )}
      </div>

      {/* ===== Playback Controls (VLC bottom bar) ===== */}
      {(mediaType === 'video' || mediaType === 'audio') && (
        <div className="bp-controls">
          <button className="bp-ctrl-btn" onClick={skipBackward} title="Skip Back 10s"><SkipBack size={14} /></button>
          <button className={`bp-ctrl-btn play${playing ? ' active' : ''}`} onClick={togglePlay} title={playing ? 'Pause' : 'Play'}>
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button className="bp-ctrl-btn" onClick={skipForward} title="Skip Forward 10s"><SkipForward size={14} /></button>

          <div className="bp-progress-wrap" onMouseDown={handleSeek}>
            <div className="bp-progress-track">
              <div className="bp-progress-bar" style={{ width: duration ? (currentTime / duration) * 100 + '%' : '0%' }} />
            </div>
            <div className="bp-progress-thumb" style={{ left: duration ? (currentTime / duration) * 100 + '%' : '0%' }} />
          </div>

          <span className="bp-time">{formatTime(currentTime)} / {formatTime(duration)}</span>

          <div className="bp-volume-wrap">
            <button className="bp-ctrl-btn" onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'}>
              <VolIcon size={14} />
            </button>
            <div className="bp-volume-track" onMouseDown={handleVolumeChange}>
              <div className="bp-volume-fill" style={{ width: muted ? '0%' : (volume * 100) + '%' }} />
            </div>
          </div>
        </div>
      )}

      {/* ===== Status Bar (VLC bottom) ===== */}
      <div className="bp-status">
        <span className="bp-status-item">{fileName}</span>
        <span className="bp-status-sep" />
        <span className="bp-status-item">
          {mediaType === 'image' ? 'Image' : mediaType === 'video' ? 'Video' : mediaType === 'audio' ? 'Audio' : 'File'}
        </span>
        {fileSize > 0 && (
          <>
            <span className="bp-status-sep" />
            <span className="bp-status-item">{fmtBytes(fileSize)}</span>
          </>
        )}
        {(mediaType === 'video' || mediaType === 'audio') && duration > 0 && (
          <>
            <span className="bp-status-sep" />
            <span className="bp-status-item">{formatTime(duration)}</span>
          </>
        )}
        <span className="bp-status-sep" />
        <span className="bp-status-item">BPlayer 1.0</span>
      </div>

      {/* About modal */}
      {aboutOpen && renderAbout()}
    </div>
  );
}

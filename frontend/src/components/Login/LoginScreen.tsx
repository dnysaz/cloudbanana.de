import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../api';
import { WALLPAPERS } from '../../types';
import { Monitor, LogIn } from 'lucide-react';
import RegisterForm from './RegisterForm';

function lighten(hex: string, amt: number) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgb(${Math.min(255, (n >> 16) + amt)},${Math.min(255, ((n >> 8) & 255) + amt)},${Math.min(255, (n & 255) + amt)})`;
}

interface Props {
  onEnterDesktop: () => void;
}

interface PublicUser {
  id: number;
  username: string;
  role: string;
  name: string | null;
  avatar: string | null;
}

function UserAvatar({ userId, name, username, size }: { userId: number; name: string | null; username: string; size: number }) {
  const [failed, setFailed] = useState(false);
  const initial = (name || username)[0].toUpperCase();
  const avatarUrl = `/api/v1/auth/avatar/${userId}`;
  if (!failed) {
    return (
      <img src={avatarUrl} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }}
        onError={() => setFailed(true)} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'rgba(255,255,255,0.12)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: '2px solid rgba(255,255,255,0.2)',
      color: 'rgba(255,255,255,0.8)',
      fontSize: size * 0.42, fontWeight: 700,
    }}>
      {initial}
    </div>
  );
}

export default function LoginScreen({ onEnterDesktop }: Props) {
  const { user, token, checkAuth, login } = useAuthStore();
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<PublicUser | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [time, setTime] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [manualLogin, setManualLogin] = useState(false);
  const [manualUsername, setManualUsername] = useState('');
  const [backendOffline, setBackendOffline] = useState(false);
  const retryRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isNetworkError = (err: unknown) => {
    if (err && typeof err === 'object' && 'status' in err) {
      const s = (err as { status: number }).status;
      return s === 0 || s === 408;
    }
    return false;
  };

  useEffect(() => {
    // Wallpaper
    const saved = localStorage.getItem('cb-wallpaper');
    if (saved) {
      const wp = WALLPAPERS.find((w) => w.id === saved);
      if (wp) {
        const el = document.getElementById('login-screen');
        if (el) {
          el.style.background = wp.type === 'color'
            ? `radial-gradient(ellipse at 50% 30%, ${lighten(wp.value, 30)} 0%, ${wp.value} 70%)`
            : `url('${wp.value}') center/cover no-repeat`;
        }
      }
    }
    // Theme
    if (localStorage.getItem('cb-theme') === 'dark') document.documentElement.classList.add('theme-dark');
    const size = localStorage.getItem('cb-size');
    if (size) document.documentElement.style.fontSize = size + 'px';
    const font = localStorage.getItem('cb-font');
    if (font) document.body.style.fontFamily = `'${font}', -apple-system, sans-serif`;

    // Clock
    const updateTime = () => setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    updateTime();
    const iv = setInterval(updateTime, 30000);

    // Check auth
    checkAuth().then(() => setLoading(false));

    const loadUsers = () => {
      api.get<PublicUser[]>('/auth/users/public')
        .then((data) => {
          setBackendOffline(false);
          if (data.length > 0) {
            setUsers(data);
            setUsersLoaded(true);
          } else {
            api.get<{admin_exists: boolean}>('/auth/check').then((chk) => {
              if (chk.admin_exists) setManualLogin(true);
              else setShowRegister(true);
              setUsersLoaded(true);
            }).catch(() => {
              setManualLogin(true);
              setUsersLoaded(true);
            });
          }
        })
        .catch((err) => {
          if (isNetworkError(err)) {
            setBackendOffline(true);
            setLoading(false);
          } else {
            api.get<{admin_exists: boolean}>('/auth/check').then((chk) => {
              if (chk.admin_exists) setManualLogin(true);
              else setShowRegister(true);
              setUsersLoaded(true);
            }).catch(() => {
              setManualLogin(true);
              setUsersLoaded(true);
            });
          }
        });
    };
    loadUsers();

    // Auto-retry when backend offline: check every 10s
    retryRef.current = setInterval(() => {
      api.get<PublicUser[]>('/auth/users/public')
        .then((data) => {
          if (Array.isArray(data)) {
            setBackendOffline(false);
            if (data.length > 0) {
              setUsers(data);
              setUsersLoaded(true);
            }
            // Stop retrying once backend responds
            if (retryRef.current) {
              clearInterval(retryRef.current);
              retryRef.current = null;
            }
          }
        })
        .catch(() => {});
    }, 10000);

    return () => {
      clearInterval(iv);
      if (retryRef.current) clearInterval(retryRef.current);
    };
  }, []);

  useEffect(() => {
    if (user && token) onEnterDesktop();
  }, [user, token]);

  const handleLogin = async () => {
    if (!selectedUser || !password || signingIn) return;
    setError('');
    setSigningIn(true);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await login(selectedUser.username, password);
        onEnterDesktop();
        return;
      } catch (err) {
        const isNetworkErr = isNetworkError(err);
        if (attempt < 2 && isNetworkErr) {
          await new Promise(r => setTimeout(r, 1500));
          continue;
        }
        setError(err instanceof Error ? err.message : 'Login failed');
        break;
      }
    }
    setSigningIn(false);
  };

  const handleManualLogin = async () => {
    if (!manualUsername || !password || signingIn) return;
    setError('');
    setSigningIn(true);
    // Auto-retry up to 3 times with delay
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await login(manualUsername, password);
        onEnterDesktop();
        return;
      } catch (err) {
        const isNetworkErr = isNetworkError(err);
        if (attempt < 2 && isNetworkErr) {
          // Wait 1.5s before retrying
          await new Promise(r => setTimeout(r, 1500));
          continue;
        }
        const msg = err instanceof Error ? err.message : 'Login failed';
        if (isNetworkErr) {
          setError('Backend is temporarily unreachable. The server may be under heavy load. Please wait a moment and try again.');
        } else {
          setError(msg);
        }
        break;
      }
    }
    setSigningIn(false);
  };

  const handleRegistered = useCallback(() => {
    setShowRegister(false);
    setManualLogin(true);
    api.get<PublicUser[]>('/auth/users/public')
      .then((data) => setUsers(data))
      .catch(() => {});
  }, []);

  if (loading) {
    return (
      <div id="login-screen">
        <div className="login-overlay" />
        <div className="login-panel">
          <div className="login-loading">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div id="login-screen">
      <div className="login-overlay" />
      <div className="login-top">
        <Monitor size={18} />
        <span>CloudBanana DE</span>
        <a href="https://cloudbanana.de" target="_blank" rel="noopener noreferrer"
          style={{ marginLeft:'0.5rem', fontSize:'0.6rem', color:'rgba(255,255,255,0.25)', textDecoration:'none', letterSpacing:'0.03em' }}>
          cloudbanana.de ↗
        </a>
      </div>
      <div className="login-center">
        <div className="login-time">{time}</div>
        <div className={`login-panel${showRegister ? ' setup' : ''}`}>
          {selectedUser ? (
            <div className="login-form">
              <div className="login-avatar-circle">
                <UserAvatar userId={selectedUser.id} name={selectedUser.name} username={selectedUser.username} size={80} />
              </div>
              <div className="login-selected-user">{selectedUser.name || selectedUser.username}</div>
              <input type="password" placeholder="Password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()} autoFocus />
              <button className="login-btn" onClick={handleLogin} disabled={signingIn}>
                {signingIn ? <><span className="login-spinner" /> Signing in...</> : <><LogIn size={14} /> Sign In</>}
              </button>
              {error && <div className="login-msg show error">{error}</div>}
              <button className="login-back-btn" onClick={() => { setSelectedUser(null); setPassword(''); setError(''); }}>
                <LogIn size={12} /> Back
              </button>
            </div>
          ) : manualLogin ? (
            <div className="login-form">
              <div style={{ textAlign:'center', marginBottom:'1rem' }}>
                <div className="login-avatar-circle" style={{ width:60, height:60 }}>
                  <LogIn size={24} style={{ color:'rgba(255,255,255,0.7)' }} />
                </div>
                <div className="login-selected-user" style={{ fontSize:'0.85rem' }}>Admin Login</div>
              </div>
              <input type="text" placeholder="Username" value={manualUsername}
                onChange={(e) => setManualUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (document.getElementById('ml-pass') as HTMLInputElement)?.focus()}
                autoFocus autoComplete="username" />
              <input id="ml-pass" type="password" placeholder="Password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualLogin()}
                autoComplete="current-password" />
              <button className="login-btn" onClick={handleManualLogin} disabled={signingIn}>
                {signingIn ? <><span className="login-spinner" /> Signing in...</> : <><LogIn size={14} /> Sign In</>}
              </button>
              {error && <div className="login-msg show error">{error}</div>}
            </div>
          ) : backendOffline ? (
            <div className="login-offline">
              <div className="login-offline-icon">⚠️</div>
              <div className="login-offline-title">Server Unreachable</div>
              <div className="login-offline-msg">
                CloudBanana backend is offline or not responding.
                <br />Please refresh the page or check the server status.
              </div>
              <button className="login-btn" onClick={() => { setBackendOffline(false); setLoading(true); window.location.reload(); }}
                style={{ marginTop:'0.75rem' }}>
                <LogIn size={14} /> Retry / Refresh
              </button>
            </div>
          ) : showRegister ? (
            <RegisterForm onRegistered={handleRegistered} />
          ) : (
            <div className="login-user-list" style={{ padding:'0.5rem 0' }}>
              {users.length > 0 ? users.map((u) => (
                <button key={u.id} className="login-user-btn" onClick={() => setSelectedUser(u)}>
                  <div className="login-user-avatar">
                    <UserAvatar userId={u.id} name={u.name} username={u.username} size={48} />
                  </div>
                  <span className="login-user-name">{u.name || u.username}</span>
                </button>
              )) : (
                <div style={{ textAlign:'center', padding:'0.5rem' }}>
                  <p style={{ fontSize:'0.75rem', color:'var(--text-secondary)', margin:'0 0 0.5rem 0' }}>
                    {usersLoaded ? 'No users found' : 'Loading...'}
                  </p>
                  {usersLoaded && (
                    <button className="login-manual-btn" onClick={() => setManualLogin(true)}
                      style={{ fontSize:'0.7rem', padding:'0.3rem 0.8rem', borderRadius:'6px', border:'1px solid var(--border-subtle)', background:'var(--bg-tertiary)', color:'var(--text-primary)', cursor:'pointer' }}>
                      Login manually
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
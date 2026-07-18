import { useState, useRef, useEffect, useCallback } from 'react';
import type { User } from '../../types';
import { api, getToken } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { Palette, Type, Users, Info, Monitor, Terminal, RefreshCw, Package, UserPlus, Image, Trash, Trash2, AlertTriangle, X, Minus, Pencil, Eye, EyeOff, Scale, BookOpen, ChevronDown, ChevronRight, Copy, Check, Shield, Globe, Keyboard, ScrollText, Search, Clock, Sun, Moon, LogIn, Key, LayoutDashboard, Gauge } from 'lucide-react';
import { useDesktopStore } from '../../store/desktopStore';
import { WALLPAPERS } from '../../types';

function lighten(hex: string, amt: number) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgb(${Math.min(255, (n >> 16) + amt)},${Math.min(255, ((n >> 8) & 255) + amt)},${Math.min(255, (n & 255) + amt)})`;
}

function AppearanceTab() {
  const currentFont = localStorage.getItem('cb-font') || 'Inter';
  const currentSize = localStorage.getItem('cb-size') || '14';
  const currentWinOpacity = localStorage.getItem('cb-win-opacity') || '0.92';
  const currentWp = localStorage.getItem('cb-wallpaper') || 'purple';
  const [widgetsOn, setWidgetsOn] = useState(!!document.getElementById('win-widgets'));

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.toggle('theme-dark');
    localStorage.setItem('cb-theme', isDark ? 'dark' : 'light');
  };

  const setFont = (font: string) => {
    document.body.style.fontFamily = `'${font}', -apple-system, sans-serif`;
    localStorage.setItem('cb-font', font);
  };

  const setFontSize = (size: string) => {
    document.documentElement.style.fontSize = size + 'px';
    localStorage.setItem('cb-size', size);
  };

  const isDark = document.documentElement.classList.contains('theme-dark');

  const selectWp = (id: string) => {
    const wp = WALLPAPERS.find((w) => w.id === id);
    if (!wp) return;
    const el = document.getElementById('desktop-workspace');
    if (!el) return;
    if (wp.type === 'color') {
      el.style.background = `radial-gradient(ellipse at 50% 30%, ${lighten(wp.value, 30)} 0%, ${wp.value} 70%)`;
      el.style.backgroundImage = '';
    } else {
      el.style.background = `url('${wp.value}') center/cover no-repeat`;
    }
    localStorage.setItem('cb-wallpaper', id);
  };

  const openPicker = () => {
    document.dispatchEvent(new CustomEvent('open-wallpaper-picker'));
  };

  return (
    <>
      <h3>Appearance</h3>
      <p>Customize the look and feel of your desktop</p>
      <div className="st-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}>
        <span className="st-label"><Palette size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Theme</span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => { if (isDark) { toggleTheme(); } }}
            style={{
              flex: 1, padding: '0.75rem', borderRadius: 'var(--radius-lg)',
              border: isDark ? '2px solid var(--border-input)' : '2px solid var(--accent)',
              background: isDark ? 'var(--bg-surface)' : 'var(--accent-light)',
              color: isDark ? 'var(--text-secondary)' : 'var(--accent)',
              cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
            }}>
            <Sun size={22} style={{ display: 'block', margin: '0 auto 0.25rem' }} />
            <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>Light</div>
          </button>
          <button onClick={() => { if (!isDark) { toggleTheme(); } }}
            style={{
              flex: 1, padding: '0.75rem', borderRadius: 'var(--radius-lg)',
              border: isDark ? '2px solid var(--accent)' : '2px solid var(--border-input)',
              background: isDark ? 'var(--accent-light)' : 'var(--bg-surface)',
              color: isDark ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
            }}>
            <Moon size={22} style={{ display: 'block', margin: '0 auto 0.25rem' }} />
            <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>Dark</div>
          </button>
        </div>
      </div>
      <div className="st-row">
        <div>
          <div className="st-label"><Type size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Font</div>
          <div className="st-desc">Interface font family</div>
        </div>
        <select className="st-select" defaultValue={currentFont}
          onChange={(e) => setFont(e.target.value)}>
          {['Inter', 'system-ui', 'monospace', 'Segoe UI', 'Ubuntu', 'Cantarell'].map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>
      <div className="st-row">
        <div>
          <div className="st-label">Font Size</div>
          <div className="st-desc">Base text size in pixels</div>
        </div>
        <select className="st-select" defaultValue={currentSize}
          onChange={(e) => setFontSize(e.target.value)}>
          {[13, 14, 15, 16, 17, 18, 20, 22, 24, 26, 28, 30].map((s) => (
            <option key={s} value={s}>{s}px</option>
          ))}
        </select>
      </div>
      <div className="st-row">
        <div>
          <div className="st-label">Window Opacity</div>
          <div className="st-desc">Transparency of application windows</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input type="range" min="0.4" max="1" step="0.05" defaultValue={currentWinOpacity}
            onChange={(e) => {
              const v = e.target.value;
              localStorage.setItem('cb-win-opacity', v);
              document.documentElement.style.setProperty('--win-bg-opacity', v);
              (e.target.nextElementSibling as HTMLElement).textContent = Math.round(parseFloat(v) * 100) + '%';
              document.querySelectorAll('.win').forEach(el => {
                const w = el as HTMLElement;
                const dark = document.documentElement.classList.contains('theme-dark');
                const rgb = dark ? '30, 28, 46' : '255, 255, 255';
                w.style.background = `rgba(${rgb}, ${v})`;
              });
            }}
            style={{ width: '100px', accentColor: 'var(--accent)' }} />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', minWidth: '2.5rem', textAlign: 'right' }}>
            {Math.round(parseFloat(currentWinOpacity) * 100)}%
          </span>
        </div>
      </div>
      <div className="st-row">
        <div>
          <div className="st-label">Panel Opacity</div>
          <div className="st-desc">Transparency of taskbar, start menu, and panels</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input type="range" min="0.2" max="0.95" step="0.05" defaultValue={localStorage.getItem('cb-panel-opacity') || '0.85'}
            onChange={(e) => {
              const v = e.target.value;
              localStorage.setItem('cb-panel-opacity', v);
              document.documentElement.style.setProperty('--panel-opacity', v);
              (e.target.nextElementSibling as HTMLElement).textContent = Math.round(parseFloat(v) * 100) + '%';
            }}
            style={{ width: '100px', accentColor: 'var(--accent)' }} />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', minWidth: '2.5rem', textAlign: 'right' }}>
            {Math.round(parseFloat(localStorage.getItem('cb-panel-opacity') || '0.85') * 100)}%
          </span>
        </div>
      </div>
      <div className="st-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.4rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="st-label"><Image size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Wallpaper</div>
            <div className="st-desc">Desktop background</div>
          </div>
          <button className="fm-btn" onClick={openPicker}>Choose Wallpaper</button>
        </div>
        <div className="wp-inline-grid">
          {WALLPAPERS.filter((w) => w.type === 'color').slice(0, 10).map((w) => (
            <button key={w.id} className={`wp-swatch ${currentWp === w.id ? 'wp-swatch-active' : ''} ${w.theme === 'light' ? 'wp-swatch-light' : ''}`}
              title={w.name} style={{ background: w.value }}
              onClick={() => selectWp(w.id)} />
          ))}
        </div>
        <div className="wp-inline-grid">
          {WALLPAPERS.filter((w) => w.type === 'image').slice(0, 4).map((w) => (
            <button key={w.id} className={`wp-img-btn-sm ${currentWp === w.id ? 'wp-img-active' : ''}`}
              title={w.name}
              style={{ backgroundImage: `url('${w.value}')` }}
              onClick={() => selectWp(w.id)} />
          ))}
        </div>
      </div>

      {/* Widgets section */}
      <div className="st-row" style={{ marginTop: '0.5rem' }}>
        <div>
          <div className="st-label"><LayoutDashboard size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Desktop Widgets</div>
          <div className="st-desc">System monitor widgets with glassmorphism style</div>
        </div>
        <button
          className={`st-toggle ${widgetsOn ? 'on' : 'off'}`}
          onClick={() => {
            const existing = document.getElementById('win-widgets');
            if (existing) {
              useDesktopStore.getState().closeWindow('widgets');
              setWidgetsOn(false);
            } else {
              useDesktopStore.getState().openWindow('widgets', 'Widgets');
              setWidgetsOn(true);
            }
          }}
        />
      </div>
      <div className="st-row">
        <div>
          <div className="st-label" style={{ fontSize: '0.7rem' }}>Widget Opacity</div>
          <div className="st-desc">Glassmorphism transparency level</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input type="range" min="0" max="90" defaultValue={Math.round((parseFloat(localStorage.getItem('cb-widget-opacity') || '0.55') - 0.1) * 100)}
            onChange={(e) => {
              const v = parseFloat(e.target.value) / 100 + 0.1;
              localStorage.setItem('cb-widget-opacity', String(v));
              // Update live if widget is open
              const el = document.querySelector('.wgt-container') as HTMLElement;
              if (el) el.style.opacity = String(v + 0.1);
              (e.target.nextElementSibling as HTMLElement).textContent = Math.round(v * 100) + '%';
            }}
            style={{ width: '100px', accentColor: 'var(--accent)' }} />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', minWidth: '2.5rem', textAlign: 'right' }}>
            {Math.round(parseFloat(localStorage.getItem('cb-widget-opacity') || '0.55') * 100)}%
          </span>
        </div>
      </div>
    </>
  );
}

function UsersTab() {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editPasswordConfirm, setEditPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [editAvatar, setEditAvatar] = useState('');
  const [editAvatarPreview, setEditAvatarPreview] = useState('');
  const avatarUrlRef = useRef('');
  // Add User modal states
  const [showAddUser, setShowAddUser] = useState(false);
  const [addUsername, setAddUsername] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addAvatarPreview, setAddAvatarPreview] = useState('');
  const addAvatarUrlRef = useRef('');
  const addFmPickId = useRef<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [showAddPassword, setShowAddPassword] = useState(false);
  const addModalRef = useRef<HTMLDivElement>(null);
  const addDragRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);
  const [editRole, setEditRole] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);

  const loadUsers = () => {
    api.get<User[]>('/auth/users').then(setUsers).catch(() => {});
  };
  useEffect(() => { loadUsers(); }, []);
  const { openWindow, closeWindow } = useDesktopStore();
  const fmPickId = useRef<string | null>(null);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (confirmText !== 'delete-account') return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await api.del(`/auth/users/${deleteTarget.id}`);
      if (deleteTarget.id === currentUser?.id) {
        useAuthStore.getState().logout();
        window.location.reload();
        return;
      }
      setDeleteTarget(null);
      setConfirmText('');
      loadUsers();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Failed to delete user');
    } finally {
      setDeleteLoading(false);
    }
  };

  const closeDeleteModal = () => {
    setDeleteTarget(null);
    setConfirmText('');
    setDeleteError('');
  };

  const openEdit = (u: User) => {
    setEditTarget(u);
    setEditName(u.name || '');
    setEditPassword('');
    setEditPasswordConfirm('');
    setShowPassword(false);
    const av = u.avatar || '';
    setEditAvatar(av);
    setEditAvatarPreview(av);
    avatarUrlRef.current = av;
    setEditRole(u.role);
    setEditError('');
    setEditSuccess('');
  };

  const closeAddModal = () => {
    setShowAddUser(false);
    setShowAddPassword(false);
    setAddUsername('');
    setAddEmail('');
    setAddPassword('');
    if (addAvatarPreview && addAvatarPreview.startsWith('blob:')) {
      URL.revokeObjectURL(addAvatarPreview);
    }
    setAddAvatarPreview('');
    addAvatarUrlRef.current = '';
    setAddError('');
    setAddSuccess('');
  };

  const handleAddUser = async () => {
    if (!addUsername || !addEmail || !addPassword) return;
    setAddLoading(true);
    setAddError('');
    setAddSuccess('');
    try {
      const body: Record<string, string> = {
        username: addUsername,
        email: addEmail,
        password: addPassword,
        role: 'user',
      };
      if (addAvatarPreview) {
        body.avatar = addAvatarUrlRef.current;
      }
      await api.post('/auth/users', body);
      setAddSuccess(`User ${addUsername} created successfully`);
      // Don't clear avatar on success so preview stays
      setAddUsername('');
      setAddEmail('');
      setAddPassword('');
      loadUsers();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Failed to create user');
    } finally {
      setAddLoading(false);
    }
  };

  const closeEditModal = () => {
    setEditTarget(null);
    setEditName('');
    setEditPassword('');
    setEditPasswordConfirm('');
    setShowPassword(false);
    if (editAvatarPreview && editAvatarPreview.startsWith('blob:')) {
      URL.revokeObjectURL(editAvatarPreview);
    }
    setEditAvatar('');
    setEditAvatarPreview('');
    avatarUrlRef.current = '';
    setEditRole('');
    setEditError('');
    setEditSuccess('');
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    if (editPassword && editPassword !== editPasswordConfirm) {
      setEditError('Passwords do not match');
      return;
    }
    setEditLoading(true);
    setEditError('');
    setEditSuccess('');
    try {
      const body: Record<string, string> = {};
      if (editName !== (editTarget.name || '')) body.name = editName;
      if (editPassword) body.password = editPassword;
      // Save avatar only if it actually changed
      if (editAvatarPreview && avatarUrlRef.current !== (editTarget.avatar || '')) {
        body.avatar = avatarUrlRef.current;
      } else if (editTarget.avatar && !editAvatarPreview) {
        // User removed avatar → clear it
        body.avatar = '';
      }
      if (editRole !== editTarget.role) body.role = editRole;
      if (Object.keys(body).length === 0) {
        setEditError('No changes to save');
        setEditLoading(false);
        return;
      }
      await api.patch(`/auth/users/${editTarget.id}`, body);
      setEditSuccess('User updated successfully');
      loadUsers();
      if (editTarget.id === currentUser?.id) {
        useAuthStore.getState().checkAuth();
      }
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Failed to update user');
    } finally {
      setEditLoading(false);
    }
  };

  // Center edit modal on mount
  useEffect(() => {
    if (!editTarget || !editModalRef.current) return;
    const el = editModalRef.current;
    requestAnimationFrame(() => {
      const w = el.offsetWidth || 580;
      const h = el.offsetHeight || 400;
      const maxLeft = window.innerWidth - w - 20;
      const maxTop = window.innerHeight - h - 20;
      el.style.left = Math.min(maxLeft, Math.max(20, (window.innerWidth - w) / 2)) + 'px';
      el.style.top = Math.min(maxTop, Math.max(20, (window.innerHeight - h) / 2)) + 'px';
    });
  }, [editTarget]);

  // Center add modal on mount
  useEffect(() => {
    if (!showAddUser || !addModalRef.current) return;
    const el = addModalRef.current;
    requestAnimationFrame(() => {
      const w = el.offsetWidth || 580;
      const h = el.offsetHeight || 400;
      const maxLeft = window.innerWidth - w - 20;
      const maxTop = window.innerHeight - h - 20;
      el.style.left = Math.min(maxLeft, Math.max(20, (window.innerWidth - w) / 2)) + 'px';
      el.style.top = Math.min(maxTop, Math.max(20, (window.innerHeight - h) / 2)) + 'px';
    });
  }, [showAddUser]);

  // Listen for file picked from FileManager (handles both edit and add modes)
  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.path) return;
      const rawPath = `/api/v1/files/raw?path=${encodeURIComponent(detail.path)}`;
      const fullUrl = window.location.origin + rawPath;

      // Add mode
      if (addFmPickId.current) {
        addAvatarUrlRef.current = fullUrl;
        try {
          const token = getToken() || '';
          const headers: Record<string, string> = {};
          if (token) headers['Authorization'] = `Bearer ${token}`;
          const res = await fetch(rawPath, { headers });
          if (res.ok) {
            const blob = await res.blob();
            setAddAvatarPreview(URL.createObjectURL(blob));
          }
          // If fetch fails, keep existing preview
        } catch {
          // Keep existing preview on error
        }
        closeWindow(addFmPickId.current);
        addFmPickId.current = null;
        return;
      }

      // Edit mode
      if (fmPickId.current) {
        avatarUrlRef.current = fullUrl;
        try {
          const token = getToken() || '';
          const headers: Record<string, string> = {};
          if (token) headers['Authorization'] = `Bearer ${token}`;
          const res = await fetch(rawPath, { headers });
          if (res.ok) {
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            setEditAvatarPreview(blobUrl);
            setEditAvatar(blobUrl); // enable Remove button
          }
          // If fetch fails, keep existing preview (don't fallback to fullUrl — it can't auth)
        } catch {
          // Keep existing preview on error
        }
        closeWindow(fmPickId.current);
        fmPickId.current = null;
      }
    };
    document.addEventListener('fm-file-picked', handler);
    return () => document.removeEventListener('fm-file-picked', handler);
  }, []);

  const editModalRef = useRef<HTMLDivElement>(null);

  // Draggable handler for Add modal
  const startAddDrag = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (!t.closest('.edit-user-header') || t.closest('.edit-user-actions')) return;
    const el = addModalRef.current;
    if (!el) return;
    el.classList.add('edit-dragging');
    const rect = el.getBoundingClientRect();
    addDragRef.current = { startX: e.clientX, startY: e.clientY, posX: rect.left, posY: rect.top };
    const onMove = (ev: MouseEvent) => {
      if (!addDragRef.current) return;
      el.style.left = (addDragRef.current.posX + ev.clientX - addDragRef.current.startX) + 'px';
      el.style.top = (addDragRef.current.posY + ev.clientY - addDragRef.current.startY) + 'px';
    };
    const onUp = () => {
      addDragRef.current = null;
      el.classList.remove('edit-dragging');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Draggable handlers — direct DOM manipulation for smoothness
  const startDrag = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (!t.closest('.edit-user-header') || t.closest('.edit-user-actions')) return;
    const el = editModalRef.current;
    if (!el) return;
    el.classList.add('edit-dragging');
    const rect = el.getBoundingClientRect();
    dragRef.current = { startX: e.clientX, startY: e.clientY, posX: rect.left, posY: rect.top };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      el.style.left = (dragRef.current.posX + ev.clientX - dragRef.current.startX) + 'px';
      el.style.top = (dragRef.current.posY + ev.clientY - dragRef.current.startY) + 'px';
    };
    const onUp = () => {
      dragRef.current = null;
      el.classList.remove('edit-dragging');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <div>
          <h3>Users</h3>
          <p>Manage system users</p>
        </div>
        <button className="fm-btn" onClick={() => setShowAddUser(true)}>
          <UserPlus size={13} /> Add User
        </button>
      </div>
      <div>
        {users.map((u) => (
          <div key={u.id} className="user-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: u.avatar ? `url(/api/v1/auth/avatar/${u.id}) center/cover` : 'var(--accent-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent)',
                flexShrink: 0,
              }}>
                {!u.avatar && (u.name || u.username)[0].toUpperCase()}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.75rem' }}>{u.name || u.username}</span>
                  <span className={`badge badge-${u.role}`} style={{ fontSize: '0.55rem' }}>{u.role}</span>
                  {u.id === currentUser?.id && (
                    <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>(you)</span>
                  )}
                </div>
                <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)' }}>@{u.username} &middot; {u.email}</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <button
                className="fm-btn small"
                onClick={() => openEdit(u)}
                title="Edit user">
                <Pencil size={11} />
              </button>
              <button
                className="fm-btn small"
                style={{ color: 'var(--danger)', borderColor: 'rgba(217,48,37,0.2)' }}
                onClick={() => setDeleteTarget(u)}
                title={u.id === currentUser?.id ? 'Delete your account' : 'Delete user'}>
                <Trash2 size={11} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={closeDeleteModal}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(217,48,37,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <AlertTriangle size={20} style={{ color: 'var(--danger)' }} />
              </div>
              <div>
                <div className="modal-title" style={{ fontSize: '0.85rem' }}>Delete User</div>
                <div className="modal-desc" style={{ fontSize: '0.68rem', marginBottom: 0 }}>
                  {deleteTarget.id === currentUser?.id
                    ? 'You are about to delete your own account.'
                    : `You are about to delete "${deleteTarget.username}".`}
                </div>
              </div>
              <button onClick={closeDeleteModal} style={{
                marginLeft: 'auto', background: 'none', border: 'none',
                color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem',
              }}>
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
              This action <strong>cannot be undone</strong>. The user account and all associated data will be permanently removed.
            </p>

            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Type <strong style={{ color: 'var(--danger)', fontFamily: 'monospace' }}>delete-account</strong> to confirm:
            </p>
            <input
              className="modal-input"
              type="text"
              placeholder="type delete-account"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoFocus
            />

            {deleteError && (
              <div className="msg error" style={{ fontSize: '0.7rem', marginBottom: '0.5rem' }}>{deleteError}</div>
            )}

            <div className="modal-actions">
              <button className="modal-btn modal-btn-cancel" onClick={closeDeleteModal}>
                Cancel
              </button>
              <button
                className="modal-btn modal-btn-danger"
                disabled={confirmText !== 'delete-account' || deleteLoading}
                onClick={handleDelete}>
                {deleteLoading ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal — Draggable OS-style Dialog */}
      {showAddUser && (
        <div className="edit-overlay">
          <div ref={addModalRef} className="edit-user-modal" onClick={(e) => e.stopPropagation()}
            onMouseDown={startAddDrag}>
            {/* Header — drag handle with traffic light window controls */}
            <div className="edit-user-header" style={{ cursor: 'grab' }}>
              <div className="edit-user-actions">
                <button className="win-btn win-close" onClick={closeAddModal} onMouseDown={(e) => e.stopPropagation()}>
                  <X size={13} />
                </button>
                <button className="win-btn win-min" tabIndex={-1} type="button" style={{ cursor: 'default' }}>
                  <Minus size={13} />
                </button>
                <button className="win-btn win-max" tabIndex={-1} type="button" style={{ cursor: 'default' }}>
                  <Minus size={13} style={{ transform: 'rotate(90deg)' }} />
                </button>
              </div>
              <div className="edit-user-title-wrap">
                <div className="edit-user-title">Add User</div>
                <div className="edit-user-subtitle">Create a new system user account</div>
              </div>
            </div>

            {/* Body */}
            <div className="edit-user-body">
              <div className="edit-user-left">
                <div className="edit-field">
                  <label>Username</label>
                  <input className="modal-input" type="text" placeholder="Enter username"
                    value={addUsername} onChange={(e) => { setAddUsername(e.target.value); setAddSuccess(''); }} />
                </div>
                <div className="edit-field">
                  <label>Email</label>
                  <input className="modal-input" type="email" placeholder="Enter email"
                    value={addEmail} onChange={(e) => { setAddEmail(e.target.value); setAddSuccess(''); }} />
                </div>
                <div className="edit-field">
                  <label>Password</label>
                  <div className="edit-password-wrap">
                    <input className="modal-input" type={showAddPassword ? 'text' : 'password'} placeholder="Enter password"
                      value={addPassword} onChange={(e) => { setAddPassword(e.target.value); setAddSuccess(''); }} />
                    <button className="edit-password-toggle" onClick={() => setShowAddPassword(!showAddPassword)}
                      tabIndex={-1} type="button">
                      {showAddPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="edit-user-divider" />

              <div className="edit-user-right">
                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                  Avatar
                </label>
                <div className="edit-avatar-preview">
                  {addAvatarPreview ? (
                    <img src={addAvatarPreview} alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  ) : (
                    <div className="edit-avatar-placeholder">
                      <Image size={28} />
                      <span>No avatar</span>
                    </div>
                  )}
                </div>
                <button className="fm-btn" style={{ width: '100%', justifyContent: 'center', marginTop: '0.35rem' }}
                  onClick={() => {
                    const id = 'fm-add-pick-' + Date.now();
                    addFmPickId.current = id;
                    openWindow(id, 'Select Avatar', { pickMode: true });
                  }}>
                  <Image size={12} /> Browse Files
                </button>
                {addAvatarPreview && (
                  <button className="fm-btn small" style={{ width: '100%', justifyContent: 'center', marginTop: '0.2rem', color: 'var(--danger)', borderColor: 'rgba(217,48,37,0.2)' }}
                    onClick={() => {
                      if (addAvatarPreview && addAvatarPreview.startsWith('blob:')) {
                        URL.revokeObjectURL(addAvatarPreview);
                      }
                      setAddAvatarPreview('');
                      addAvatarUrlRef.current = '';
                    }}>
                    Remove Avatar
                  </button>
                )}
              </div>
            </div>

            {addError && (
              <div className="msg error" style={{ fontSize: '0.7rem', margin: '0 1rem 0.5rem' }}>{addError}</div>
            )}
            {addSuccess && (
              <div className="msg success" style={{ fontSize: '0.7rem', margin: '0 1rem 0.5rem' }}>{addSuccess}</div>
            )}

            <div className="edit-user-footer">
              <button className="modal-btn modal-btn-cancel" onClick={closeAddModal}>{addSuccess ? 'Close' : 'Cancel'}</button>
              <button className="modal-btn modal-btn-primary" onClick={handleAddUser}
                disabled={addLoading || !addUsername || !addEmail || !addPassword}>
                {addLoading ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal — Draggable OS-style Dialog */}
      {editTarget && (
        <div className="edit-overlay">
          <div ref={editModalRef} className="edit-user-modal" onClick={(e) => e.stopPropagation()}
            onMouseDown={startDrag}>
            {/* Header — drag handle with traffic light window controls */}
            <div className="edit-user-header" style={{ cursor: 'grab' }}>
              <div className="edit-user-actions">
                <button className="win-btn win-close" onClick={closeEditModal} onMouseDown={(e) => e.stopPropagation()}>
                  <X size={13} />
                </button>
                <button className="win-btn win-min" tabIndex={-1} type="button" style={{ cursor: 'default' }}>
                  <Minus size={13} />
                </button>
                <button className="win-btn win-max" tabIndex={-1} type="button" style={{ cursor: 'default' }}>
                  <Minus size={13} style={{ transform: 'rotate(90deg)' }} />
                </button>
              </div>
              <div className="edit-user-title-wrap">
                <div className="edit-user-title">{editTarget.username}</div>
                <div className="edit-user-subtitle">{editTarget.email}</div>
              </div>
            </div>

            {/* Body */}
            <div className="edit-user-body">
              <div className="edit-user-left">
                <div className="edit-field">
                  <label>Display Name</label>
                  <input className="modal-input" type="text" placeholder="Full name"
                    value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>

                <div className="edit-field">
                  <label>New Password</label>
                  <div className="edit-password-wrap">
                    <input className="modal-input" type={showPassword ? 'text' : 'password'}
                      placeholder="Leave blank to keep current"
                      value={editPassword} onChange={(e) => setEditPassword(e.target.value)} />
                    <button className="edit-password-toggle" onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1} type="button">
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div className="edit-field">
                  <label>Confirm Password</label>
                  <div className="edit-password-wrap">
                    <input className="modal-input" type={showPassword ? 'text' : 'password'}
                      placeholder="Re-type new password"
                      value={editPasswordConfirm} onChange={(e) => setEditPasswordConfirm(e.target.value)}
                      style={editPasswordConfirm && editPassword !== editPasswordConfirm
                        ? { borderColor: 'var(--danger)' } : {}} />
                    <button className="edit-password-toggle" onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1} type="button">
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {editPasswordConfirm && editPassword !== editPasswordConfirm && (
                    <span className="edit-field-hint" style={{ color: 'var(--danger)' }}>Passwords do not match</span>
                  )}
                </div>

                {editTarget.role !== 'admin' && (
                  <div className="edit-field" style={{ marginTop: '0.75rem' }}>
                    <label className="edit-checkbox-label">
                      <input type="checkbox" checked={editRole === 'admin'}
                        onChange={(e) => setEditRole(e.target.checked ? 'admin' : 'user')}
                        style={{ accentColor: 'var(--accent)' }} />
                      <span>Promote to Administrator</span>
                    </label>
                    <div className="edit-field-hint" style={{ paddingLeft: '1.3rem' }}>
                      Grants full system access including user management, package management, and terminal access.
                    </div>
                  </div>
                )}
              </div>

              <div className="edit-user-divider" />

              <div className="edit-user-right">
                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                  Avatar
                </label>
                <div className="edit-avatar-preview">
                  {editAvatarPreview ? (
                    <img src={editAvatarPreview} alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  ) : (
                    <div className="edit-avatar-placeholder">
                      <Image size={28} />
                      <span>No avatar</span>
                    </div>
                  )}
                </div>
                <button className="fm-btn" style={{ width: '100%', justifyContent: 'center', marginTop: '0.35rem' }}
                  onClick={() => {
                    const id = 'fm-pick-' + Date.now();
                    fmPickId.current = id;
                    openWindow(id, 'Select Avatar', { pickMode: true });
                  }}>
                  <Image size={12} /> Browse Files
                </button>
                {editAvatar && (
                  <button className="fm-btn small" style={{ width: '100%', justifyContent: 'center', marginTop: '0.2rem', color: 'var(--danger)', borderColor: 'rgba(217,48,37,0.2)' }}
                    onClick={() => {
                      if (editAvatarPreview && editAvatarPreview.startsWith('blob:')) {
                        URL.revokeObjectURL(editAvatarPreview);
                      }
                      setEditAvatar('');
                      setEditAvatarPreview('');
                      avatarUrlRef.current = '';
                    }}>
                    Remove Avatar
                  </button>
                )}
              </div>
            </div>

            {editError && (
              <div className="msg error" style={{ fontSize: '0.7rem', margin: '0 1rem 0.5rem' }}>{editError}</div>
            )}
            {editSuccess && (
              <div className="msg success" style={{ fontSize: '0.7rem', margin: '0 1rem 0.5rem' }}>{editSuccess}</div>
            )}

            <div className="edit-user-footer">
              <button className="modal-btn modal-btn-cancel" onClick={closeEditModal}>{editSuccess ? 'Close' : 'Cancel'}</button>
              <button className="modal-btn modal-btn-primary" onClick={handleEdit} disabled={editLoading}>
                {editLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.35rem',
      padding: '0.5rem 0 0.35rem',
      fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.04em',
      color: 'var(--text-secondary)',
    }}>
      <span style={{ color: 'var(--accent)', display: 'flex' }}>{icon}</span>
      {label}
    </div>
  );
}

function InfoRow({ label, value, compact }: { label: string; value: string; compact?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      padding: compact ? '0.25rem 0' : '0.35rem 0',
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 500, paddingRight: '0.5rem' }}>{label}</span>
      <span style={{
        fontSize: '0.7rem', color: 'var(--text-primary)', fontWeight: 600,
        textAlign: 'right', maxWidth: '60%', wordBreak: 'break-all',
      }}>{value}</span>
    </div>
  );
}

function AboutTab() {
  const [info, setInfo] = useState<any>(null);
  const [lastAccess, setLastAccess] = useState<any>(null);
  useEffect(() => {
    api.get('/system/info').then(setInfo).catch(() => {});
    api.get('/auth/last-access').then(setLastAccess).catch(() => {});
  }, []);

  const fmtUptime = (s: number) => {
    const d = Math.floor(s / 86400);
    if (d > 0) return `${d}d ${Math.floor((s % 86400) / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
    const h = Math.floor(s / 3600);
    if (h > 0) return `${h}h ${Math.floor((s % 3600) / 60)}m ${s % 60}s`;
    const m = Math.floor(s / 60);
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
  };

  if (!info) {
    return (
      <div style={{ paddingTop: '0.25rem' }}>
        <div style={{ textAlign: 'center', padding: '0.75rem 0 1rem' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'var(--accent-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 0.6rem',
          }}>
            <Monitor size={30} style={{ color: 'var(--accent)' }} />
          </div>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>CloudBanana DE</h3>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Lightweight VPS Desktop Environment</p>
          <a href="https://cloudbanana.de" target="_blank" rel="noopener noreferrer"
            style={{ fontSize: '0.68rem', color: 'var(--accent)', textDecoration: 'none', display: 'inline-block', marginTop: '0.25rem' }}>
            cloudbanana.de ↗
          </a>
        </div>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.72rem', padding: '1rem' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      {/* Hero Header */}
      <div style={{ textAlign: 'center', padding: '0.75rem 0 0.75rem' }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: 'var(--accent-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 0.5rem',
          transition: 'transform 0.2s',
        }}>
          <Monitor size={28} style={{ color: 'var(--accent)' }} />
        </div>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>CloudBanana DE</h3>
        <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0.25rem' }}>Lightweight VPS Desktop Environment</p>
        <div style={{ fontSize: '0.65rem', color: 'var(--accent)' }}>v{info.version || '-'}</div>
        <a href="https://cloudbanana.de" target="_blank" rel="noopener noreferrer"
          style={{ fontSize: '0.62rem', color: 'var(--accent)', textDecoration: 'none', display: 'inline-block', marginTop: '0.15rem', opacity: 0.7 }}>
          cloudbanana.de ↗
        </a>
      </div>

      {/* Section 1: Server */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '0.4rem 0.75rem',
      }}>
        <SectionHeader icon={<Globe size={12} />} label="Server" />
        <InfoRow label="Hostname" value={info.hostname || '-'} compact />
        <InfoRow label="IP Address" value={info.ip_address || '-'} compact />
        <InfoRow label="IPv6" value={info.ipv6 || '-'} compact />
        <InfoRow label="Location" value={info.location || '-'} compact />
        <InfoRow label="Hosting" value={info.isp || info.org || '-'} compact />
        <div style={{ padding: '0.25rem 0' }}>
          <InfoRow label="Provider" value={info.provider || '-'} compact />
        </div>
      </div>

      {/* Section 2: Operating System */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '0.4rem 0.75rem',
      }}>
        <SectionHeader icon={<Terminal size={12} />} label="Operating System" />
        <InfoRow label="OS" value={info.os || '-'} compact />
        <InfoRow label="Kernel" value={info.kernel || '-'} compact />
        <InfoRow label="Architecture" value={info.architecture || '-'} compact />
        <div style={{ padding: '0.25rem 0' }}>
          <InfoRow label="Uptime" value={fmtUptime(info.uptime_seconds || 0)} compact />
        </div>
      </div>

      {/* Section 3: Hardware */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '0.4rem 0.75rem',
      }}>
        <SectionHeader icon={<Gauge size={12} />} label="Hardware" />
        <InfoRow label="CPU" value={info.cpu || '-'} compact />
        {info.cpu_model && <InfoRow label="Model" value={info.cpu_model} compact />}
        {info.cpu_freq && <InfoRow label="Frequency" value={info.cpu_freq} compact />}
        <InfoRow label="Load (1/5/15m)" value={`${info.load_1m ?? '-'} / ${info.load_5m ?? '-'} / ${info.load_15m ?? '-'}`} compact />
        <InfoRow label="RAM" value={info.total_ram_mb ? `${info.total_ram_mb} MB (${info.ram_percent}% used)` : '-'} compact />
        <div style={{ padding: '0.25rem 0' }}>
          <InfoRow label="Swap" value={info.swap_total_mb ? `${info.swap_total_mb} MB` : '-'} compact />
        </div>
      </div>

      {/* Section 4: Storage & Network */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '0.4rem 0.75rem',
      }}>
        <SectionHeader icon={<Monitor size={12} />} label="Storage & Network" />
        <InfoRow label="Disk (/)" value={info.disk_total_gb ? `${info.disk_total_gb} GB (${info.disk_percent}% used)` : '-'} compact />
        <InfoRow label="Network Sent" value={info.net_bytes_sent_gb ? `${info.net_bytes_sent_gb} GB` : '-'} compact />
        <InfoRow label="Network Received" value={info.net_bytes_recv_gb ? `${info.net_bytes_recv_gb} GB` : '-'} compact />
        <div style={{ padding: '0.25rem 0' }}>
          <InfoRow label="Processes" value={`${info.processes ?? '-'} running`} compact />
        </div>
      </div>

      {/* Last Access Section */}
      {lastAccess && lastAccess.timestamp && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '0.4rem 0.75rem',
        }}>
          <SectionHeader icon={<Shield size={12} />} label="Last Access" />
          <InfoRow label="IP Address" value={lastAccess.ip || '-'} compact />
          {lastAccess.location && <InfoRow label="Location" value={lastAccess.location} compact />}
          <InfoRow label="Browser" value={lastAccess.browser || '-'} compact />
          <div style={{ padding: '0.25rem 0' }}>
            <InfoRow label="Time" value={new Date(lastAccess.timestamp).toLocaleString()} compact />
          </div>
        </div>
      )}
    </div>
  );
}

function SystemTab() {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [output, setOutput] = useState('');
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const outputRef = useRef<HTMLPreElement>(null);

  const handleHardReset = async () => {
    setResetting(true);
    try {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map(k => caches.delete(k)));
    } catch {}
    const cbKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('cb-')) cbKeys.push(key);
    }
    cbKeys.forEach(k => localStorage.removeItem(k));
    sessionStorage.clear();
    window.location.href = '/?_=' + Date.now();
  };

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [output]);

  const startApt = async (action: 'update' | 'upgrade') => {
    if (status === 'running') return;
    setOutput('');
    setStatus('running');
    setShowOutput(true);
    try {
      const data = await api.post<{ task_id: string; status: string }>('/system/apt', { action });
      const tid = data.task_id;
      intervalRef.current = window.setInterval(async () => {
        try {
          const st = await api.get<{ status: string; output: string }>('/system/apt/status/' + tid);
          setOutput(st.output);
          if (st.status === 'done' || st.status === 'error') {
            setStatus(st.status as 'done' | 'error');
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        } catch {
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = null;
          setStatus('error');
        }
      }, 1000);
    } catch (e) {
      setStatus('error');
      setOutput(e instanceof Error ? e.message : 'Request failed');
    }
  };

  const statusColors: Record<string, string> = {
    idle: 'var(--text-muted)',
    running: 'var(--accent)',
    done: '#22c55e',
    error: '#ef4444',
  };

  const statusIcons: Record<string, React.ReactNode> = {
    idle: <RefreshCw size={13} />,
    running: <RefreshCw size={13} className="st-spin" />,
    done: <Check size={13} />,
    error: <AlertTriangle size={13} />,
  };

  return (
    <>
      <h3>System Update</h3>
      <p>Update package lists or upgrade all system packages</p>

      {/* Status badge */}
      {status !== 'idle' && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
          padding: '0.25rem 0.6rem', borderRadius: 'var(--radius-lg)',
          fontSize: '0.68rem', fontWeight: 600,
          background: status === 'running' ? 'var(--accent-light)' : status === 'done' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
          color: statusColors[status],
          marginBottom: '0.5rem',
        }}>
          {statusIcons[status]}
          {status === 'running' ? 'Running...' : status === 'done' ? 'Completed Successfully' : 'Failed'}
        </div>
      )}

      {/* Action buttons */}
      <div style={{
        display: 'flex', gap: '0.5rem', marginBottom: '0.75rem',
        flexWrap: 'wrap',
      }}>
        <button
          className="fm-btn"
          onClick={() => startApt('update')}
          disabled={status === 'running'}
          style={{
            opacity: status === 'running' ? 0.6 : 1,
            transition: 'all 0.2s',
          }}>
          <RefreshCw size={13} className={status === 'running' ? 'st-spin' : ''} />
          Update Package Lists
        </button>
        <button
          className="fm-btn primary"
          onClick={() => startApt('upgrade')}
          disabled={status === 'running'}
          style={{
            opacity: status === 'running' ? 0.6 : 1,
            transition: 'all 0.2s',
          }}>
          <Package size={13} />
          Upgrade All Packages
        </button>
        {status !== 'idle' && showOutput && (
          <button
            className="fm-btn"
            onClick={() => setShowOutput(!showOutput)}
            style={{ fontSize: '0.68rem' }}>
            {showOutput ? <X size={12} /> : <Terminal size={12} />}
            {showOutput ? 'Hide Output' : 'Show Output'}
          </button>
        )}
      </div>

      {/* Terminal output */}
      {showOutput && output && (
        <div style={{
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          marginBottom: '0.75rem',
          animation: 'fadeIn 0.2s ease',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.35rem',
            padding: '0.35rem 0.6rem',
            background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-subtle)',
            fontSize: '0.65rem', fontWeight: 600,
            color: statusColors[status],
          }}>
            <Terminal size={10} />
            <span style={{ flex: 1 }}>
              {status === 'running' ? 'APT Output — Running' :
               status === 'done' ? 'APT Output — Completed' :
               status === 'error' ? 'APT Output — Error' : 'APT Output'}
            </span>
            {status === 'running' && (
              <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>live</span>
            )}
          </div>
          <pre
            ref={outputRef}
            style={{
              margin: 0, padding: '0.6rem',
              fontSize: '0.68rem', lineHeight: 1.5,
              fontFamily: "'Menlo','Monaco','DejaVu Sans Mono',monospace",
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              maxHeight: '300px', overflow: 'auto',
              whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>{output}</pre>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.25rem 0.6rem',
            background: 'var(--bg-surface)',
            borderTop: '1px solid var(--border-subtle)',
            fontSize: '0.6rem',
            color: 'var(--text-muted)',
          }}>
            <span>{output.split('\n').length} lines</span>
            <span>{output.length} characters</span>
          </div>
        </div>
      )}

      {/* Hard Reset */}
      <div style={{
        marginTop: '1.5rem',
        border: '1px solid rgba(217,48,37,0.2)',
        borderRadius: 'var(--radius-lg)',
        padding: '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.35rem' }}>
          <Trash size={14} style={{ color: 'var(--danger)' }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>Hard Reset</span>
        </div>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '0.5rem' }}>
          Clear all cached data (localStorage, API cache) and hard reload the page.
          Useful when the UI behaves unexpectedly after an update.
        </p>
        {!resetConfirm ? (
          <button className="fm-btn" style={{ color: 'var(--danger)', borderColor: 'rgba(217,48,37,0.2)' }}
            onClick={() => setResetConfirm(true)}>
            <RefreshCw size={13} /> Clear Cache & Reload
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--danger)' }}>Are you sure?</span>
            <button className="fm-btn" style={{ color: 'var(--danger)', borderColor: 'rgba(217,48,37,0.2)' }}
              onClick={handleHardReset} disabled={resetting}>
              {resetting ? 'Resetting...' : 'Yes, Reset'}
            </button>
            <button className="fm-btn" onClick={() => setResetConfirm(false)} disabled={resetting}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function SecurityTab() {
  const { user } = useAuthStore();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error'>('success');

  const currentTimeout = localStorage.getItem('cb-session-timeout') || '3600';

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setMsgType('error'); setMsg('All password fields are required'); return;
    }
    if (newPassword !== confirmPassword) {
      setMsgType('error'); setMsg('New passwords do not match'); return;
    }
    if (newPassword.length < 8) {
      setMsgType('error'); setMsg('Password must be at least 8 characters'); return;
    }
    if (!user) return;
    setLoading(true); setMsg('');
    try {
      await api.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setMsgType('success'); setMsg('Password changed successfully');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (e) {
      setMsgType('error'); setMsg(e instanceof Error ? e.message : 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const setSessionTimeout = (val: string) => {
    localStorage.setItem('cb-session-timeout', val);
  };

  const timeoutOptions = [
    { value: '900', label: '15 minutes' },
    { value: '1800', label: '30 minutes' },
    { value: '3600', label: '1 hour' },
    { value: '14400', label: '4 hours' },
    { value: '86400', label: '24 hours' },
    { value: '0', label: 'Never (not recommended)' },
  ];

  return (
    <>
      <h3>Security</h3>
      <p>Manage your password and session preferences</p>

      <div style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '1rem',
        marginBottom: '1rem',
      }}>
        <div className="section-header">
          <Key size={13} /> Change Password
        </div>

        <div className="edit-field">
          <label>Current Password</label>
          <input className="modal-input" type={showPw ? 'text' : 'password'}
            value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
            placeholder="Enter current password" />
        </div>
        <div className="edit-field">
          <label>New Password</label>
          <input className="modal-input" type={showPw ? 'text' : 'password'}
            value={newPassword} onChange={e => setNewPassword(e.target.value)}
            placeholder="Enter new password (min. 8 chars)" />
        </div>
        <div className="edit-field">
          <label>Confirm New Password</label>
          <input className="modal-input" type={showPw ? 'text' : 'password'}
            value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Re-type new password" />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.35rem' }}>
          <button className="fm-btn" onClick={() => setShowPw(!showPw)}>
            {showPw ? <EyeOff size={12} /> : <Eye size={12} />} {showPw ? 'Hide' : 'Show'} Passwords
          </button>
          <button className="fm-btn primary" onClick={handleChangePassword} disabled={loading}>
            {loading ? 'Saving...' : 'Update Password'}
          </button>
        </div>

        {msg && (
          <div className={`msg ${msgType}`} style={{ fontSize: '0.7rem', marginTop: '0.5rem' }}>{msg}</div>
        )}
      </div>

      <div style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '1rem',
        marginBottom: '1rem',
      }}>
        <div className="section-header">
          <Clock size={13} /> Session Timeout
        </div>
        <div className="st-row" style={{ padding: '0.25rem 0' }}>
          <div>
            <div className="st-label">Auto-logout after inactivity</div>
            <div className="st-desc">Automatically log out after a period of inactivity</div>
          </div>
          <select className="st-select" defaultValue={currentTimeout}
            onChange={(e) => setSessionTimeout(e.target.value)}>
            {timeoutOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '1rem',
      }}>
        <div className="section-header">
          <LogIn size={13} /> Current Session
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
          <div><strong style={{ color: 'var(--text-primary)' }}>Logged in as:</strong> {user?.username} ({user?.role})</div>
          <div><strong style={{ color: 'var(--text-primary)' }}>Auth method:</strong> JWT + httpOnly cookie</div>
          <div><strong style={{ color: 'var(--text-primary)' }}>CSRF protection:</strong> Active</div>
          <div><strong style={{ color: 'var(--text-primary)' }}>Rate limiting:</strong> Active (slowapi)</div>
          <div><strong style={{ color: 'var(--text-primary)' }}>Account lockout:</strong> 5 failed attempts = 15 min lockout</div>
          <div><strong style={{ color: 'var(--text-primary)' }}>Audit logging:</strong> All actions tracked</div>
        </div>
      </div>
    </>
  );
}

function LanguageTab() {
  const currentTz = localStorage.getItem('cb-timezone') || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const currentClock = localStorage.getItem('cb-clock-format') || '24h';

  const TIMEZONES = [
    'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'America/Sao_Paulo', 'America/Argentina/Buenos_Aires',
    'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Rome',
    'Europe/Moscow', 'Europe/Istanbul',
    'Asia/Dubai', 'Asia/Kolkata', 'Asia/Bangkok', 'Asia/Singapore', 'Asia/Jakarta',
    'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul',
    'Australia/Sydney', 'Australia/Melbourne',
    'Pacific/Auckland', 'Pacific/Honolulu',
    'Africa/Cairo', 'Africa/Lagos', 'Africa/Johannesburg',
  ];

  const setTimezone = (tz: string) => {
    localStorage.setItem('cb-timezone', tz);
  };

  const setClockFormat = (fmt: string) => {
    localStorage.setItem('cb-clock-format', fmt);
  };

  const now = new Date();
  const fmtTime = (tz: string) => {
    try {
      return now.toLocaleTimeString('en-US', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: currentClock === '12h',
      });
    } catch { return '--:--:--'; }
  };

  const fmtDate = (tz: string) => {
    try {
      return now.toLocaleDateString('en-US', {
        timeZone: tz,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch { return '--'; }
  };

  return (
    <>
      <h3>Language & Regional</h3>
      <p>Configure timezone, clock format, and regional preferences</p>

      <div className="st-row">
        <div>
          <div className="st-label"><Globe size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Timezone</div>
          <div className="st-desc">Affects clock display in taskbar</div>
        </div>
        <select className="st-select" defaultValue={currentTz}
          onChange={(e) => setTimezone(e.target.value)}
          style={{ maxWidth: '200px' }}>
          {TIMEZONES.map(tz => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </div>

      <div className="st-row">
        <div>
          <div className="st-label"><Clock size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Clock Format</div>
          <div className="st-desc">12-hour or 24-hour time display</div>
        </div>
        <div style={{ display: 'flex', gap: '0.3rem' }}>
          <button className={`fm-btn ${currentClock === '24h' ? 'active' : ''}`}
            onClick={() => setClockFormat('24h')}>
            24-Hour
          </button>
          <button className={`fm-btn ${currentClock === '12h' ? 'active' : ''}`}
            onClick={() => setClockFormat('12h')}>
            12-Hour
          </button>
        </div>
      </div>

      <div style={{
        marginTop: '0.75rem',
        padding: '1rem',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        textAlign: 'center',
      }}>
        <div className="section-header" style={{ justifyContent: 'center' }}>
          <Sun size={13} /> Preview
        </div>
        <div style={{ fontSize: '2rem', fontWeight: 300, color: 'var(--text-primary)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
          {fmtTime(currentTz)}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
          {fmtDate(currentTz)}
        </div>
        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
          {currentTz} &middot; {currentClock === '12h' ? '12-hour' : '24-hour'} format
        </div>
      </div>
    </>
  );
}

function ShortcutsTab() {
  const shortcuts = [
    { category: 'Desktop (Global)', keys: [
      { key: 'Ctrl + Shift + T', desc: 'Open Terminal', implemented: true },
      { key: 'Ctrl + Shift + E', desc: 'Open File Manager (home dir)', implemented: true },
      { key: 'Ctrl + Shift + M', desc: 'Open System Monitor', implemented: true },
      { key: 'Ctrl + Shift + S', desc: 'Open Settings', implemented: true },
      { key: 'Escape', desc: 'Close Start Menu', implemented: true },
      { key: 'F11', desc: 'Toggle fullscreen', implemented: true },
      { key: 'Win / Super', desc: 'Open Start Menu', implemented: false },
      { key: 'Alt + Tab', desc: 'Switch windows', implemented: false },
      { key: 'Alt + F4', desc: 'Close window', implemented: false },
    ]},
    { category: 'Terminal', keys: [
      { key: 'Ctrl + C / Ctrl + V', desc: 'Copy / Paste (browser native)' },
      { key: 'Ctrl + L', desc: 'Clear terminal (bash built-in)' },
      { key: 'Ctrl + D', desc: 'Exit shell' },
    ]},
    { category: 'File Manager', keys: [
      { key: 'Ctrl + C / V / X', desc: 'Copy / Paste / Cut (via toolbar)' },
      { key: 'Ctrl + A', desc: 'Select all (browser native)' },
    ]},
    { category: 'Browser (BNote / BWeb)', keys: [
      { key: 'Ctrl + S', desc: 'Save (BNote auto-saves)' },
      { key: 'Ctrl + +/-', desc: 'Zoom in / out (browser native)' },
      { key: 'Ctrl + 0', desc: 'Reset zoom' },
    ]},
  ];

  return (
    <>
      <h3>Keyboard Shortcuts</h3>
      <p>Available keyboard shortcuts across CloudBanana DE</p>

      {shortcuts.map((section) => (
        <div key={section.category} style={{
          marginBottom: '0.75rem',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.5rem 0.75rem',
            background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-subtle)',
            fontSize: '0.7rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}>
            <Keyboard size={13} /> {section.category}
          </div>
          {section.keys.map((k, i) => {
            const impl = (k as any).implemented !== false;
            return (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.35rem 0.75rem',
              borderBottom: i < section.keys.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              fontSize: '0.7rem',
            }}>
              <kbd style={{
                display: 'inline-block',
                padding: '0.15rem 0.45rem',
                fontSize: '0.65rem',
                fontWeight: 600,
                fontFamily: '"Menlo", "Fira Code", monospace',
                color: 'var(--text-primary)',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '5px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                minWidth: '70px',
                textAlign: 'center',
                whiteSpace: 'nowrap',
                opacity: impl ? 1 : 0.5,
              }}>{k.key}</kbd>
              <span style={{ color: impl ? 'var(--text-secondary)' : 'var(--text-muted)', opacity: impl ? 1 : 0.6 }}>
                {k.desc}
                {!impl && <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)', marginLeft: '0.4rem' }}>(coming soon)</span>}
              </span>
            </div>
            );
          })}
        </div>
      ))}
    </>
  );
}

function LogsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const loadLogs = async () => {
    setLoading(true); setError('');
    try {
      const data = await api.get<any[]>('/audit/logs');
      setLogs(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLogs(); }, []);

  const actionColors: Record<string, string> = {
    login_success: '#22c55e', login_failed: '#ef4444', login_locked: '#eab308',
    logout: '#6b7280', register_success: '#22c55e', register_failed: '#ef4444',
    user_created: '#3b82f6', user_deleted: '#ef4444', user_edited: '#a855f7',
    file_read: '#3b82f6', file_write: '#22c55e', file_delete: '#ef4444',
    file_upload: '#22c55e', file_download: '#3b82f6', file_rename: '#a855f7',
    file_copy: '#3b82f6', file_move: '#a855f7', file_trash: '#eab308',
    file_compress: '#22c55e', file_extract: '#22c55e', file_mkdir: '#3b82f6',
    file_link_create: '#a855f7', file_link_update: '#a855f7',
    sql_execute: '#3b82f6', sql_error: '#ef4444',
    app_install: '#3b82f6', app_uninstall: '#ef4444',
    docker_start: '#22c55e', docker_stop: '#ef4444', docker_pull: '#3b82f6',
    docker_rm: '#ef4444', docker_rmi: '#ef4444', docker_prune: '#eab308',
    subdomain_create: '#22c55e', subdomain_delete: '#ef4444', subdomain_update: '#a855f7',
    system_apt: '#3b82f6', package_remove: '#ef4444',
    csrf_failure: '#ef4444',
  };

  const actionLabels: Record<string, string> = {
    login_success: 'Login', login_failed: 'Login Failed', login_locked: 'Locked',
    logout: 'Logout', register_success: 'Registered', register_failed: 'Reg Failed',
    user_created: 'User Created', user_deleted: 'User Deleted', user_edited: 'User Edited',
    file_read: 'File Read', file_write: 'File Write', file_delete: 'File Delete',
    file_upload: 'Upload', file_download: 'Download', file_rename: 'Rename',
    file_copy: 'Copy', file_move: 'Move', file_trash: 'Trash',
    file_compress: 'Compress', file_extract: 'Extract', file_mkdir: 'Mkdir',
    file_link_create: 'Link Created', file_link_update: 'Link Updated',
    sql_execute: 'SQL Exec', sql_error: 'SQL Error',
    app_install: 'App Install', app_uninstall: 'App Remove',
    docker_start: 'Docker Start', docker_stop: 'Docker Stop', docker_pull: 'Docker Pull',
    docker_rm: 'Docker RM', docker_rmi: 'Docker RMI', docker_prune: 'Docker Prune',
    subdomain_create: 'Sub Created', subdomain_delete: 'Sub Deleted', subdomain_update: 'Sub Updated',
    system_apt: 'APT', package_remove: 'Pkg Removed',
    csrf_failure: 'CSRF Fail',
  };

  const filtered = logs.filter(l => {
    if (filter !== 'all' && l.action !== filter) return false;
    if (search && !l.action.toLowerCase().includes(search.toLowerCase()) &&
        !l.username.toLowerCase().includes(search.toLowerCase()) &&
        !(l.detail || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const uniqueActions = [...new Set(logs.map(l => l.action))].sort();

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString();
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <div>
          <h3>Audit Logs</h3>
          <p>Track all system activity and user actions</p>
        </div>
        <button className="fm-btn" onClick={loadLogs} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'st-spin' : ''} /> Refresh
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem', alignItems: 'center' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.25rem',
          flex: 1, background: 'var(--bg-input)',
          border: '1px solid var(--border-input)',
          borderRadius: '6px', padding: '0.2rem 0.45rem',
        }}>
          <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input type="text" placeholder="Search logs..." value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, border: 'none', background: 'transparent',
              color: 'var(--text-primary)', fontSize: '0.7rem',
              outline: 'none', padding: '0.1rem 0',
            }} />
        </div>
        <select className="st-select" value={filter} onChange={e => setFilter(e.target.value)}
          style={{ fontSize: '0.65rem' }}>
          <option value="all">All Actions</option>
          {uniqueActions.map(a => (
            <option key={a} value={a}>{actionLabels[a] || a}</option>
          ))}
        </select>
        <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {filtered.length} / {logs.length}
        </span>
      </div>

      {error && (
        <div className="msg error" style={{ fontSize: '0.7rem', marginBottom: '0.5rem' }}>{error}</div>
      )}

      {loading && logs.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.72rem', padding: '2rem' }}>Loading logs...</p>
      ) : filtered.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.72rem', padding: '2rem' }}>No logs found</p>
      ) : (
        <div style={{
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '80px 1fr 80px 130px',
            gap: '0.2rem',
            padding: '0.3rem 0.5rem',
            fontSize: '0.6rem',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
            background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-subtle)',
          }}>
            <span>Action</span>
            <span>Detail</span>
            <span>User</span>
            <span style={{ textAlign: 'right' }}>Time</span>
          </div>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {filtered.map((log: any) => (
              <div key={log.id} style={{
                display: 'grid',
                gridTemplateColumns: '80px 1fr 80px 130px',
                gap: '0.2rem',
                padding: '0.3rem 0.5rem',
                fontSize: '0.68rem',
                color: 'var(--text-secondary)',
                borderBottom: '1px solid var(--border-subtle)',
                alignItems: 'center',
                transition: 'background 0.05s',
              }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                <span style={{
                  display: 'inline-block',
                  padding: '0.05rem 0.3rem',
                  borderRadius: '3px',
                  fontSize: '0.58rem',
                  fontWeight: 600,
                  background: `${actionColors[log.action] || '#6b7280'}18`,
                  color: actionColors[log.action] || '#6b7280',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {actionLabels[log.action] || log.action}
                </span>
                <span style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: '0.65rem',
                }} title={log.detail || log.action}>
                  {log.detail || '—'}
                </span>
                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{log.username || '—'}</span>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textAlign: 'right' }}>{fmtTime(log.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function LicenseTab() {
  return (
    <div>
      <h3>License</h3>
      <p>This project is open source under the MIT License</p>

      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.5rem 1.25rem',
        marginTop: '0.75rem',
        marginBottom: '1.75rem',
        fontSize: '0.72rem',
        lineHeight: '1.7',
        color: 'var(--text-secondary)',
        fontFamily: '"Menlo", "Fira Code", monospace',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
{`MIT License

Copyright (c) 2026 Ketut Dana

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.`}</div>

      <div style={{
        marginTop: '1rem',
        marginBottom: '1.5rem',
        padding: '0.75rem',
        background: 'var(--bg-surface)',
        borderRadius: 'var(--radius)',
        fontSize: '0.7rem',
        color: 'var(--text-secondary)',
      }}>
        <strong style={{ color: 'var(--text-primary)' }}>CloudBanana DE</strong> — Lightweight VPS Desktop Environment<br />
        Built with React, FastAPI, and ❤️<br />
        &copy; 2026 Ketut Dana. All rights reserved.
      </div>

      <div style={{
        textAlign: 'center',
        padding: '0.5rem 0 1.5rem',
      }}>
        <a href="https://cloudbanana.de" target="_blank" rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--accent)',
            textDecoration: 'none',
            padding: '0.4rem 1rem',
            borderRadius: 'var(--radius)',
            background: 'var(--accent-light)',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'var(--bg-surface-hover)'; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'var(--accent-light)'; }}>
          <Monitor size={14} />
          cloudbanana.de
          <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>↗</span>
        </a>
      </div>
    </div>
  );
}

function ApiResourceTab() {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    auth: true,
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggleSection = (id: string) => {
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {}
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: '0.75rem',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    background: 'var(--bg-card)',
  };

  const sectionHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.6rem 0.75rem',
    cursor: 'pointer',
    background: 'var(--bg-surface)',
    borderBottom: '1px solid var(--border-subtle)',
    userSelect: 'none',
  };

  const methodBadge = (method: string) => {
    const colors: Record<string, { bg: string; color: string }> = {
      GET: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e' },
      POST: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
      PUT: { bg: 'rgba(234,179,8,0.12)', color: '#eab308' },
      PATCH: { bg: 'rgba(168,85,247,0.12)', color: '#a855f7' },
      DELETE: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
      WS: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e' },
      ANY: { bg: 'rgba(107,114,128,0.12)', color: '#6b7280' },
    };
    const c = colors[method] || colors.ANY;
    return (
      <span style={{
        display: 'inline-block',
        padding: '0.1rem 0.45rem',
        borderRadius: '4px',
        fontSize: '0.6rem',
        fontWeight: 700,
        fontFamily: '"Menlo", "Fira Code", monospace',
        background: c.bg,
        color: c.color,
        letterSpacing: '0.02em',
        minWidth: '40px',
        textAlign: 'center',
      }}>{method}</span>
    );
  };

  const endpointRow = (method: string, path: string, desc: string, auth: string = 'User') => {
    const id = `${method}-${path}`;
    return (
      <div key={id} style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.35rem 0.75rem',
        borderBottom: '1px solid var(--border-subtle)',
        fontSize: '0.7rem',
        transition: 'background 0.1s',
      }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
        {methodBadge(method)}
        <code style={{
          fontFamily: '"Menlo", "Fira Code", monospace',
          fontSize: '0.65rem',
          color: 'var(--text-primary)',
          flex: '1',
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>{path}</code>
        <span style={{
          fontSize: '0.62rem',
          color: 'var(--text-secondary)',
          flex: '0 0 auto',
          maxWidth: '180px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>{desc}</span>
        <span style={{
          fontSize: '0.55rem',
          color: 'var(--text-muted)',
          background: 'var(--bg-surface)',
          padding: '0.05rem 0.35rem',
          borderRadius: '4px',
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}>{auth}</span>
        <button
          onClick={() => copyToClipboard(`${method} ${path}`, id)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: copiedId === id ? 'var(--success)' : 'var(--text-muted)',
            padding: '0.15rem',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            transition: 'color 0.15s',
          }}
          title="Copy endpoint">
          {copiedId === id ? <Check size={11} /> : <Copy size={11} />}
        </button>
      </div>
    );
  };

  const sectionHeader = (id: string, label: string, count: number) => (
    <div style={sectionHeaderStyle} onClick={() => toggleSection(id)}>
      {expandedSections[id] ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{label}</span>
      <span style={{
        fontSize: '0.6rem',
        color: 'var(--text-muted)',
        background: 'var(--bg-surface)',
        padding: '0.05rem 0.4rem',
        borderRadius: '8px',
      }}>{count} endpoint{count !== 1 ? 's' : ''}</span>
    </div>
  );

  return (
    <div>
      <h3>API Resource</h3>
      <p>Complete API documentation for CloudBanana DE v0.1.0 &mdash; all endpoints are prefixed with <code style={{ fontSize: '0.65rem', background: 'var(--bg-surface)', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>/api/v1</code></p>

      <div style={sectionStyle}>
        {sectionHeader('auth', 'Authentication', 11)}
        {expandedSections.auth && <>
          {endpointRow('GET', '/auth/check', 'Check if admin exists', 'None')}
          {endpointRow('POST', '/auth/register', 'Register initial admin', 'None')}
          {endpointRow('POST', '/auth/login', 'Login (returns JWT)', 'None')}
          {endpointRow('POST', '/auth/logout', 'Logout & revoke token', 'User')}
          {endpointRow('POST', '/auth/change-password', 'Change own password', 'User')}
          {endpointRow('GET', '/auth/me', 'Get current user profile', 'User')}
          {endpointRow('GET', '/auth/users/public', 'List users for login picker', 'None')}
          {endpointRow('GET', '/auth/users', 'List all users', 'Admin')}
          {endpointRow('POST', '/auth/users', 'Create new user', 'Admin')}
          {endpointRow('PATCH', '/auth/users/{user_id}', 'Update user', 'Admin')}
          {endpointRow('GET', '/auth/avatar/{user_id}', 'Serve user avatar', 'None')}
        </>}
      </div>

      <div style={sectionStyle}>
        {sectionHeader('system', 'System', 5)}
        {expandedSections.system && <>
          {endpointRow('GET', '/system/stats', 'CPU, RAM, disk, network', 'User')}
          {endpointRow('GET', '/system/processes', 'List running processes', 'User')}
          {endpointRow('GET', '/system/info', 'Hostname, IP, OS info', 'User')}
          {endpointRow('GET', '/system/packages', 'List installed apt packages', 'User')}
          {endpointRow('POST', '/system/packages/remove', 'Remove an apt package', 'User')}
        </>}
      </div>

      <div style={sectionStyle}>
        {sectionHeader('apps', 'Software Center', 7)}
        {expandedSections.apps && <>
          {endpointRow('GET', '/apps/status', 'Status of installable apps', 'User')}
          {endpointRow('POST', '/apps/install/{app_id}', 'Install a predefined app', 'User')}
          {endpointRow('GET', '/apps/installed', 'List custom installed apps', 'User')}
          {endpointRow('GET', '/apps/install/status/{task_id}', 'Install task status', 'User')}
          {endpointRow('POST', '/apps/install', 'Install app from Git URL', 'User')}
          {endpointRow('POST', '/apps/install/upload', 'Install from uploaded ZIP', 'User')}
          {endpointRow('DELETE', '/apps/installed/{app_name}', 'Uninstall custom app', 'User')}
        </>}
      </div>

      <div style={sectionStyle}>
        {sectionHeader('files', 'File Manager', 17)}
        {expandedSections.files && <>
          {endpointRow('GET', '/files', 'List directory contents', 'User')}
          {endpointRow('POST', '/files/mkdir', 'Create directory', 'User')}
          {endpointRow('POST', '/files/upload', 'Upload file (multipart)', 'User')}
          {endpointRow('POST', '/files/read', 'Read file content', 'User')}
          {endpointRow('POST', '/files/write', 'Write file content', 'User')}
          {endpointRow('POST', '/files/remove', 'Move to trash / delete', 'User')}
          {endpointRow('POST', '/files/rename', 'Rename file/folder', 'User')}
          {endpointRow('POST', '/files/copy', 'Copy file/folder', 'User')}
          {endpointRow('POST', '/files/move', 'Move file/folder', 'User')}
          {endpointRow('POST', '/files/compress', 'Compress to ZIP', 'User')}
          {endpointRow('POST', '/files/compress-multi', 'Compress multiple items', 'User')}
          {endpointRow('POST', '/files/extract', 'Extract ZIP archive', 'User')}
          {endpointRow('POST', '/files/link', 'Create shareable link', 'User')}
          {endpointRow('PATCH', '/files/link/{file_id}', 'Update file link', 'User')}
          {endpointRow('GET', '/files/raw', 'Download raw file', 'User')}
          {endpointRow('GET', '/files/raw/{file_id}', 'Download by link ID', 'None')}
          {endpointRow('GET', '/files/serve/{path}', 'Serve file for WebView', 'User')}
        </>}
      </div>

      <div style={sectionStyle}>
        {sectionHeader('trash', 'Trash', 2)}
        {expandedSections.trash && <>
          {endpointRow('POST', '/trash/empty', 'Empty trash', 'User')}
          {endpointRow('POST', '/trash/restore', 'Restore from trash', 'User')}
        </>}
      </div>

      <div style={sectionStyle}>
        {sectionHeader('www', 'WWW & Subdomain', 4)}
        {expandedSections.www && <>
          {endpointRow('GET', '/www', 'List /var/www contents', 'User')}
          {endpointRow('POST', '/www', 'Create folder in /var/www', 'User')}
          {endpointRow('POST', '/subdomain', 'Create subdomain vhost', 'User')}
          {endpointRow('POST', '/nginx/test', 'Test nginx configuration', 'User')}
        </>}
      </div>

      <div style={sectionStyle}>
        {sectionHeader('php', 'PHP', 1)}
        {expandedSections.php && <>
          {endpointRow('GET', '/php/versions', 'List PHP versions & config', 'User')}
        </>}
      </div>

      <div style={sectionStyle}>
        {sectionHeader('cron', 'Cron', 2)}
        {expandedSections.cron && <>
          {endpointRow('GET', '/cron', 'Read current crontab', 'User')}
          {endpointRow('POST', '/cron', 'Update crontab', 'User')}
        </>}
      </div>

      <div style={sectionStyle}>
        {sectionHeader('ssl', 'SSL Certificates', 5)}
        {expandedSections.ssl && <>
          {endpointRow('GET', '/ssl/certificates', 'List SSL certificates', 'User')}
          {endpointRow('GET', '/ssl/domains', 'List domains from nginx', 'User')}
          {endpointRow('GET', '/ssl/check-certbot', 'Check if certbot installed', 'User')}
          {endpointRow('POST', '/ssl/install-certbot', 'Install certbot', 'User')}
          {endpointRow('POST', '/ssl/certificate', 'Request SSL certificate', 'User')}
        </>}
      </div>

      <div style={sectionStyle}>
        {sectionHeader('pm2', 'PM2', 2)}
        {expandedSections.pm2 && <>
          {endpointRow('GET', '/pm2/processes', 'List PM2 processes', 'User')}
          {endpointRow('POST', '/pm2/action', 'Start/stop/restart/delete', 'User')}
        </>}
      </div>

      <div style={sectionStyle}>
        {sectionHeader('hosts', 'Hosts', 2)}
        {expandedSections.hosts && <>
          {endpointRow('GET', '/hosts', 'Read /etc/hosts', 'User')}
          {endpointRow('POST', '/hosts', 'Write /etc/hosts', 'User')}
        </>}
      </div>

      <div style={sectionStyle}>
        {sectionHeader('databases', 'Databases', 2)}
        {expandedSections.databases && <>
          {endpointRow('GET', '/databases/servers', 'List DB servers & databases', 'User')}
          {endpointRow('POST', '/databases/query', 'Execute SQL query', 'User')}
        </>}
      </div>

      <div style={sectionStyle}>
        {sectionHeader('sql', 'SQLite Editor', 2)}
        {expandedSections.sql && <>
          {endpointRow('GET', '/sql/tables', 'List tables & schemas', 'User')}
          {endpointRow('POST', '/sql/execute', 'Execute SELECT/PRAGMA', 'User')}
        </>}
      </div>

      <div style={sectionStyle}>
        {sectionHeader('laravel', 'Laravel', 28)}
        {expandedSections.laravel && <>
          {endpointRow('GET', '/laravel/check-composer', 'Check composer installed', 'User')}
          {endpointRow('POST', '/laravel/ensure-php', 'Install PHP + extensions', 'User')}
          {endpointRow('POST', '/laravel/install-composer', 'Install composer', 'User')}
          {endpointRow('POST', '/laravel/clone', 'Clone Laravel from Git', 'User')}
          {endpointRow('POST', '/laravel/upload-zip', 'Upload Laravel ZIP', 'User')}
          {endpointRow('POST', '/laravel/extract', 'Extract uploaded ZIP', 'User')}
          {endpointRow('POST', '/laravel/composer-install', 'Run composer install', 'User')}
          {endpointRow('POST', '/laravel/copy-env', 'Copy .env.example', 'User')}
          {endpointRow('PUT', '/laravel/save-env', 'Save .env content', 'User')}
          {endpointRow('POST', '/laravel/storage-link', 'php artisan storage:link', 'User')}
          {endpointRow('POST', '/laravel/app-key', 'Generate app key', 'User')}
          {endpointRow('POST', '/laravel/migrate', 'Run migrations', 'User')}
          {endpointRow('POST', '/laravel/symlink', 'Create public symlink', 'User')}
          {endpointRow('POST', '/laravel/permissions', 'Fix file permissions', 'User')}
          {endpointRow('POST', '/laravel/assets-build', 'npm/yarn install + build', 'User')}
          {endpointRow('POST', '/laravel/vhost', 'Create nginx vhost', 'User')}
          {endpointRow('GET', '/laravel/projects', 'List Laravel projects', 'User')}
          {endpointRow('POST', '/laravel/env-read', 'Read .env content', 'User')}
          {endpointRow('POST', '/laravel/final-check', 'Project readiness check', 'User')}
          {endpointRow('GET', '/laravel/management', 'Management dashboard data', 'User')}
          {endpointRow('POST', '/laravel/env-write', 'Write .env file', 'User')}
          {endpointRow('GET', '/laravel/php-versions', 'List PHP-FPM versions', 'User')}
          {endpointRow('POST', '/laravel/{name}/migrate', 'Run migrations (named)', 'User')}
          {endpointRow('POST', '/laravel/{name}/rollback', 'Rollback migrations', 'User')}
          {endpointRow('POST', '/laravel/{name}/fresh', 'Fresh migrate + seed', 'User')}
          {endpointRow('POST', '/laravel/{name}/toggle', 'Enable/disable vhost', 'User')}
          {endpointRow('POST', '/laravel/{name}/php-version', 'Change PHP version', 'User')}
          {endpointRow('POST', '/laravel/{name}/domain', 'Change domain/port', 'User')}
        </>}
      </div>

      <div style={sectionStyle}>
        {sectionHeader('server', 'Server', 1)}
        {expandedSections.server && <>
          {endpointRow('GET', '/server/ip', 'Get public IP address', 'User')}
        </>}
      </div>

      <div style={sectionStyle}>
        {sectionHeader('wget', 'HTTP Downloader', 2)}
        {expandedSections.wget && <>
          {endpointRow('POST', '/wget', 'Download URL via wget', 'User')}
          {endpointRow('GET', '/wget/status/{task_id}', 'Download task status', 'User')}
        </>}
      </div>

      <div style={sectionStyle}>
        {sectionHeader('proxy', 'Web Proxy (BananaBrowser)', 2)}
        {expandedSections.proxy && <>
          {endpointRow('GET', '/proxy/view/{path}', 'Proxy GET request', 'User')}
          {endpointRow('POST', '/proxy/view/{path}', 'Proxy POST request', 'User')}
        </>}
      </div>

      <div style={sectionStyle}>
        {sectionHeader('terminal', 'Terminal', 1)}
        {expandedSections.terminal && <>
          {endpointRow('WS', '/terminal/ws', 'WebSocket PTY terminal', 'User')}
        </>}
      </div>

      <div style={sectionStyle}>
        {sectionHeader('audit', 'Audit Logs', 1)}
        {expandedSections.audit && <>
          {endpointRow('GET', '/audit/logs', 'Get audit logs (last 500)', 'Admin')}
        </>}
      </div>

      <div style={sectionStyle}>
        {sectionHeader('settings', 'Settings', 3)}
        {expandedSections.settings && <>
          {endpointRow('GET', '/settings', 'Get all settings', 'User')}
          {endpointRow('POST', '/settings', 'Update settings', 'User')}
          {endpointRow('GET', '/settings/defaults', 'Get default settings', 'User')}
        </>}
      </div>

      <div style={{
        textAlign: 'center',
        padding: '1rem',
        fontSize: '0.65rem',
        color: 'var(--text-muted)',
        borderTop: '1px solid var(--border-subtle)',
        marginTop: '0.5rem',
      }}>
        CloudBanana DE API v0.1.0 &mdash; Base URL: <code style={{ fontSize: '0.62rem', background: 'var(--bg-surface)', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>/api/v1</code>
        &nbsp;&middot;&nbsp; {Object.keys(expandedSections).length} sections &middot; 100 total endpoints
      </div>
    </div>
  );
}

function RateLimitsTab() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error'>('success');

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const [saved, defaults] = await Promise.all([
        api.get<Record<string, string>>('/settings'),
        api.get<Record<string, string>>('/settings/defaults'),
      ]);
      const merged = { ...defaults };
      for (const [k, v] of Object.entries(saved)) {
        if (k in merged) merged[k] = v;
      }
      setSettings(merged);
    } catch { setMsg('Failed to load settings'); setMsgType('error'); }
    setLoading(false);
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const handleSave = async () => {
    setSaving(true); setMsg('');
    try {
      await api.post('/settings', { settings });
      setMsgType('success'); setMsg('Settings saved successfully');
    } catch (e) {
      setMsgType('error'); setMsg(e instanceof Error ? e.message : 'Failed to save');
    }
    setSaving(false);
  };

  const handleReset = async () => {
    setSaving(true); setMsg('');
    try {
      const defaults = await api.get<Record<string, string>>('/settings/defaults');
      await api.post('/settings', { settings: defaults });
      setSettings(defaults);
      setMsgType('success'); setMsg('Settings reset to defaults');
    } catch (e) {
      setMsgType('error'); setMsg(e instanceof Error ? e.message : 'Failed to reset');
    }
    setSaving(false);
  };

  const rateLimitKeys = Object.entries(settings).filter(([k]) => k.startsWith('rate_limit_'));
  const otherKeys = Object.entries(settings).filter(([k]) => !k.startsWith('rate_limit_'));

  const parseRate = (value: string) => {
    const m = value.match(/^(\d+)\/(\w+)$/);
    return m ? { count: m[1], unit: m[2] } : { count: '10', unit: 'minute' };
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>Loading settings...</div>;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div>
          <h3>Rate Limits & Security</h3>
          <p>Configure API rate limits and security parameters</p>
        </div>
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <button className="fm-btn" onClick={handleReset} disabled={saving}>
            <RefreshCw size={12} /> Reset
          </button>
          <button className="fm-btn primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {msg && (
        <div className={`msg ${msgType}`} style={{ fontSize: '0.7rem', marginBottom: '0.5rem' }}>{msg}</div>
      )}

      <div style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '0.75rem',
        marginBottom: '1rem',
      }}>
        <div className="section-header" style={{ marginBottom: '0.5rem' }}>
          <Gauge size={13} /> API Rate Limits
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
          {rateLimitKeys.map(([key, value]) => {
            const { count, unit } = parseRate(value);
            return (
              <div key={key} className="st-row" style={{ padding: '0.25rem 0', minHeight: 'auto' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="st-label" style={{ fontSize: '0.68rem', textTransform: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {key.replace(/^rate_limit_/, '').replace(/_/g, ' ')}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                  <input
                    type="number"
                    min={0}
                    className="st-input"
                    value={count}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '' || !isNaN(Number(v))) {
                        setSettings(prev => ({ ...prev, [key]: `${v}/${unit}` }));
                      }
                    }}
                    style={{ width: '3.5rem', textAlign: 'center', fontSize: '0.7rem' }}
                  />
                  <select
                    className="st-select"
                    value={unit}
                    onChange={(e) => setSettings(prev => ({ ...prev, [key]: `${count}/${e.target.value}` }))}
                    style={{ fontSize: '0.7rem', padding: '0.15rem 0.25rem', width: '5rem' }}
                  >
                    <option value="second">second</option>
                    <option value="minute">minute</option>
                    <option value="hour">hour</option>
                    <option value="day">day</option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '0.75rem',
      }}>
        <div className="section-header" style={{ marginBottom: '0.5rem' }}>
          <Shield size={13} /> Security Parameters
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
          {otherKeys.map(([key, value]) => {
            const unit = key.match(/_(mb|seconds|minutes|hours|days)$/)?.[1];
            const label = key.replace(/_/g, ' ');
            return (
              <div key={key} className="st-row" style={{ padding: '0.25rem 0', minHeight: 'auto' }}>
                <div style={{ flex: 1 }}>
                  <div className="st-label" style={{ fontSize: '0.68rem', textTransform: 'none' }}>
                    {label}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <input
                    className="st-input"
                    type="number"
                    min={0}
                    value={value}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '' || !isNaN(Number(v))) {
                        setSettings(prev => ({ ...prev, [key]: v }));
                      }
                    }}
                    style={{ width: unit ? '4rem' : '8rem', textAlign: 'center', fontSize: '0.7rem' }}
                  />
                  {unit && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{unit}</span>}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.5rem', lineHeight: 1.5 }}>
          <strong>Note:</strong> Changes take effect after server restart.
        </div>
      </div>
    </>
  );
}

export default function Settings() {
  const [tab, setTab] = useState('appearance');

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.tab) setTab(detail.tab);
    };
    document.addEventListener('settings-tab', handler);
    return () => document.removeEventListener('settings-tab', handler);
  }, []);

  const tabs = [
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'system', label: 'System', icon: Monitor },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'language', label: 'Language', icon: Globe },
    { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
    { id: 'logs', label: 'Audit Logs', icon: ScrollText },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'about', label: 'About', icon: Info },
    { id: 'license', label: 'License', icon: Scale },
    { id: 'rate-limits', label: 'Rate Limits', icon: Gauge },
    { id: 'api', label: 'API Resource', icon: BookOpen },
  ];

  return (
    <div className="st-panel">
      <div className="st-sidebar">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} className={`st-sidebtn${tab === id ? ' active' : ''}`}
            onClick={() => setTab(id)}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>
      <div className="st-content">
        {tab === 'appearance' && <AppearanceTab />}
        {tab === 'system' && <SystemTab />}
        {tab === 'security' && <SecurityTab />}
        {tab === 'language' && <LanguageTab />}
        {tab === 'shortcuts' && <ShortcutsTab />}
        {tab === 'logs' && <LogsTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'about' && <AboutTab />}
        {tab === 'license' && <LicenseTab />}
        {tab === 'rate-limits' && <RateLimitsTab />}
        {tab === 'api' && <ApiResourceTab />}
      </div>
    </div>
  );
}

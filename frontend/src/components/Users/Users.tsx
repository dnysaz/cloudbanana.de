import { useState } from 'react';
import { api } from '../../api';
import { UserPlus, Settings, CheckCircle } from 'lucide-react';
import { useDesktopStore } from '../../store/desktopStore';

export default function Users() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [success, setSuccess] = useState(false);
  const { openWindow } = useDesktopStore();

  const addUser = async () => {
    try {
      await api.post('/auth/users', { username, email, password, role: 'user' });
      setMsg(`User ${username} created`);
      setSuccess(true);
      setUsername(''); setEmail(''); setPassword('');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed to create user');
    }
  };

  const openSettingsUsers = () => {
    openWindow('settings', 'Settings');
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent('settings-tab', { detail: { tab: 'users' } }));
    }, 100);
  };

  return (
    <div className="win-content" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: 'var(--accent-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 0.6rem',
        }}>
          <UserPlus size={28} style={{ color: 'var(--accent)' }} />
        </div>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Add User</h3>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
          Create a new system user account
        </p>
      </div>

      <input type="text" placeholder="Username" value={username}
        onChange={(e) => { setUsername(e.target.value); setSuccess(false); }} />
      <input type="email" placeholder="Email" value={email}
        onChange={(e) => { setEmail(e.target.value); setSuccess(false); }} />
      <input type="password" placeholder="Password" value={password}
        onChange={(e) => { setPassword(e.target.value); setSuccess(false); }} />

      <button className="btn" onClick={addUser} disabled={!username || !password}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
        <UserPlus size={14} /> Add User
      </button>

      {msg && (
        <div className={`msg show${success ? '' : ' error'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'center' }}>
          {success ? <CheckCircle size={13} style={{ color: 'var(--success)' }} /> : null}
          {msg}
        </div>
      )}

      {success && (
        <button className="btn" onClick={openSettingsUsers}
          style={{ marginTop: '0.5rem', background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '0.72rem' }}>
          <Settings size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Manage Users in Settings
        </button>
      )}
    </div>
  );
}

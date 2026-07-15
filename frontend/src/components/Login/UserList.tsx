import { useEffect, useState, useRef } from 'react';
import { api } from '../../api';
import { User, AlertCircle } from 'lucide-react';

interface Props {
  onSelectUser: (username: string) => void;
}

export default function UserList({ onSelectUser }: Props) {
  const [users, setUsers] = useState<{ id: number; username: string }[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const retryRef = useRef(0);

  useEffect(() => {
    const fetchUsers = () => {
      api.get<{ id: number; username: string }[]>('/auth/users/public')
        .then((data) => {
          setUsers(data);
          setLoading(false);
        })
        .catch(() => {
          if (retryRef.current < 2) {
            retryRef.current++;
            setTimeout(fetchUsers, 800);
          } else {
            setError(true);
            setLoading(false);
          }
        });
    };
    fetchUsers();
  }, []);

  if (loading) {
    return (
      <div className="login-user-list">
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '0.5rem' }}>
          Loading users...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="login-user-list">
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '0.5rem' }}>
          <AlertCircle size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          Could not load users.
        </p>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="login-user-list">
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '0.5rem' }}>
          No users found.
        </p>
      </div>
    );
  }

  return (
    <div className="login-user-list">
      {users.map((u) => (
        <button key={u.id} className="login-user-btn" onClick={() => onSelectUser(u.username)}>
          <div className="login-user-avatar"><User size={22} /></div>
          <span className="login-user-name">{u.username}</span>
        </button>
      ))}
    </div>
  );
}

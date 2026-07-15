import { useState } from 'react';
import { FolderPlus, File, AlertCircle } from 'lucide-react';

interface Props {
  onClose: () => void;
  onCreate: (name: string, type: 'file' | 'folder') => Promise<void>;
  initialType?: 'file' | 'folder';
}

export default function CreateModal({ onClose, onCreate, initialType = 'folder' }: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'file' | 'folder'>(initialType);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      await onCreate(name.trim(), type);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal-box" style={{ width: 320 }}>
        <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          {type === 'folder' ? <FolderPlus size={16} /> : <File size={16} />}
          New {type === 'folder' ? 'Folder' : 'File'}
        </div>
        <div style={{ margin: '0.75rem 0' }}>
          <div className="form-row">
            <label className="st-label">Name</label>
            <input autoFocus value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder={type === 'folder' ? 'folder name' : 'file name'}
              style={{ width: '100%' }} disabled={busy} />
          </div>
          <div className="form-row" style={{ marginTop: '0.5rem' }}>
            <label className="st-label">Type</label>
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
              <button className={`fm-btn ${type === 'folder' ? 'active' : ''}`}
                onClick={() => !busy && setType('folder')}>
                <FolderPlus size={12} /> Folder
              </button>
              <button className={`fm-btn ${type === 'file' ? 'active' : ''}`}
                onClick={() => !busy && setType('file')}>
                <File size={12} /> File
              </button>
            </div>
          </div>
          {error && (
            <div style={{ marginTop: '0.5rem', padding: '0.35rem 0.5rem', background: 'rgba(217,48,37,0.08)', borderRadius: 'var(--radius)', fontSize: '0.72rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <AlertCircle size={13} />
              {error}
            </div>
          )}
        </div>
        <div className="modal-actions">
          <button className="modal-btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="modal-btn modal-btn-primary" onClick={handleSubmit} disabled={!name.trim() || busy}>
            {busy ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

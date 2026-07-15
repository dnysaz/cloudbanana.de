import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api';
import { Save, Edit3, X, AlertTriangle } from 'lucide-react';

interface Props {
  winId?: string;
  winData?: Record<string, unknown>;
}

export default function HostEditor(_props: Props) {
  const [content, setContent] = useState('');
  const [origContent, setOrigContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'ok' | 'error' | ''; msg: string }>({ type: '', msg: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get<{ content: string }>('/hosts');
      setContent(r.content);
      setOrigContent(r.content);
    } catch (e) {
      setStatus({ type: 'error', msg: e instanceof Error ? e.message : 'Failed to read' });
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await api.post('/hosts', { content });
      setOrigContent(content);
      setStatus({ type: 'ok', msg: 'Saved successfully' });
      setShowSaveModal(false);
      setIsEditing(false);
      setTimeout(() => setStatus({ type: '', msg: '' }), 3000);
    } catch (e) {
      setStatus({ type: 'error', msg: e instanceof Error ? e.message : 'Failed to save' });
    }
    setSaving(false);
  };

  const hasChanges = content !== origContent;

  return (
    <div className="he-root">
      <div className="he-header">
        <div className="he-header-left">
          <span className="he-path">/etc/hosts</span>
          {hasChanges && <span className="he-unsaved">Unsaved changes</span>}
        </div>
        <div className="he-header-right">
          {!isEditing ? (
            <button className="he-btn he-btn-edit" onClick={() => setIsEditing(true)}>
              <Edit3 size={14} /> Edit
            </button>
          ) : (
            <>
              <button className="he-btn he-btn-save" onClick={() => setShowSaveModal(true)} disabled={!hasChanges}>
                <Save size={14} /> Save
              </button>
              <button className="he-btn he-btn-cancel" onClick={() => { setIsEditing(false); setContent(origContent); }}>
                <X size={14} /> Cancel
              </button>
            </>
          )}
        </div>
      </div>
      {status.msg && (
        <div className={`he-status ${status.type}`}>{status.msg}</div>
      )}
      {loading ? (
        <div className="he-loading">Loading...</div>
      ) : (
        <textarea
          className="he-editor"
          value={content}
          onChange={e => setContent(e.target.value)}
          spellCheck={false}
          readOnly={!isEditing}
        />
      )}

      {showSaveModal && (
        <div className="ne-modal-overlay" onClick={() => setShowSaveModal(false)}>
          <div className="ne-modal" onClick={e => e.stopPropagation()}>
            <div className="ne-modal-header">
              <h3><Save size={16} /> Confirm Save</h3>
              <button className="ne-modal-close" onClick={() => setShowSaveModal(false)}><X size={16} /></button>
            </div>
            <div className="ne-modal-body">
              <p className="ne-modal-path">/etc/hosts</p>
              <div className="ne-modal-info">
                <AlertTriangle size={14} />
                <span>Incorrect hosts configuration can break network resolution. Verify your entries before saving.</span>
              </div>
            </div>
            <div className="ne-modal-footer">
              <button className="he-btn he-btn-cancel" onClick={() => setShowSaveModal(false)}>Cancel</button>
              <button className="he-btn he-btn-save" onClick={handleSave} disabled={saving}>
                <Save size={14} /> {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

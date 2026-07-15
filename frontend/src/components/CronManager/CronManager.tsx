import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../api';
import { Save, Edit3, X, AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  winId?: string;
  winData?: Record<string, unknown>;
}

interface CronEntry {
  index: number;
  line: string;
  type: 'job' | 'comment' | 'empty';
}

export default function CronManager(_props: Props) {
  const [entries, setEntries] = useState<CronEntry[]>([]);

  const [content, setContent] = useState('');
  const [origContent, setOrigContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'ok' | 'error' | ''; msg: string }>({ type: '', msg: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup status timeout on unmount
  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get<{ entries: CronEntry[]; raw: string }>('/cron');
      setEntries(r.entries);
      setContent(r.raw);
      setOrigContent(r.raw);
    } catch (e) {
      setStatus({ type: 'error', msg: e instanceof Error ? e.message : 'Failed to load cron' });
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await api.post('/cron', { content });
      setOrigContent(content);
      setStatus({ type: 'ok', msg: 'Crontab updated successfully' });
      setShowSaveModal(false);
      setIsEditing(false);
      load();
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
      statusTimeoutRef.current = setTimeout(() => setStatus({ type: '', msg: '' }), 3000);
    } catch (e) {
      setStatus({ type: 'error', msg: e instanceof Error ? e.message : 'Failed to save' });
    }
    setSaving(false);
  };

  const hasChanges = content !== origContent;

  return (
    <div className="cm-root">
      <div className="cm-header">
        <div className="cm-header-left">
          <span className="cm-title">Crontab</span>
          {hasChanges && <span className="he-unsaved">Unsaved changes</span>}
        </div>
        <div className="cm-header-right">
          <button className="he-btn he-btn-refresh" onClick={load} title="Refresh">
            <RefreshCw size={13} />
          </button>
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

      <div className="cm-info">
        <span>Cron jobs for current user. Each line is a scheduled command.</span>
      </div>

      {status.msg && (
        <div className={`he-status ${status.type}`}>{status.msg}</div>
      )}

      {loading ? (
        <div className="he-loading">Loading...</div>
      ) : entries.length === 0 && !isEditing ? (
        <div className="cm-empty">
          <p>No cron jobs configured.</p>
          <p className="cm-empty-hint">Click "Edit" to add cron jobs.</p>
        </div>
      ) : (
        <textarea
          className="cm-editor"
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
              <p className="ne-modal-path">crontab</p>
              <div className="ne-modal-info">
                <AlertTriangle size={14} />
                <span>Incorrect cron syntax can prevent jobs from running. Verify your entries before saving.</span>
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

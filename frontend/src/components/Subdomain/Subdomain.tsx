import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api';
import { Globe, Plus, Trash2, ExternalLink, RefreshCw, FolderOpen, Edit3 } from 'lucide-react';
import type { SubdomainItem } from '../../types';

export default function Subdomain() {
  const [items, setItems] = useState<SubdomainItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [subdomain, setSubdomain] = useState('');
  const [domain, setDomain] = useState('');
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error'>('success');

  const [deleteTarget, setDeleteTarget] = useState<SubdomainItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [editTarget, setEditTarget] = useState<SubdomainItem | null>(null);
  const [editDir, setEditDir] = useState('');
  const [editEnabled, setEditEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<{ items: SubdomainItem[] }>('/subdomain');
      setItems(data.items);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchList(); }, [fetchList]);

  const create = async () => {
    if (!subdomain.trim() || !domain.trim()) {
      setMsgType('error');
      setMsg('Please fill in both subdomain and domain');
      return;
    }
    try {
      setCreating(true);
      const data = await api.post<{ message: string }>('/subdomain', { subdomain: subdomain.trim(), domain: domain.trim() });
      setMsgType('success');
      setMsg(data.message);
      setSubdomain('');
      setDomain('');
      await fetchList();
    } catch (e) {
      setMsgType('error');
      setMsg(e instanceof Error ? e.message : 'Failed to create subdomain');
    } finally {
      setCreating(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      const data = await api.del<{ message: string }>(`/subdomain/${encodeURIComponent(deleteTarget.subdomain)}/${encodeURIComponent(deleteTarget.domain)}`);
      setMsgType('success');
      setMsg(data.message);
      setDeleteTarget(null);
      await fetchList();
    } catch (e) {
      setMsgType('error');
      setMsg(e instanceof Error ? e.message : 'Failed to delete subdomain');
    } finally {
      setDeleting(false);
    }
  };

  const openEdit = (item: SubdomainItem) => {
    setEditTarget(item);
    setEditDir(item.target_dir);
    setEditEnabled(item.enabled);
  };

  const confirmEdit = async () => {
    if (!editTarget) return;
    try {
      setSaving(true);
      const data = await api.patch<{ message: string }>(
        `/subdomain/${encodeURIComponent(editTarget.subdomain)}/${encodeURIComponent(editTarget.domain)}`,
        { target_dir: editDir, enabled: editEnabled }
      );
      setMsgType('success');
      setMsg(data.message);
      setEditTarget(null);
      await fetchList();
    } catch (e) {
      setMsgType('error');
      setMsg(e instanceof Error ? e.message : 'Failed to update subdomain');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="win-content" style={{ height: '100%', display: 'flex', flexDirection: 'column', maxWidth: '36rem', margin: '0 auto', width: '100%' }}>
        <div className="section-header">
          <Plus size={14} />
          <span>Add New Subdomain</span>
        </div>
        <div className="sd-form">
          <input type="text" placeholder="Subdomain (e.g. api)" value={subdomain}
            onChange={(e) => setSubdomain(e.target.value)} disabled={creating} />
          <input type="text" placeholder="Domain (e.g. example.com)" value={domain}
            onChange={(e) => setDomain(e.target.value)} disabled={creating} />
          <button className="btn" onClick={create} disabled={creating} style={{ width: '100%' }}>
            {creating ? 'Creating\u2026' : <><Globe size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />Create Subdomain</>}
          </button>
        </div>
        <p className="sd-hint">
          Creates an Nginx config for <strong>{subdomain || 'subdomain'}.{domain || 'domain'}</strong>,
          served from <code>/var/www/{subdomain || 'subdomain'}/</code>.
          The target directory is created automatically. Requires root (Nginx reload).
        </p>

        {msg && <div className={`msg ${msgType}`}>{msg}</div>}

        <div className="section-header" style={{ marginTop: '0.8rem' }}>
          <FolderOpen size={14} />
          <span>Existing Subdomains ({items.length})</span>
          <RefreshCw size={12} className="refresh-btn" onClick={fetchList} style={{ cursor: 'pointer', marginLeft: 'auto' }} />
        </div>

        <div className="subdomain-list">
          {loading ? (
            <div className="empty-msg">Loading\u2026</div>
          ) : items.length === 0 ? (
            <div className="empty-msg">No subdomains configured yet. Create one above.</div>
          ) : (
            items.map((item) => (
              <div key={item.name} className="subdomain-row">
                <div className="subdomain-info">
                  <span className="subdomain-status" data-enabled={item.enabled} />
                  <span className="subdomain-name">{item.name}</span>
                  <span className={`subdomain-dir ${item.target_exists ? '' : 'missing'}`}
                    title={item.target_dir}>
                    {item.target_dir}
                  </span>
                </div>
                <div className="subdomain-actions">
                  <a href={`http://${item.name}`} target="_blank" rel="noreferrer"
                    className="subdomain-action" title="Open in new tab">
                    <ExternalLink size={13} />
                  </a>
                  <button className="subdomain-action edit"
                    onClick={() => openEdit(item)}
                    title="Edit subdomain">
                    <Edit3 size={13} />
                  </button>
                  <button className="subdomain-action del"
                    onClick={() => setDeleteTarget(item)}
                    title="Delete subdomain">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setDeleteTarget(null); }}>
          <div className="modal-box" style={{ maxWidth: 380 }}>
            <div className="modal-title">Confirm Delete</div>
            <div className="modal-desc">
              Are you sure you want to delete the subdomain <strong>{deleteTarget.name}</strong>?
              {deleteTarget.target_exists && (
                <p style={{ marginTop: '0.4rem', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  The target directory <code>{deleteTarget.target_dir}</code> will not be removed.
                </p>
              )}
            </div>
            <div className="modal-actions">
              <button className="modal-btn modal-btn-cancel" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
              <button className="modal-btn modal-btn-danger" onClick={confirmDelete} disabled={deleting}>
                {deleting ? 'Deleting\u2026' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editTarget && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setEditTarget(null); }}>
          <div className="modal-box" style={{ maxWidth: 400 }}>
            <div className="modal-title">Edit Subdomain</div>
            <div className="modal-desc">
              <strong>{editTarget.name}</strong>
            </div>

            <div className="edit-field">
              <label>Target Directory</label>
              <input className="modal-input" type="text" value={editDir}
                onChange={(e) => setEditDir(e.target.value)} placeholder="/var/www/example" />
            </div>

            <div className="edit-field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
              <button className={`st-toggle ${editEnabled ? 'on' : 'off'}`}
                onClick={() => setEditEnabled(!editEnabled)}
                aria-label="Toggle subdomain enabled" />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {editEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>

            <div className="modal-actions">
              <button className="modal-btn modal-btn-cancel" onClick={() => setEditTarget(null)} disabled={saving}>Cancel</button>
              <button className="modal-btn modal-btn-primary" onClick={confirmEdit} disabled={saving}>
                {saving ? 'Saving\u2026' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

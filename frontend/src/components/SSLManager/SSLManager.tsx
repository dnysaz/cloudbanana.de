import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api';
import { RefreshCw, Shield, ShieldAlert, Clock, Plus, Download, X, Loader } from 'lucide-react';

interface Props {
  winId?: string;
  winData?: Record<string, unknown>;
}

interface CertInfo {
  domain: string;
  cert_path: string;
  key_path: string;
  source: string;
  subject?: string;
  issuer?: string;
  notbefore?: string;
  notafter?: string;
  expiry?: string;
  days_left?: number;
}

export default function SSLManager(_props: Props) {
  const [certs, setCerts] = useState<CertInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState('');
  const [availableDomains, setAvailableDomains] = useState<string[]>([]);
  const [domainsLoading, setDomainsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [certbotInstalled, setCertbotInstalled] = useState<boolean | null>(null);
  const [installing, setInstalling] = useState(false);

  const checkCertbot = useCallback(async () => {
    try {
      const r = await api.get<{ installed: boolean }>('/ssl/check-certbot');
      setCertbotInstalled(r.installed);
    } catch {
      setCertbotInstalled(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get<{ certificates: CertInfo[] }>('/ssl/certificates');
      setCerts(r.certificates);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); checkCertbot(); }, [load, checkCertbot]);

  const openAddModal = async () => {
    setShowAddModal(true);
    setDomainsLoading(true);
    setResult(null);
    setSelectedDomain('');
    try {
      const r = await api.get<{ domains: string[] }>('/ssl/domains');
      setAvailableDomains(r.domains);
    } catch {
      setAvailableDomains([]);
    }
    setDomainsLoading(false);
  };

  const handleInstallCertbot = async () => {
    setInstalling(true);
    setResult(null);
    try {
      await api.post('/ssl/install-certbot');
      setCertbotInstalled(true);
      setResult({ ok: true, msg: 'Certbot installed successfully' });
    } catch (e) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : 'Installation failed' });
    }
    setInstalling(false);
  };

  const handleRequestCert = async () => {
    if (!selectedDomain) return;
    setSubmitting(true);
    setResult(null);
    try {
      const r = await api.post<{ status: string; message: string }>('/ssl/certificate', { domain: selectedDomain });
      if (r.status === 'ok') {
        setResult({ ok: true, msg: r.message });
        setShowAddModal(false);
        load();
      } else {
        setResult({ ok: false, msg: r.message });
      }
    } catch (e) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : 'Request failed' });
    }
    setSubmitting(false);
  };

  const getStatusColor = (days?: number) => {
    if (!days) return 'var(--text-muted)';
    if (days < 0) return 'var(--danger)';
    if (days < 15) return '#eab308';
    if (days < 30) return '#f97316';
    return 'var(--success)';
  };

  const getStatusLabel = (days?: number) => {
    if (!days) return 'Unknown';
    if (days < 0) return `Expired ${Math.abs(days)}d ago`;
    if (days === 0) return 'Expires today';
    if (days === 1) return 'Expires tomorrow';
    return `${days} days`;
  };

  return (
    <div className="ssl-root">
      <div className="ssl-header">
        <span className="ssl-title">SSL Certificates</span>
        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          {certbotInstalled === false && (
            <button className="he-btn he-btn-edit" onClick={handleInstallCertbot} disabled={installing} style={{ fontSize: '0.65rem' }}>
              {installing ? <Loader size={13} className="spin" /> : <Download size={13} />}
              {installing ? 'Installing...' : 'Install Certbot'}
            </button>
          )}
          <button className="he-btn he-btn-save" onClick={openAddModal} style={{ fontSize: '0.65rem' }}>
            <Plus size={13} /> Add Certificate
          </button>
          <button className="he-btn he-btn-refresh" onClick={load} title="Refresh">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {result && (
        <div className={`he-status ${result.ok ? 'ok' : 'error'}`}>
          {result.msg}
          <button className="he-btn he-btn-refresh" onClick={() => setResult(null)} style={{ marginLeft: 'auto' }}>
            <X size={12} />
          </button>
        </div>
      )}

      {loading ? (
        <div className="he-loading">Loading...</div>
      ) : certs.length === 0 ? (
        <div className="cm-empty" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', color: 'var(--text-muted)', padding: '1rem' }}>
          <p style={{ fontSize: '0.78rem', margin: 0 }}>No SSL certificates found.</p>
          <p className="cm-empty-hint" style={{ fontSize: '0.68rem', opacity: 0.7, margin: 0 }}>Click "Add Certificate" to request a free Let's Encrypt SSL.</p>
        </div>
      ) : (
        <div className="ssl-list">
          {certs.map((cert, i) => (
            <div key={i} className="ssl-card">
              <div className="ssl-card-header" onClick={() => setExpanded(expanded === cert.domain ? null : cert.domain)}>
                <div className="ssl-card-left">
                  {cert.days_left !== undefined && cert.days_left < 15 ? (
                    <ShieldAlert size={18} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                  ) : (
                    <Shield size={18} style={{ color: 'var(--success)', flexShrink: 0 }} />
                  )}
                  <div>
                    <span className="ssl-domain">{cert.domain}</span>
                    <span className="ssl-source">{cert.source}</span>
                  </div>
                </div>
                <div className="ssl-card-right">
                  {cert.days_left !== undefined && (
                    <span className="ssl-expiry" style={{ color: getStatusColor(cert.days_left) }}>
                      <Clock size={12} /> {getStatusLabel(cert.days_left)}
                    </span>
                  )}
                </div>
              </div>
              {expanded === cert.domain && (
                <div className="ssl-card-detail">
                  <div className="ssl-detail-row"><span>Subject</span><span>{cert.subject || '-'}</span></div>
                  <div className="ssl-detail-row"><span>Issuer</span><span>{cert.issuer || '-'}</span></div>
                  <div className="ssl-detail-row"><span>Valid From</span><span>{cert.notbefore || '-'}</span></div>
                  <div className="ssl-detail-row"><span>Valid Until</span><span>{cert.notafter || '-'}</span></div>
                  {cert.cert_path && <div className="ssl-detail-row"><span>Cert Path</span><span className="ssl-path">{cert.cert_path}</span></div>}
                  {cert.key_path && <div className="ssl-detail-row"><span>Key Path</span><span className="ssl-path">{cert.key_path}</span></div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div className="ne-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="ne-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="ne-modal-header">
              <h3><Plus size={16} /> New SSL Certificate</h3>
              <button className="ne-modal-close" onClick={() => setShowAddModal(false)}><X size={16} /></button>
            </div>
            <div className="ne-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem' }}>
              <div className="db-select-group">
                <label className="db-label">Domain</label>
                {domainsLoading ? (
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', padding: '0.3rem 0' }}>Scanning nginx domains...</div>
                ) : availableDomains.length > 0 ? (
                  <select className="db-select" value={selectedDomain} onChange={e => setSelectedDomain(e.target.value)}>
                    <option value="">-- Select domain --</option>
                    {availableDomains.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                ) : (
                  <input className="db-select" type="text" value={selectedDomain} onChange={e => setSelectedDomain(e.target.value)} placeholder="example.com" />
                )}
              </div>
              <div className="ne-modal-info">
                <Shield size={14} />
                <span>Free Let's Encrypt SSL. Port 80 must point to this server.</span>
              </div>
            </div>
            <div className="ne-modal-footer">
              <button className="he-btn he-btn-cancel" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="he-btn he-btn-save" onClick={handleRequestCert} disabled={submitting || !selectedDomain}>
                {submitting ? <Loader size={14} className="spin" /> : <Shield size={14} />}
                {submitting ? 'Requesting...' : 'Request Certificate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
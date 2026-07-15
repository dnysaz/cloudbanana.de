import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { Monitor, User, Mail, Lock, CheckCircle, AlertCircle, Eye, EyeOff, LogIn } from 'lucide-react';

interface Props {
  onRegistered?: () => void;
}

const s: { [key: string]: React.CSSProperties } = {
  wrap: {
    display: 'flex', flexDirection: 'column', gap: '0.6rem',
  },
  header: {
    textAlign: 'center', marginBottom: '0.3rem',
  },
  logo: {
    width: 48, height: 48, borderRadius: 14,
    background: 'rgba(255,255,255,0.08)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 0.5rem',
  },
  title: {
    fontSize: '1.05rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)',
    letterSpacing: '-0.02em',
  },
  desc: {
    fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)',
    marginTop: '0.15rem',
  },
  fieldLabel: {
    display: 'block', fontSize: '0.68rem', fontWeight: 600,
    color: 'rgba(255,255,255,0.5)', marginBottom: '0.2rem',
    textTransform: 'uppercase', letterSpacing: '0.03em',
  },
  inputWrap: {
    position: 'relative' as const,
  },
  inputIcon: {
    position: 'absolute' as const, left: '0.65rem', top: '50%',
    transform: 'translateY(-50%)',
    color: 'rgba(255,255,255,0.25)', pointerEvents: 'none' as const,
    display: 'flex',
  },
  input: {
    width: '100%', display: 'block',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8,
    color: '#fff', fontSize: '0.85rem',
    padding: '0.55rem 0.75rem 0.55rem 2rem',
    transition: 'border-color 0.15s, background 0.15s',
    outline: 'none',
  },
  inputValid: {
    borderColor: 'rgba(34,197,94,0.4)',
  },
  inputCheck: {
    position: 'absolute' as const, right: '0.55rem', top: '50%',
    transform: 'translateY(-50%)',
    color: '#22c55e',
  },
  eyeBtn: {
    position: 'absolute' as const, right: '0.55rem', top: '50%',
    transform: 'translateY(-50%)',
    background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)',
    cursor: 'pointer', padding: '0.2rem', display: 'flex',
    borderRadius: 4, transition: 'color 0.15s',
  },
  reqs: {
    display: 'flex', flexDirection: 'column' as const, gap: '0.15rem',
    marginTop: '0.15rem',
  },
  req: {
    display: 'flex', alignItems: 'center', gap: '0.35rem',
    fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)',
    transition: 'color 0.2s',
  },
  reqMet: {
    color: 'rgba(34,197,94,0.7)',
  },
  reqDot: {
    width: 5, height: 5, borderRadius: '50%',
    background: 'rgba(255,255,255,0.15)',
    transition: 'background 0.2s',
  },
  reqDotMet: {
    background: '#22c55e',
  },
  msg: {
    display: 'flex', alignItems: 'center', gap: '0.35rem',
    padding: '0.4rem 0.6rem', borderRadius: 8, fontSize: '0.72rem',
  },
  msgError: {
    background: 'rgba(239,68,68,0.12)', color: '#ff6b6b',
  },
  msgSuccess: {
    background: 'rgba(34,197,94,0.12)', color: '#4ade80',
  },
  btn: {
    width: '100%', display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: '0.4rem',
    background: 'rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, padding: '0.6rem', fontSize: '0.85rem',
    fontWeight: 600, cursor: 'pointer',
    fontFamily: 'inherit', transition: 'all 0.15s',
  },
  btnReady: {
    background: 'rgba(255,255,255,0.18)',
    color: '#fff', borderColor: 'rgba(255,255,255,0.2)',
  },
  success: {
    textAlign: 'center' as const, padding: '0.5rem 0',
  },
  successIcon: {
    width: 64, height: 64, borderRadius: '50%',
    background: 'rgba(34,197,94,0.15)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 0.75rem',
    color: '#4ade80',
  },
  spinner: {
    display: 'inline-block', width: 14, height: 14,
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff', borderRadius: '50%',
    animation: 'login-spin .6s linear infinite',
    marginRight: '0.3rem',
  },
};

export default function RegisterForm({ onRegistered }: Props) {
  const register = useAuthStore((s) => s.register);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const valid = {
    username: username.length >= 3 && /^[a-zA-Z0-9_]+$/.test(username),
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    password: password.length >= 8,
    confirm: password === confirm && password.length > 0,
  };

  const allValid = valid.username && valid.email && valid.password && valid.confirm;

  const handleSubmit = async () => {
    if (!allValid) return;
    if (password !== confirm) {
      setMsg('Passwords do not match');
      setError(true);
      return;
    }
    setLoading(true);
    setMsg('');
    try {
      await register(username, email, password);
      setMsg('Admin account created successfully!');
      setError(false);
      setSuccess(true);
      setTimeout(() => onRegistered?.(), 2000);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Registration failed');
      setError(true);
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, next?: () => void) => {
    if (e.key === 'Enter') {
      if (next) next();
      else handleSubmit();
    }
  };

  const focusNext = (id: string) => () => document.getElementById(id)?.focus();

  const inputStyle = (v: boolean, val: string): React.CSSProperties => ({
    ...s.input,
    ...(v && val.length > 0 ? s.inputValid : {}),
  });

  if (success) {
    return (
      <div style={s.wrap}>
        <div style={s.success}>
          <div style={s.successIcon}>
            <CheckCircle size={32} />
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
            Setup Complete!
          </div>
          <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', margin: '0.4rem 0 0.25rem', lineHeight: 1.5 }}>
            Admin account <strong style={{ color: 'rgba(255,255,255,0.8)' }}>{username}</strong> has been created.
          </p>
          <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)' }}>
            Redirecting to login...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={s.wrap}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.logo}>
          <Monitor size={22} style={{ color: 'rgba(255,255,255,0.7)' }} />
        </div>
        <div style={s.title}>CloudBanana DE</div>
        <div style={s.desc}>Create the administrator account</div>
      </div>

      {/* Username */}
      <div>
        <label style={s.fieldLabel}>Username</label>
        <div style={s.inputWrap}>
          <span style={s.inputIcon}><User size={14} /></span>
          <input
            type="text" placeholder="e.g. admin"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, focusNext('reg-email'))}
            style={inputStyle(valid.username, username)}
            autoFocus autoComplete="username" id="reg-user"
          />
          {valid.username && username.length > 0 && (
            <span style={s.inputCheck}><CheckCircle size={13} /></span>
          )}
        </div>
      </div>

      {/* Email */}
      <div>
        <label style={s.fieldLabel}>Email</label>
        <div style={s.inputWrap}>
          <span style={s.inputIcon}><Mail size={14} /></span>
          <input
            type="email" placeholder="e.g. admin@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, focusNext('reg-pass'))}
            style={inputStyle(valid.email, email)}
            autoComplete="email" id="reg-email"
          />
          {valid.email && email.length > 0 && (
            <span style={s.inputCheck}><CheckCircle size={13} /></span>
          )}
        </div>
      </div>

      {/* Password */}
      <div>
        <label style={s.fieldLabel}>Password</label>
        <div style={s.inputWrap}>
          <span style={s.inputIcon}><Lock size={14} /></span>
          <input
            type={showPass ? 'text' : 'password'}
            placeholder="Min. 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, focusNext('reg-confirm'))}
            style={inputStyle(valid.password, password)}
            autoComplete="new-password" id="reg-pass"
          />
          {valid.password && password.length > 0 ? (
            <span style={s.inputCheck}><CheckCircle size={13} /></span>
          ) : (
            <button type="button" style={s.eyeBtn}
              onClick={() => setShowPass(!showPass)} tabIndex={-1}>
              {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          )}
        </div>
      </div>

      {/* Confirm Password */}
      <div>
        <label style={s.fieldLabel}>Confirm Password</label>
        <div style={s.inputWrap}>
          <span style={s.inputIcon}><Lock size={14} /></span>
          <input
            type={showConfirm ? 'text' : 'password'}
            placeholder="Repeat password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e)}
            style={{
              ...inputStyle(valid.confirm, confirm),
              ...(confirm.length > 0 && password !== confirm
                ? { borderColor: 'rgba(239,68,68,0.4)' } : {}),
            }}
            autoComplete="new-password" id="reg-confirm"
          />
          {valid.confirm && confirm.length > 0 ? (
            <span style={s.inputCheck}><CheckCircle size={13} /></span>
          ) : (
            <button type="button" style={s.eyeBtn}
              onClick={() => setShowConfirm(!showConfirm)} tabIndex={-1}>
              {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          )}
        </div>
        {confirm.length > 0 && password !== confirm && (
          <div style={{ fontSize: '0.62rem', color: '#ff6b6b', marginTop: '0.1rem' }}>
            Passwords do not match
          </div>
        )}
      </div>

      {/* Password requirements */}
      <div style={s.reqs}>
        {[
          { label: 'At least 8 characters', check: password.length >= 8 },
          { label: 'One uppercase letter', check: /[A-Z]/.test(password) },
          { label: 'One lowercase letter', check: /[a-z]/.test(password) },
          { label: 'One number', check: /[0-9]/.test(password) },
          { label: 'One special character', check: /[!@#$%^&*(),.?":{}|<>_\-+=[\]\\;'\/]/.test(password) },
        ].map((r) => (
          <div key={r.label} style={{ ...s.req, ...(r.check ? s.reqMet : {}) }}>
            <span style={{ ...s.reqDot, ...(r.check ? s.reqDotMet : {}) }} />
            <span>{r.label}</span>
          </div>
        ))}
      </div>

      {/* Message */}
      {msg && (
        <div style={{ ...s.msg, ...(error ? s.msgError : s.msgSuccess) }}>
          {error ? <AlertCircle size={13} /> : <CheckCircle size={13} />}
          <span>{msg}</span>
        </div>
      )}

      {/* Button */}
      <button
        style={{ ...s.btn, ...(allValid ? s.btnReady : {}) }}
        className="reg-submit-btn"
        onClick={handleSubmit}
        disabled={loading || !allValid}
      >
        {loading ? (
          <><span style={s.spinner} /> Creating account...</>
        ) : (
          <><LogIn size={14} /> Create Admin Account</>
        )}
      </button>

      {/* Hover style for active button */}
      <style>{`
        .reg-submit-btn:not(:disabled):hover {
          background: rgba(255,255,255,0.22) !important;
        }
        .reg-submit-btn:disabled {
          cursor: not-allowed !important;
        }
      `}</style>

      {/* Footer */}
      <div style={{ textAlign: 'center', fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)', marginTop: '0.15rem' }}>
        <a href="https://cloudbanana.de" target="_blank" rel="noopener noreferrer"
          style={{ color:'rgba(255,255,255,0.25)', textDecoration:'none' }}>
          cloudbanana.de ↗
        </a>
        &nbsp;&middot;&nbsp;CloudBanana DE v0.1.0
      </div>
    </div>
  );
}

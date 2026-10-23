import React, { useState } from 'react';
import { Lock, Mail, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { saveSession, sessionFrom, type PortalSession } from '../services/session';
import { Button } from './ui';

interface LoginScreenProps {
  onSuccess: (session: PortalSession) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onSuccess }) => {
  const [email, setEmail] = useState('admin@techxpert.in');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }

    try {
      setLoading(true);
      const result = await api.adminLogin(email.trim(), password);
      if (!result?.admin) {
        throw new Error('Login response missing admin profile');
      }
      const session = sessionFrom(result.admin);
      saveSession(session);
      onSuccess(session);
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.panel}>
        <div style={styles.brand}>
          <img src="/images/techxpert-logo.gif" alt="Techxpert" style={styles.logo} />
          <div style={styles.brandSub}>Store portal</div>
        </div>

        <h1 style={styles.heading}>Staff sign-in</h1>
        <p style={styles.copy}>
          Sign in with your store portal login. If you also work in Homecare and have been linked, use your Homecare
          email and password.
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          {error && (
            <div style={styles.errorBox}>
              <AlertCircle size={16} color="var(--danger)" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label style={styles.label}>Work email</label>
            <div style={styles.inputWrap}>
              <Mail size={16} color="var(--text-dim)" />
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
                placeholder="admin@techxpert.in"
                required
              />
            </div>
          </div>

          <div>
            <label style={styles.label}>Password</label>
            <div style={styles.inputWrap}>
              <Lock size={16} color="var(--text-dim)" />
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <Button type="submit" variant="primary" loading={loading} style={{ width: '100%' }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        {import.meta.env.DEV && (
          <p style={styles.devHint}>
            Local seed (opt-in): set <code>ALLOW_DEV_ADMIN=1</code> on the API, then{' '}
            <strong>admin@techxpert.in</strong> / <strong>admin123</strong>. Disabled in production.
          </p>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    background:
      'radial-gradient(ellipse at top left, var(--accent-soft), transparent 45%), var(--bg-app)',
  },
  panel: {
    width: '100%',
    maxWidth: '420px',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-xl)',
    padding: '32px 28px',
    boxShadow: 'var(--shadow-lg)',
  },
  brand: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '10px',
    paddingBottom: '20px',
    marginBottom: '24px',
    borderBottom: '1px solid var(--border-subtle)',
  },
  logo: {
    display: 'block',
    width: '210px',
    maxWidth: '100%',
    height: 'auto',
  },
  brandSub: {
    fontSize: '0.74rem',
    color: 'var(--text-muted)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  heading: {
    margin: '0 0 8px',
    fontSize: '1.35rem',
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    color: 'var(--text-main)',
  },
  copy: {
    margin: '0 0 22px',
    fontSize: '0.84rem',
    color: 'var(--text-muted)',
    lineHeight: 1.5,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  label: {
    display: 'block',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginBottom: '6px',
  },
  inputWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'var(--tint-2)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    padding: '0 12px',
  },
  input: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: 'var(--text-main)',
    fontSize: '0.9rem',
    padding: '12px 0',
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--danger-soft)',
    border: '1px solid var(--danger-border)',
    color: 'var(--danger)',
    fontSize: '0.82rem',
  },
  devHint: {
    marginTop: '18px',
    fontSize: '0.72rem',
    color: 'var(--text-dim)',
    lineHeight: 1.45,
  },
};

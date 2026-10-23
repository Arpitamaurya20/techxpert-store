import React, { useState } from 'react';
import { Lock, Mail, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { saveSession, type PortalSession } from '../services/session';
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
      const session: PortalSession = {
        admin: {
          id: Number(result.admin.id),
          name: result.admin.name,
          email: result.admin.email,
          role: result.admin.role,
          storeRole: result.admin.storeRole ?? null,
          permissions: result.admin.permissions ?? {},
        },
      };
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
          <img
            src="/images/techxpert-logo.gif"
            alt="Techxpert"
            style={styles.logo}
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div>
            <div style={styles.brandTitle}>TECHXPERT</div>
            <div style={styles.brandSub}>Store Admin Portal</div>
          </div>
        </div>

        <h1 style={styles.heading}>Staff sign-in</h1>
        <p style={styles.copy}>
          Authenticate against <code>homecare.admin_users</code>. Session is stored in an HttpOnly
          cookie.
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          {error && (
            <div style={styles.errorBox}>
              <AlertCircle size={16} color="#f43f5e" />
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

        <p style={styles.devHint}>
          Local seed (opt-in): set <code>ALLOW_DEV_ADMIN=1</code> on the API, then{' '}
          <strong>admin@techxpert.in</strong> / <strong>admin123</strong>. Disabled in production.
        </p>
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
      'radial-gradient(ellipse at top left, rgba(249,115,22,0.12), transparent 45%), var(--bg-app)',
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
    alignItems: 'center',
    gap: '12px',
    marginBottom: '28px',
  },
  logo: {
    height: '40px',
    borderRadius: '6px',
    background: '#fff',
    padding: '2px',
  },
  brandTitle: {
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    letterSpacing: '0.04em',
    color: '#fff',
    fontSize: '1.05rem',
  },
  brandSub: {
    fontSize: '0.72rem',
    color: 'var(--brand-orange)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  heading: {
    margin: '0 0 8px',
    fontSize: '1.35rem',
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    color: '#fff',
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
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    padding: '0 12px',
  },
  input: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#fff',
    fontSize: '0.9rem',
    padding: '12px 0',
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    borderRadius: 'var(--radius-md)',
    background: 'rgba(244,63,94,0.1)',
    border: '1px solid rgba(244,63,94,0.35)',
    color: '#fda4af',
    fontSize: '0.82rem',
  },
  devHint: {
    marginTop: '18px',
    fontSize: '0.72rem',
    color: 'var(--text-dim)',
    lineHeight: 1.45,
  },
};

import React, { useEffect, useRef, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { api } from '../services/api';
import { saveSession, sessionFrom, type PortalAdmin, type PortalSession } from '../services/session';
import { Button, Field, FormError, Modal, useToast } from './ui';

/** Same rules as the server (server/src/utils/staffAccounts.ts), so most mistakes show before sending. */
const MIN_LENGTH = 10;
const MAX_LENGTH = 128;

function passwordProblem(next: string, email: string, current: string): string | null {
  if (next.length < MIN_LENGTH) return `Use at least ${MIN_LENGTH} characters.`;
  if (next.length > MAX_LENGTH) return `Use at most ${MAX_LENGTH} characters.`;
  if (!next.trim()) return 'A password of only spaces is not allowed.';
  if (next.trim().toLowerCase() === email.toLowerCase()) return "Don't use your email as your password.";
  if (next === current) return 'Choose a password different from the current one.';
  return null;
}

type Errors = { current?: string; next?: string; confirm?: string; form?: string };

interface ChangePasswordFormProps {
  admin: PortalAdmin;
  /** First sign-in with a temporary password: the current field is labelled as the temporary one. */
  temporary: boolean;
  formId: string;
  onDone: (session: PortalSession) => void;
  onBusy?: (busy: boolean) => void;
}

/** The fields only; the screen or dialog around it supplies the submit button (`form={formId}`). */
const ChangePasswordForm: React.FC<ChangePasswordFormProps> = ({ admin, temporary, formId, onDone, onBusy }) => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Errors>({});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found: Errors = {};
    if (!current) found.current = temporary ? 'Type the temporary password you were given.' : 'Type your current password.';
    const problem = passwordProblem(next, admin.email, current);
    if (problem) found.next = problem;
    else if (confirm !== next) found.confirm = "This doesn't match the new password.";
    setErrors(found);
    if (Object.keys(found).length) return;
    try {
      onBusy?.(true);
      const result = await api.changeOwnPassword(current, next);
      const session = sessionFrom(result.admin);
      saveSession(session);
      onDone(session);
    } catch (err: any) {
      setErrors({ form: err.message || "Couldn't change your password." });
    } finally {
      onBusy?.(false);
    }
  };

  const clear = (key: keyof Errors) => setErrors((prev) => ({ ...prev, [key]: undefined, form: undefined }));

  return (
    <form id={formId} onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <input type="email" autoComplete="username" value={admin.email} readOnly hidden />
      <Field id={`${formId}-current`} label={temporary ? 'Temporary password' : 'Current password'} error={errors.current}>
        <input
          type="password"
          autoComplete="current-password"
          data-autofocus
          value={current}
          onChange={(e) => {
            setCurrent(e.target.value);
            clear('current');
          }}
        />
      </Field>
      <Field
        id={`${formId}-next`}
        label="New password"
        hint={`At least ${MIN_LENGTH} characters. A short sentence is easy to remember and hard to guess.`}
        error={errors.next}
      >
        <input
          type="password"
          autoComplete="new-password"
          maxLength={MAX_LENGTH}
          value={next}
          onChange={(e) => {
            setNext(e.target.value);
            clear('next');
          }}
        />
      </Field>
      <Field id={`${formId}-confirm`} label="New password again" error={errors.confirm}>
        <input
          type="password"
          autoComplete="new-password"
          maxLength={MAX_LENGTH}
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value);
            clear('confirm');
          }}
        />
      </Field>
      {errors.form ? <FormError>{errors.form}</FormError> : null}
    </form>
  );
};

/** Shown instead of the portal until a temporary password is replaced. */
export const ChangePasswordScreen: React.FC<{
  admin: PortalAdmin;
  onDone: (session: PortalSession) => void;
  onLogout: () => void;
}> = ({ admin, onDone, onLogout }) => {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }, []);
  return (
    <div style={styles.page}>
      <div ref={panelRef} style={styles.panel}>
        <div style={styles.brand}>
          <img src="/images/techxpert-logo.gif" alt="Techxpert" style={styles.logo} />
          <div style={styles.brandSub}>Store portal</div>
        </div>
        <h1 style={styles.heading}>Choose your own password</h1>
        <p style={styles.copy}>
          Hi {admin.name}. You signed in with a temporary password. Replace it with one only you know before
          using the portal.
        </p>
        <ChangePasswordForm
          admin={admin}
          temporary
          formId="first-password"
          onBusy={setBusy}
          onDone={(session) => {
            toast.success('Password changed. Welcome to the store portal.');
            onDone(session);
          }}
        />
        <div style={styles.actions}>
          <Button type="submit" form="first-password" variant="primary" loading={busy} style={{ width: '100%' }}>
            Save password and continue
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onLogout} disabled={busy}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
};

/** From the sidebar. Linked people are told to change it in Homecare. */
export const ChangePasswordDialog: React.FC<{
  admin: PortalAdmin;
  isOpen: boolean;
  onClose: () => void;
  onDone: (session: PortalSession) => void;
}> = ({ admin, isOpen, onClose, onDone }) => {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const linked = admin.kind === 'linked';
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Change password"
      subtitle={linked ? undefined : 'Your other signed-in browsers are signed out; this one stays signed in.'}
      maxWidth="460px"
      footer={
        linked ? (
          <Button variant="secondary" size="sm" onClick={onClose} data-autofocus>
            Close
          </Button>
        ) : (
          <>
            <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" form="own-password" variant="primary" size="sm" loading={busy}>
              Change password
            </Button>
          </>
        )
      }
    >
      {linked ? (
        <div style={styles.linkedNote}>
          <KeyRound size={18} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ margin: 0 }}>
            You sign in here with your Homecare login, so your password is managed in Homecare. Change it there; the
            new password works here too.
          </p>
        </div>
      ) : isOpen ? (
        <ChangePasswordForm
          admin={admin}
          temporary={false}
          formId="own-password"
          onBusy={setBusy}
          onDone={(session) => {
            toast.success('Password changed. Your other sessions are signed out.');
            onDone(session);
            onClose();
          }}
        />
      ) : null}
    </Modal>
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
    background: 'radial-gradient(ellipse at top left, var(--accent-soft), transparent 45%), var(--bg-app)',
  },
  panel: {
    width: '100%',
    maxWidth: '440px',
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
  actions: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
    marginTop: '20px',
  },
  linkedNote: {
    display: 'flex',
    gap: '10px',
    fontSize: '0.88rem',
    color: 'var(--text-main)',
    lineHeight: 1.5,
  },
};

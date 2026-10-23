import React, { useRef, useState } from 'react';
import { Copy, Link2, Search, UserPlus } from 'lucide-react';
import { api, type StaffMember } from '../services/api';
import { lastSignIn } from '../services/format';
import { Badge, Button, Field, FormError, Modal, useToast } from './ui';

const looksLikeEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/** Badges after the name: where the login comes from, and anything that stops it working. */
export const StaffBadges: React.FC<{ member: StaffMember; showKind?: boolean }> = ({ member, showKind = true }) => (
  <>
    {showKind && member.kind === 'linked' ? (
      <Badge variant="info" size="sm">
        Homecare login
      </Badge>
    ) : null}
    {!member.active ? (
      <Badge variant="neutral" size="sm">
        Switched off
      </Badge>
    ) : member.kind === 'linked' && member.homecareActive === false ? (
      <Badge variant="warning" size="sm">
        Switched off in Homecare
      </Badge>
    ) : member.mustChangePassword ? (
      <Badge variant="warning" size="sm">
        Temporary password
      </Badge>
    ) : null}
  </>
);

type Mode = 'store' | 'link';
type AddErrors = { name?: string; email?: string; form?: string };

/** New store login, or a link to an existing Homecare login. Mount it only while open, so it starts empty. */
export const AddStaffDialog: React.FC<{
  onClose: () => void;
  onAdded: (staff: StaffMember, temporaryPassword?: string) => void;
}> = ({ onClose, onAdded }) => {
  const [mode, setMode] = useState<Mode>('store');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [found, setFound] = useState<{ name: string; email: string } | null>(null);
  const [errors, setErrors] = useState<AddErrors>({});
  const [busy, setBusy] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setFound(null);
    setErrors({});
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const typed = email.trim().toLowerCase();
    const problems: AddErrors = {};
    if (mode === 'store' && name.trim().length < 2) problems.name = 'Give their name, at least 2 characters.';
    if (!looksLikeEmail(typed)) problems.email = 'Type a full email address, like name@techxpert.in.';
    setErrors(problems);
    if (problems.name || problems.email) return;

    try {
      setBusy(true);
      if (mode === 'store') {
        const result = await api.addStaffLogin({ name: name.trim(), email: typed });
        onAdded(result.staff, result.temporaryPassword);
      } else if (!found) {
        setFound(await api.findHomecareLogin(typed));
      } else {
        onAdded(await api.linkHomecareLogin(found.email));
      }
    } catch (err: any) {
      setErrors({ form: err.message || 'The server refused it.' });
    } finally {
      setBusy(false);
    }
  };

  const submitLabel = mode === 'store' ? 'Create login' : found ? `Link ${found.name}` : 'Find';

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Add staff"
      subtitle="Only people added here can sign in to the store portal."
      maxWidth="520px"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="add-staff"
            variant="primary"
            size="sm"
            loading={busy}
            icon={mode === 'store' ? <UserPlus size={14} /> : found ? <Link2 size={14} /> : <Search size={14} />}
          >
            {submitLabel}
          </Button>
        </>
      }
    >
      <form id="add-staff" onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div role="radiogroup" aria-label="Kind of login" style={styles.choices}>
          {(
            [
              ['store', 'New store login', 'For someone who works only in the store. You get a temporary password to give them.'],
              ['link', 'Link a Homecare login', 'For someone who also works in Homecare. They keep their Homecare email and password.'],
            ] as const
          ).map(([value, title, text]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              data-autofocus={mode === value ? true : undefined}
              onClick={() => switchMode(value)}
              style={{ ...styles.choice, ...(mode === value ? styles.choiceOn : {}) }}
            >
              <span style={styles.choiceTitle}>{title}</span>
              <span style={styles.choiceText}>{text}</span>
            </button>
          ))}
        </div>

        {mode === 'store' ? (
          <Field id="staff-name" label="Name" error={errors.name}>
            <input
              maxLength={120}
              autoComplete="off"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrors((prev) => ({ ...prev, name: undefined, form: undefined }));
              }}
            />
          </Field>
        ) : null}
        <Field
          id="staff-email"
          label={mode === 'store' ? 'Work email' : 'Their Homecare email, exactly'}
          hint={mode === 'store' ? 'They sign in with this.' : 'Only an exact match is found; Homecare logins are never listed.'}
          error={errors.email}
        >
          <input
            type="email"
            maxLength={190}
            autoComplete="off"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setFound(null);
              setErrors((prev) => ({ ...prev, email: undefined, form: undefined }));
            }}
          />
        </Field>

        {mode === 'link' && found ? (
          <div role="status" style={styles.found}>
            Found <strong>{found.name}</strong> ({found.email}). Linking lets them sign in here with their Homecare
            password; give them a role afterwards.
          </div>
        ) : null}
        {errors.form ? <FormError>{errors.form}</FormError> : null}
      </form>
    </Modal>
  );
};

/** Shows a new temporary password once. */
export const TemporaryPasswordDialog: React.FC<{
  issued: { member: StaffMember; password: string; reset: boolean } | null;
  onClose: () => void;
}> = ({ issued, onClose }) => {
  const toast = useToast();
  const secretRef = useRef<HTMLInputElement>(null);
  const copy = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.password);
      toast.success('Temporary password copied.');
      return;
    } catch {
      // The Clipboard API needs permission; copying the selected field works without it.
    }
    secretRef.current?.select();
    if (document.execCommand?.('copy')) toast.success('Temporary password copied.');
    else toast.error("Couldn't copy it. Select the password and copy it by hand.");
  };
  return (
    <Modal
      isOpen={issued != null}
      onClose={onClose}
      title={issued ? `Temporary password for ${issued.member.name}` : 'Temporary password'}
      subtitle="Shown only this once. It isn't stored anywhere you can see it again."
      maxWidth="480px"
      footer={
        <Button variant="primary" size="sm" onClick={onClose}>
          Done
        </Button>
      }
    >
      {issued ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={styles.secretRow}>
            <input
              ref={secretRef}
              readOnly
              aria-label="Temporary password"
              value={issued.password}
              onFocus={(e) => e.currentTarget.select()}
              style={styles.secret}
            />
            <Button variant="secondary" size="sm" icon={<Copy size={14} />} onClick={copy} data-autofocus>
              Copy
            </Button>
          </div>
          <p style={styles.note}>
            Give it to {issued.member.name} in person or by phone, not in a group chat. They sign in with{' '}
            <strong>{issued.member.email}</strong> and this password, then choose their own before anything else.
            {issued.reset ? ' Anywhere they were already signed in has been signed out.' : ''}
          </p>
        </div>
      ) : null}
    </Modal>
  );
};

/**
 * Details and changes for one person. Reset and switch off are confirmed by the caller.
 * Mount it only while open, keyed by the person, so the name field starts from their name.
 */
export const ManageStaffDialog: React.FC<{
  member: StaffMember;
  canEdit: boolean;
  canDelete: boolean;
  onClose: () => void;
  onRenamed: (staff: StaffMember) => void;
  onResetPassword: (member: StaffMember) => void;
  onSetActive: (member: StaffMember, active: boolean) => void;
}> = ({ member, canEdit, canDelete, onClose, onRenamed, onResetPassword, onSetActive }) => {
  const toast = useToast();
  const [name, setName] = useState(member.name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const store = member.kind === 'store';
  const nameChanged = name.trim() !== member.name;

  const rename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameChanged) return;
    if (name.trim().length < 2) {
      setError('Give their name, at least 2 characters.');
      return;
    }
    try {
      setBusy(true);
      const saved = await api.updateStaff(member.id, { name: name.trim() });
      toast.success(`Renamed to ${saved.name}.`);
      onRenamed(saved);
    } catch (err: any) {
      setError(err.message || "Couldn't rename them.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={member.name}
      subtitle={`${member.email} · ${lastSignIn(member.lastLoginAt)}`}
      maxWidth="520px"
      footer={
        <Button variant="secondary" size="sm" onClick={onClose} data-autofocus>
          Close
        </Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <Badge variant={store ? 'neutral' : 'info'} size="sm">
            {store ? 'Store login' : 'Homecare login'}
          </Badge>
          {member.isSuperAdmin ? (
            <Badge variant="brand" size="sm">
              Super admin
            </Badge>
          ) : null}
          <StaffBadges member={member} showKind={false} />
        </div>

        {store ? (
          canEdit ? (
            <form onSubmit={rename} noValidate style={styles.inline}>
              <Field id="manage-name" label="Name" error={error} style={{ flex: 1 }}>
                <input
                  maxLength={120}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError(null);
                  }}
                />
              </Field>
              <Button type="submit" variant="secondary" size="sm" loading={busy} disabled={!nameChanged}>
                Save name
              </Button>
            </form>
          ) : null
        ) : (
          <p style={styles.note}>
            Name, email and password come from Homecare and are changed there. Switching them off in Homecare also
            stops them here{member.homecareActive === false ? ', which is why they currently cannot sign in' : ''}.
          </p>
        )}

        {store && canEdit ? (
          <section style={styles.action}>
            <div>
              <div style={styles.actionTitle}>Reset password</div>
              <div style={styles.note}>
                Gives them a new temporary password and signs them out everywhere. Use it when they forget theirs.
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              style={styles.actionButton}
              onClick={() => onResetPassword(member)}
              disabled={!member.active}
            >
              Reset password
            </Button>
          </section>
        ) : null}

        {canDelete ? (
          <section style={styles.action}>
            <div>
              <div style={styles.actionTitle}>{member.active ? 'Switch off' : 'Switch back on'}</div>
              <div style={styles.note}>
                {member.active
                  ? `${member.name} can't sign in or use the portal from their next click. Nothing is deleted.`
                  : `${member.name} can sign in again, with the same role and places as before.`}
                {!store && member.active ? ' Homecare is not affected.' : ''}
              </div>
            </div>
            <Button
              variant={member.active ? 'danger' : 'secondary'}
              size="sm"
              style={styles.actionButton}
              onClick={() => onSetActive(member, !member.active)}
            >
              {member.active ? 'Switch off' : 'Switch on'}
            </Button>
          </section>
        ) : null}

        {!canEdit && !canDelete ? (
          <p style={styles.note}>Your role can see staff but not change them.</p>
        ) : null}
      </div>
    </Modal>
  );
};

const styles: Record<string, React.CSSProperties> = {
  choices: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
  },
  choice: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '12px',
    textAlign: 'left',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-subtle)',
    background: 'var(--tint-1)',
    cursor: 'pointer',
  },
  choiceOn: {
    border: '1px solid var(--accent)',
    background: 'var(--accent-soft)',
    boxShadow: '0 0 0 1px var(--accent) inset',
  },
  choiceTitle: {
    fontSize: '0.88rem',
    fontWeight: 700,
    color: 'var(--text-main)',
  },
  choiceText: {
    fontSize: '0.76rem',
    color: 'var(--text-muted)',
    lineHeight: 1.4,
  },
  found: {
    padding: '10px 12px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--success-soft)',
    border: '1px solid var(--success-border)',
    color: 'var(--text-main)',
    fontSize: '0.84rem',
    lineHeight: 1.45,
  },
  secretRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
  },
  secret: {
    flex: 1,
    minWidth: 0,
    padding: '12px 14px',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '1.2rem',
    letterSpacing: '0.08em',
    color: 'var(--text-main)',
    background: 'var(--tint-2)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
  },
  note: {
    margin: 0,
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    lineHeight: 1.45,
  },
  inline: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '10px',
  },
  action: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    paddingTop: '14px',
    borderTop: '1px solid var(--border-subtle)',
  },
  actionButton: {
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  actionTitle: {
    fontSize: '0.86rem',
    fontWeight: 600,
    color: 'var(--text-main)',
    marginBottom: '2px',
  },
};

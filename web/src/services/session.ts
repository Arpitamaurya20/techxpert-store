import type { Permissions } from './access';
import type { StaffKind, StaffProfile } from './api';

export type PortalAdmin = {
  id: number;
  name: string;
  email: string;
  role: string;
  /** `linked` people sign in with their Homecare password and change it there. */
  kind: StaffKind;
  /** Signed in with a temporary password: the portal shows only the Change password screen. */
  mustChangePassword: boolean;
  /** Store role name; null until a store admin assigns one. Super admin reads "Super admin". */
  storeRole: string | null;
  permissions: Permissions;
};

/** Staff session — JWT lives in HttpOnly cookie; localStorage only keeps profile. */
export type PortalSession = {
  admin: PortalAdmin;
  /** Legacy Bearer fallback; prefer cookie auth via credentials: 'include'. */
  token?: string;
};

const STORAGE_KEY = 'tx_portal_session';

export function sessionFrom(profile: StaffProfile): PortalSession {
  return {
    admin: {
      id: Number(profile.id),
      name: profile.name,
      email: profile.email,
      role: profile.role,
      kind: profile.kind === 'linked' ? 'linked' : 'store',
      mustChangePassword: Boolean(profile.mustChangePassword),
      storeRole: profile.storeRole ?? null,
      permissions: profile.permissions ?? {},
    },
  };
}

export function loadSession(): PortalSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PortalSession;
    if (!parsed?.admin?.id) return null;
    return {
      admin: {
        id: Number(parsed.admin.id),
        name: parsed.admin.name,
        email: parsed.admin.email,
        role: parsed.admin.role,
        kind: parsed.admin.kind === 'linked' ? 'linked' : 'store',
        mustChangePassword: Boolean(parsed.admin.mustChangePassword),
        storeRole: parsed.admin.storeRole ?? null,
        permissions: parsed.admin.permissions ?? {},
      },
      ...(parsed.token ? { token: parsed.token } : {}),
    };
  } catch {
    return null;
  }
}

export function saveSession(session: PortalSession): void {
  const payload: PortalSession = {
    admin: session.admin,
    // Do not persist JWT — HttpOnly cookie is the session credential
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Optional Bearer for transitional clients; cookie auth is primary. */
export function getToken(): string | null {
  return loadSession()?.token ?? null;
}

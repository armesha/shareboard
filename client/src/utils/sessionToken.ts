import { TIMING } from '../constants';

const { TOKEN_TTL_MS } = TIMING;

interface SessionTokenPayload {
  value: string;
  expiresAt: number;
}

export function setSessionToken(key: string, value: string | undefined): void {
  if (!value) return;
  const payload: SessionTokenPayload = { value, expiresAt: Date.now() + TOKEN_TTL_MS };
  sessionStorage.setItem(key, JSON.stringify(payload));
}

export function getSessionToken(key: string): string | null {
  const raw = sessionStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SessionTokenPayload;
    if (!parsed.expiresAt || parsed.expiresAt < Date.now()) {
      sessionStorage.removeItem(key);
      return null;
    }
    return parsed.value;
  } catch {
    sessionStorage.removeItem(key);
    return null;
  }
}

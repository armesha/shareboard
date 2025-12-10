import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setSessionToken, getSessionToken } from '../../client/src/utils/sessionToken';

const mockSessionStorage: Record<string, string> = {};

vi.stubGlobal('sessionStorage', {
  getItem: vi.fn((key: string) => mockSessionStorage[key] || null),
  setItem: vi.fn((key: string, value: string) => { mockSessionStorage[key] = value; }),
  removeItem: vi.fn((key: string) => { delete mockSessionStorage[key]; })
});

describe('sessionToken', () => {
  beforeEach(() => {
    Object.keys(mockSessionStorage).forEach(key => delete mockSessionStorage[key]);
    vi.clearAllMocks();
  });

  describe('setSessionToken', () => {
    it('should store token with expiration timestamp', () => {
      setSessionToken('test-key', 'test-value');

      expect(sessionStorage.setItem).toHaveBeenCalledWith(
        'test-key',
        expect.stringContaining('"value":"test-value"')
      );
      expect(sessionStorage.setItem).toHaveBeenCalledWith(
        'test-key',
        expect.stringContaining('"expiresAt":')
      );
    });

    it('should skip storing when value is undefined', () => {
      setSessionToken('test-key', undefined);
      expect(sessionStorage.setItem).not.toHaveBeenCalled();
    });

    it('should skip storing when value is empty string', () => {
      setSessionToken('test-key', '');
      expect(sessionStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('getSessionToken', () => {
    it('should return valid token before expiration', () => {
      const futureExpiry = Date.now() + 1000000;
      mockSessionStorage['test-key'] = JSON.stringify({ value: 'my-token', expiresAt: futureExpiry });

      const result = getSessionToken('test-key');
      expect(result).toBe('my-token');
    });

    it('should return null for expired token', () => {
      const pastExpiry = Date.now() - 1000;
      mockSessionStorage['test-key'] = JSON.stringify({ value: 'expired-token', expiresAt: pastExpiry });

      const result = getSessionToken('test-key');
      expect(result).toBeNull();
      expect(sessionStorage.removeItem).toHaveBeenCalledWith('test-key');
    });

    it('should clean up expired tokens from sessionStorage', () => {
      const pastExpiry = Date.now() - 1000;
      mockSessionStorage['test-key'] = JSON.stringify({ value: 'old-token', expiresAt: pastExpiry });

      getSessionToken('test-key');
      expect(sessionStorage.removeItem).toHaveBeenCalledWith('test-key');
    });

    it('should handle malformed JSON gracefully', () => {
      mockSessionStorage['test-key'] = 'not-valid-json{';

      const result = getSessionToken('test-key');
      expect(result).toBeNull();
      expect(sessionStorage.removeItem).toHaveBeenCalledWith('test-key');
    });

    it('should handle missing expiresAt field', () => {
      mockSessionStorage['test-key'] = JSON.stringify({ value: 'no-expiry-token' });

      const result = getSessionToken('test-key');
      expect(result).toBeNull();
      expect(sessionStorage.removeItem).toHaveBeenCalledWith('test-key');
    });

    it('should return null for non-existent key', () => {
      const result = getSessionToken('non-existent-key');
      expect(result).toBeNull();
    });

    it('should return null for null stored value', () => {
      mockSessionStorage['test-key'] = 'null';

      const result = getSessionToken('test-key');
      expect(result).toBeNull();
    });
  });
});

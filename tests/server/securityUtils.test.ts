import { describe, it, expect } from 'vitest';
import { safeCompareTokens } from '../../server/utils/securityUtils';

describe('securityUtils', () => {
  describe('safeCompareTokens', () => {
    it('should return true for matching tokens', () => {
      expect(safeCompareTokens('abc123', 'abc123')).toBe(true);
      expect(safeCompareTokens('edit_token_xyz', 'edit_token_xyz')).toBe(true);
    });

    it('should return false for non-matching tokens', () => {
      expect(safeCompareTokens('abc123', 'xyz789')).toBe(false);
      expect(safeCompareTokens('token1', 'token2')).toBe(false);
    });

    it('should return false for different length tokens', () => {
      expect(safeCompareTokens('short', 'muchlongertoken')).toBe(false);
      expect(safeCompareTokens('a', 'ab')).toBe(false);
    });

    it('should return false for null/undefined values', () => {
      expect(safeCompareTokens(null, 'token')).toBe(false);
      expect(safeCompareTokens('token', null)).toBe(false);
      expect(safeCompareTokens(null, null)).toBe(false);
      expect(safeCompareTokens(undefined, 'token')).toBe(false);
      expect(safeCompareTokens('token', undefined)).toBe(false);
      expect(safeCompareTokens(undefined, undefined)).toBe(false);
    });

    it('should return false for empty strings', () => {
      expect(safeCompareTokens('', '')).toBe(false);
      expect(safeCompareTokens('token', '')).toBe(false);
      expect(safeCompareTokens('', 'token')).toBe(false);
    });

    it('should handle special characters', () => {
      const token1 = 'edit_abc123!@#$%^&*()';
      const token2 = 'edit_abc123!@#$%^&*()';
      expect(safeCompareTokens(token1, token2)).toBe(true);
    });
  });
});

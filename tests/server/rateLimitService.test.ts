import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { checkRateLimit, clearSocketRateLimits } from '../../server/services/rateLimitService';
import { config } from '../../server/config';

describe('rateLimitService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearSocketRateLimits('test-socket');
    clearSocketRateLimits('other-socket');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('checkRateLimit', () => {
    it('allows events within the limit', () => {
      for (let i = 0; i < config.validation.rateLimit.maxEventsPerWindow; i++) {
        expect(checkRateLimit('test-socket', 'whiteboard-update')).toBe(true);
      }
    });

    it('blocks events exceeding the limit', () => {
      const max = config.validation.rateLimit.maxEventsPerWindow;
      for (let i = 0; i < max; i++) {
        checkRateLimit('test-socket', 'whiteboard-update');
      }
      expect(checkRateLimit('test-socket', 'whiteboard-update')).toBe(false);
    });

    it('resets the counter after the time window passes', () => {
      const max = config.validation.rateLimit.maxEventsPerWindow;
      for (let i = 0; i < max; i++) {
        checkRateLimit('test-socket', 'whiteboard-update');
      }
      expect(checkRateLimit('test-socket', 'whiteboard-update')).toBe(false);

      vi.advanceTimersByTime(config.validation.rateLimit.windowMs + 1);

      expect(checkRateLimit('test-socket', 'whiteboard-update')).toBe(true);
    });

    it('tracks different event types independently', () => {
      const max = config.validation.rateLimit.maxEventsPerWindow;
      for (let i = 0; i < max; i++) {
        checkRateLimit('test-socket', 'whiteboard-update');
      }
      expect(checkRateLimit('test-socket', 'whiteboard-update')).toBe(false);
      expect(checkRateLimit('test-socket', 'cursor-position')).toBe(true);
    });

    it('tracks different sockets independently', () => {
      const max = config.validation.rateLimit.maxEventsPerWindow;
      for (let i = 0; i < max; i++) {
        checkRateLimit('test-socket', 'whiteboard-update');
      }
      expect(checkRateLimit('test-socket', 'whiteboard-update')).toBe(false);
      expect(checkRateLimit('other-socket', 'whiteboard-update')).toBe(true);
    });
  });

  describe('clearSocketRateLimits', () => {
    it('clears all rate limit records for a socket', () => {
      const max = config.validation.rateLimit.maxEventsPerWindow;
      for (let i = 0; i < max; i++) {
        checkRateLimit('test-socket', 'whiteboard-update');
      }
      expect(checkRateLimit('test-socket', 'whiteboard-update')).toBe(false);

      clearSocketRateLimits('test-socket');

      expect(checkRateLimit('test-socket', 'whiteboard-update')).toBe(true);
    });

    it('does not affect other sockets', () => {
      const max = config.validation.rateLimit.maxEventsPerWindow;
      for (let i = 0; i < max; i++) {
        checkRateLimit('test-socket', 'whiteboard-update');
        checkRateLimit('other-socket', 'whiteboard-update');
      }

      clearSocketRateLimits('test-socket');

      expect(checkRateLimit('test-socket', 'whiteboard-update')).toBe(true);
      expect(checkRateLimit('other-socket', 'whiteboard-update')).toBe(false);
    });
  });
});

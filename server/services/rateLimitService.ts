import { config } from '../config';
import { logger } from '../utils/logger';
import type { RateLimitRecord } from '../types';

const globalEventCounts = new Map<string, RateLimitRecord>();

export function checkRateLimit(socketId: string, eventName: string): boolean {
  const now = Date.now();
  const key = `${socketId}:${eventName}`;
  const record = globalEventCounts.get(key) || { count: 0, windowStart: now };
  const { windowMs, maxEventsPerWindow } = config.validation.rateLimit;

  if (now - record.windowStart > windowMs) {
    record.count = 1;
    record.windowStart = now;
  } else {
    record.count++;
  }

  globalEventCounts.set(key, record);
  return record.count <= maxEventsPerWindow;
}

export function clearSocketRateLimits(socketId: string): void {
  for (const key of globalEventCounts.keys()) {
    if (key.startsWith(`${socketId}:`)) {
      globalEventCounts.delete(key);
    }
  }
}

export function startCleanupInterval(): NodeJS.Timeout {
  return setInterval(() => {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, record] of globalEventCounts.entries()) {
      if (now - record.windowStart > config.validation.rateLimit.ttlMs) {
        globalEventCounts.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      logger.debug({ removedCount }, 'cleaned up stale rate limit entries');
    }
  }, config.validation.rateLimit.cleanupIntervalMs);
}

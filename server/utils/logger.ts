import pino from 'pino';
import { config } from '../config';

const level = process.env.LOG_LEVEL ?? (config.isProduction ? 'info' : 'debug');

export const logger = pino({
  level,
  redact: {
    paths: [
      'accessToken',
      'editToken',
      'password',
      '*.accessToken',
      '*.editToken',
      '*.password',
      '*.*.accessToken',
      '*.*.editToken',
      '*.*.password',
      'headers.authorization',
      'req.headers.authorization',
    ],
    censor: '[REDACTED]',
  },
  transport: config.isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
});

const throttleMap = new Map<string, number>();
const sampleCounters = new Map<string, number>();

export function logThrottled(key: string, windowMs: number, logFn: () => void): void {
  const now = Date.now();
  const last = throttleMap.get(key) ?? 0;
  if (now - last > windowMs) {
    throttleMap.set(key, now);
    logFn();
  }
}

export function logSampled(key: string, everyN: number, logFn: (count: number) => void): void {
  const count = (sampleCounters.get(key) ?? 0) + 1;
  sampleCounters.set(key, count);
  if (count % everyN === 1) {
    logFn(count);
  }
}

export function clearLogKeysForSocket(socketId: string): void {
  const prefix = `${socketId}:`;
  for (const key of throttleMap.keys()) {
    if (key.startsWith(prefix)) throttleMap.delete(key);
  }
  for (const key of sampleCounters.keys()) {
    if (key.startsWith(prefix)) sampleCounters.delete(key);
  }
}

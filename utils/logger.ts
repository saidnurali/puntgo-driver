/**
 * utils/logger.ts
 * ─────────────────────────────────────────────────────────────────
 * Centralized logger for the PuntGo Driver app.
 *
 * In development (__DEV__ = true):
 *   → All levels are printed with colorized prefixes.
 *
 * In production (__DEV__ = false):
 *   → debug/info are suppressed entirely.
 *   → warn/error/critical are always printed so real issues surface.
 *
 * Usage:
 *   import { logger } from '../utils/logger';
 *   logger.debug('[OrderContext] subscription started');
 *   logger.error('[fetchProfile] Supabase error:', err);
 */

// ─── Level Definitions ────────────────────────────────────────────

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

const PREFIX: Record<LogLevel, string> = {
  debug:    '[DEBUG]   ',
  info:     '[INFO]    ',
  warn:     '[WARN]    ',
  error:    '[ERROR]   ',
  critical: '[CRITICAL]',
};

// ─── Core Logger ──────────────────────────────────────────────────

function log(level: LogLevel, ...args: unknown[]): void {
  const isDev = __DEV__;

  // Suppress noisy levels in production
  if (!isDev && (level === 'debug' || level === 'info')) {
    return;
  }

  const prefix = PREFIX[level];

  switch (level) {
    case 'debug':
    case 'info':
      // eslint-disable-next-line no-console
      console.log(prefix, ...args);
      break;
    case 'warn':
      // eslint-disable-next-line no-console
      console.warn(prefix, ...args);
      break;
    case 'error':
    case 'critical':
      // eslint-disable-next-line no-console
      console.error(prefix, ...args);
      break;
  }
}

// ─── Public API ───────────────────────────────────────────────────

export const logger = {
  /** Verbose tracing — suppressed in production */
  debug: (...args: unknown[]) => log('debug', ...args),

  /** General operational info — suppressed in production */
  info: (...args: unknown[]) => log('info', ...args),

  /** Something unexpected but recoverable — always shown */
  warn: (...args: unknown[]) => log('warn', ...args),

  /** A failure that affects the user — always shown */
  error: (...args: unknown[]) => log('error', ...args),

  /** Unrecoverable failure / data integrity issue — always shown */
  critical: (...args: unknown[]) => log('critical', ...args),
};

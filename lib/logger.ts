/**
 * logger.ts — Centralized production-safe logger for PuntGo Driver
 * - DEV: logs everything with prefixes
 * - Production: silences debug/info, always logs warn + error
 */
const IS_DEV = typeof __DEV__ !== 'undefined' ? __DEV__ : false;

const logger = {
  debug: (...args: any[]) => { if (IS_DEV) console.log('[DEBUG]', ...args); },
  info:  (...args: any[]) => { if (IS_DEV) console.log('[INFO]', ...args); },
  warn:  (...args: any[]) => { console.warn('[WARN]', ...args); },
  error: (...args: any[]) => { console.error('[ERROR]', ...args); },
};

export default logger;

import pino from 'pino';

const isDev  = process.env.NODE_ENV !== 'production';
const isTest = process.env.NODE_ENV === 'test';
const token  = process.env.LOGTAIL_TOKEN;

/**
 * Transport selection (Phase 83 SEC-07):
 *   - test           -> no transport (suppress external calls; tests already
 *                       set NODE_ENV=test before import)
 *   - dev, no token  -> pino-pretty to console (existing dev experience)
 *   - dev or prod, token present
 *                    -> @logtail/pino HTTPS drain to Better Stack
 *   - prod, no token -> no transport (raw JSON to stdout — Render captures)
 */
export function buildTransport() {
  if (isTest) return undefined;
  if (token) {
    return pino.transport({
      target: '@logtail/pino',
      options: { sourceToken: token },
    });
  }
  if (isDev) {
    return pino.transport({
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
    });
  }
  return undefined;
}

export const logger = pino(
  { level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info') },
  buildTransport(),
);

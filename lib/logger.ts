import fs from 'fs';
import path from 'path';

const LOG_DIR = '/home/ele/taskx2';
const LOG_FILE = path.join(LOG_DIR, 'server.log');
const ERROR_LOG_FILE = path.join(LOG_DIR, 'error.log');

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function writeLog(file: string, level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG', context: string, message: string, stack?: string) {
  try {
    ensureLogDir();
    const timestamp = new Date().toISOString();
    let line = `[${timestamp}] [${level}] [${context}] ${message}`;
    if (stack) {
      line += `\n  Stack: ${stack}`;
    }
    line += '\n';
    fs.appendFileSync(file, line);
  } catch (e) {
    console.error('Logger failed to write:', e);
  }
}

export function logError(context: string, error: unknown, extra?: Record<string, unknown>) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  let fullMessage = message;
  if (extra) {
    fullMessage += ` | ${JSON.stringify(extra)}`;
  }
  writeLog(ERROR_LOG_FILE, 'ERROR', context, fullMessage, stack);
  // Also write to general server log
  writeLog(LOG_FILE, 'ERROR', context, fullMessage, stack);
}

export function logWarn(context: string, message: string) {
  writeLog(LOG_FILE, 'WARN', context, message);
}

export function logInfo(context: string, message: string) {
  writeLog(LOG_FILE, 'INFO', context, message);
}

export function logDebug(context: string, message: string) {
  writeLog(LOG_FILE, 'DEBUG', context, message);
}

/**
 * Wrap a Next.js route handler (POST/GET/etc.) to catch and log all errors.
 * Usage: export const POST = withErrorHandler(yourHandler);
 */
export function withErrorHandler<T = unknown>(
  handler: (req: T, context: { params?: Record<string, string> }) => Promise<Response>
) {
  return async (req: T, context?: { params?: Record<string, string> }) => {
    try {
      return await handler(req, context || {});
    } catch (error) {
      const route = (req as { nextUrl?: { pathname?: string } }).nextUrl?.pathname || 'unknown';
      logError(`API:${route}`, error);
      return Response.json(
        { error: 'Internal server error', message: error instanceof Error ? error.message : String(error) },
        { status: 500 }
      );
    }
  };
}
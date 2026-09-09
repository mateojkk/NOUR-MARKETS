/**
 * Centralized logging utility for nour frontend.
 * Provides consistent logging with environment-aware levels.
 */


const isProduction = import.meta.env.PROD;

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private shouldLog(level: LogLevel): boolean {
    if (isProduction) {
      // In production, only log warnings and errors
      return level === 'warn' || level === 'error';
    }
    // In development, log everything
    return true;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.info(`[INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  error(message: string, error?: unknown, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      if (error instanceof Error) {
        console.error(`[ERROR] ${message}`, error, ...args);
      } else {
        console.error(`[ERROR] ${message}`, error, ...args);
      }
    }
  }
}

export const logger = new Logger();
export default logger;


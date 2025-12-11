/**
 * Logging Utility - Consistent logging across the application
 * Provides structured logging with different levels and contexts
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private minLevel: LogLevel;

  constructor() {
    // Set minimum log level based on environment
    const envLevel = process.env.LOG_LEVEL as LogLevel;
    this.minLevel = envLevel || (this.isDevelopment ? 'debug' : 'info');
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const emoji = this.getEmoji(level);
    
    if (this.isDevelopment) {
      // Pretty format for development
      let output = `${emoji} ${timestamp} [${level.toUpperCase()}] ${message}`;
      if (context && Object.keys(context).length > 0) {
        output += `\n${JSON.stringify(context, null, 2)}`;
      }
      return output;
    } else {
      // Structured JSON for production
      const entry: LogEntry = {
        timestamp,
        level,
        message,
        ...(context && { context }),
      };
      return JSON.stringify(entry);
    }
  }

  private getEmoji(level: LogLevel): string {
    switch (level) {
      case 'debug':
        return '🔍';
      case 'info':
        return 'ℹ️';
      case 'warn':
        return '⚠️';
      case 'error':
        return '❌';
      default:
        return '📝';
    }
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message, context);

    switch (level) {
      case 'debug':
      case 'info':
        console.log(formattedMessage);
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
      case 'error':
        console.error(formattedMessage);
        break;
    }
  }

  /**
   * Log debug information (development only)
   */
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  /**
   * Log general information
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Log warning messages
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * Log error messages
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext: LogContext = {
      ...context,
    };

    if (error instanceof Error) {
      errorContext.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    } else if (error) {
      errorContext.error = error;
    }

    this.log('error', message, errorContext);
  }

  /**
   * Log API request/response
   */
  api(method: string, path: string, status: number, duration?: number): void {
    const statusEmoji = status < 400 ? '✅' : status < 500 ? '⚠️' : '❌';
    const message = `${statusEmoji} ${method} ${path} ${status}`;
    
    this.info(message, {
      method,
      path,
      status,
      ...(duration !== undefined && { duration: `${duration}ms` }),
    });
  }

  /**
   * Log database operations
   */
  database(operation: string, table: string, duration?: number, context?: LogContext): void {
    this.debug(`🗄️ Database ${operation}: ${table}`, {
      operation,
      table,
      ...(duration !== undefined && { duration: `${duration}ms` }),
      ...context,
    });
  }

  /**
   * Log external API calls
   */
  externalApi(service: string, endpoint: string, status?: number, context?: LogContext): void {
    const message = `🌐 External API: ${service} ${endpoint}`;
    this.info(message, {
      service,
      endpoint,
      ...(status !== undefined && { status }),
      ...context,
    });
  }

  /**
   * Log AI service operations
   */
  ai(provider: string, operation: string, duration?: number, context?: LogContext): void {
    this.info(`🤖 AI ${provider}: ${operation}`, {
      provider,
      operation,
      ...(duration !== undefined && { duration: `${duration}ms` }),
      ...context,
    });
  }

  /**
   * Log file operations
   */
  file(operation: string, filename: string, context?: LogContext): void {
    this.debug(`📁 File ${operation}: ${filename}`, {
      operation,
      filename,
      ...context,
    });
  }

  /**
   * Create a child logger with persistent context
   */
  child(persistentContext: LogContext): Logger {
    const childLogger = new Logger();
    const originalLog = childLogger.log.bind(childLogger);
    
    childLogger.log = (level: LogLevel, message: string, context?: LogContext) => {
      originalLog(level, message, { ...persistentContext, ...context });
    };
    
    return childLogger;
  }
}

// Export singleton instance
export const logger = new Logger();

// Export type for external use
export type { LogContext, LogLevel };

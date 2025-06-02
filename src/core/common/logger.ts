/* eslint-disable no-unused-vars */
enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
}
/* eslint-enable no-unused-vars */

interface LoggerConfig {
  level: LogLevel;
  enableColors: boolean;
  dateFormat: string;
  prefix?: string;
}

const format = '%c{0} %c{1}';
const defaultDateFormat = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}]';

const pad = (number: number, zeros = 2): string => {
  return String(number).padStart(zeros, '0');
};

const formatTimeZone = (minutesOffset: number): string => {
  const m = Math.abs(minutesOffset);
  return `${minutesOffset >= 0 ? '-' : '+'}${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
};

const formatDate = (template: string, date: Date): string => {
  return template
    .replace('{y}', String(date.getFullYear()))
    .replace('{m}', pad(date.getMonth() + 1))
    .replace('{d}', pad(date.getDate()))
    .replace('{h}', pad(date.getHours()))
    .replace('{i}', pad(date.getMinutes()))
    .replace('{s}', pad(date.getSeconds()))
    .replace('{ms}', pad(date.getMilliseconds(), 3))
    .replace('{z}', formatTimeZone(date.getTimezoneOffset()))
    .replace('{iso}', date.toISOString());
};

class WebLogger {
  private config: LoggerConfig;

  constructor(config?: Partial<LoggerConfig>) {
    const isDevelopment =
      process.env.NODE_ENV === 'development' ||
      (typeof window !== 'undefined' && window.location.hostname === 'localhost');

    this.config = {
      level: isDevelopment ? LogLevel.TRACE : LogLevel.WARN,
      enableColors: true,
      dateFormat: defaultDateFormat,
      ...config,
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level;
  }

  private getTemplate(level: string): string {
    const formattedDate = formatDate(this.config.dateFormat, new Date());
    const prefix = this.config.prefix ? `[${this.config.prefix}] ` : '';
    return format.replace('{0}', formattedDate).replace('{1}', prefix + level);
  }

  private log(
    level: LogLevel,
    levelName: string,
    color: string,
    consoleMethod: 'log' | 'warn' | 'error',
    ...params: unknown[]
  ): void {
    if (!this.shouldLog(level)) return;

    if (this.config.enableColors) {
      console[consoleMethod](
        this.getTemplate(levelName),
        'color: green',
        `color: ${color}`,
        ...params,
      );
    } else {
      const timestamp = formatDate(this.config.dateFormat, new Date());
      const prefix = this.config.prefix ? `[${this.config.prefix}] ` : '';
      console[consoleMethod](`${timestamp} ${prefix}${levelName}`, ...params);
    }
  }

  trace(...params: unknown[]): void {
    this.log(LogLevel.TRACE, 'TRACE', 'orange', 'log', ...params);
  }

  debug(...params: unknown[]): void {
    this.log(LogLevel.DEBUG, 'DEBUG', 'pink', 'log', ...params);
  }

  info(...params: unknown[]): void {
    this.log(LogLevel.INFO, 'INFO', 'aqua', 'log', ...params);
  }

  // Alias for consistency
  information(...params: unknown[]): void {
    this.info(...params);
  }

  warn(...params: unknown[]): void {
    this.log(LogLevel.WARN, 'WARN', 'yellow', 'warn', ...params);
  }

  // Alias for consistency
  warning(...params: unknown[]): void {
    this.warn(...params);
  }

  error(...params: unknown[]): void {
    this.log(LogLevel.ERROR, 'ERROR', 'red', 'error', ...params);
  }

  // Method to create a child logger with a prefix
  createChild(prefix: string): WebLogger {
    return new WebLogger({
      ...this.config,
      prefix: this.config.prefix ? `${this.config.prefix}:${prefix}` : prefix,
    });
  }

  // Method to temporarily change log level
  withLevel(level: LogLevel): WebLogger {
    return new WebLogger({
      ...this.config,
      level,
    });
  }
}

// Create default instance
const isDevelopment =
  process.env.NODE_ENV === 'development' ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost');

export const logger = new WebLogger({
  level: isDevelopment ? LogLevel.TRACE : LogLevel.WARN,
});

export { WebLogger, LogLevel };
export default logger;

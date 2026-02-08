import pino from "pino";
import type { Logger as PinoLogger } from "pino";
import * as fs from "node:fs/promises";
import * as path from "node:path";

/**
 * Log mode determines output behavior
 * - normal: User-friendly messages to stderr, all logs to file
 * - json: Silent stderr, all logs to file only
 * - verbose: Pino-pretty formatted logs to stderr and file
 */
export type LogMode = "normal" | "json" | "verbose";

/**
 * Configuration for CliLogger
 */
export interface CliLoggerOptions {
  mode: LogMode;
  logFile: string;
}

/**
 * Spinner interface stub (will return null in json mode)
 */
export interface Spinner {
  start(): void;
  succeed(text?: string): void;
  fail(text?: string): void;
  stop(): void;
}

/**
 * Progress bar interface stub
 */
export interface ProgressBar {
  start(total: number, startValue: number): void;
  update(value: number): void;
  stop(): void;
}

/**
 * CliLogger wraps pino with three distinct modes:
 * - normal: User-friendly stderr output + file logging
 * - json: File logging only (silent stderr)
 * - verbose: Pino-pretty stderr + file logging
 */
export class CliLogger {
  private readonly logger: PinoLogger;
  private readonly mode: LogMode;

  constructor(options: CliLoggerOptions) {
    this.mode = options.mode;
    this.logger = this.createLogger(options);
  }

  /**
   * Create pino logger with multistream support
   * Always logs to file, conditionally logs to stderr based on mode
   */
  private createLogger(options: CliLoggerOptions): PinoLogger {
    const { mode, logFile } = options;

    // Ensure log directory exists (sync for initialization)
    const logDir = path.dirname(logFile);
    fs.mkdir(logDir, { recursive: true }).catch(() => {
      // Ignore errors during directory creation
    });

    const streams: pino.StreamEntry[] = [
      // Always log to file (JSON format)
      {
        level: "trace",
        stream: pino.destination({
          dest: logFile,
          sync: false,
        }),
      },
    ];

    // In verbose mode, add pino-pretty transport to stderr
    if (mode === "verbose") {
      streams.push({
        level: "trace",
        stream: pino.transport({
          target: "pino-pretty",
          options: {
            destination: 2, // stderr
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        }),
      });
    }

    return pino(
      {
        level: "trace", // Log everything, streams will filter
      },
      pino.multistream(streams)
    );
  }

  /**
   * Write user-friendly message to stderr (only in normal mode)
   */
  private writeStderr(message: string): void {
    if (this.mode === "normal") {
      process.stderr.write(message + "\n");
    }
  }

  /**
   * Info level log
   */
  info(message: string, ...args: unknown[]): void {
    this.logger.info(args.length > 0 ? { args } : undefined, message);
    this.writeStderr(message);
  }

  /**
   * Success level log (uses info level in pino)
   */
  success(message: string, ...args: unknown[]): void {
    this.logger.info(args.length > 0 ? { args } : undefined, message);
    this.writeStderr(message);
  }

  /**
   * Warning level log
   */
  warn(message: string, ...args: unknown[]): void {
    this.logger.warn(args.length > 0 ? { args } : undefined, message);
    this.writeStderr(message);
  }

  /**
   * Error level log
   */
  error(message: string, ...args: unknown[]): void {
    this.logger.error(args.length > 0 ? { args } : undefined, message);
    this.writeStderr(message);
  }

  /**
   * Debug level log (only visible in verbose mode)
   */
  debug(message: string, ...args: unknown[]): void {
    this.logger.debug(args.length > 0 ? { args } : undefined, message);
    // Debug messages never go to stderr in normal mode
  }

  /**
   * Trace level log (only visible in verbose mode)
   */
  trace(message: string, ...args: unknown[]): void {
    this.logger.trace(args.length > 0 ? { args } : undefined, message);
    // Trace messages never go to stderr in normal mode
  }

  /**
   * Create a spinner (returns null in json mode)
   * This is a stub - actual spinner will be created by progress.ts
   */
  spinner(text: string): Spinner | null {
    if (this.mode === "json") {
      return null;
    }
    // Stub implementation for now
    return {
      start: () => {},
      succeed: () => {},
      fail: () => {},
      stop: () => {},
    };
  }

  /**
   * Create a progress bar
   * This is a stub - actual progress bar will be enhanced by progress.ts
   */
  progress(total: number): ProgressBar {
    // Stub implementation for now
    return {
      start: () => {},
      update: () => {},
      stop: () => {},
    };
  }
}

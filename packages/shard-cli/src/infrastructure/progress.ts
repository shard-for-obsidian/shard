import ora from "ora";
import cliProgress from "cli-progress";

/**
 * Spinner interface wrapping ora
 */
export interface Spinner {
  start(): void;
  succeed(text?: string): void;
  fail(text?: string): void;
  stop(): void;
  text: string;
}

/**
 * Progress bar interface wrapping cli-progress
 */
export interface ProgressBar {
  start(total: number, startValue: number, payload?: Record<string, unknown>): void;
  update(value: number, payload?: Record<string, unknown>): void;
  increment(delta?: number, payload?: Record<string, unknown>): void;
  stop(): void;
}

/**
 * Create a spinner using ora
 * Returns null if disabled (e.g., in json mode)
 *
 * @param text - Initial spinner text
 * @param enabled - Whether to create an actual spinner or return null
 * @returns Spinner instance or null
 */
export function createSpinner(text: string, enabled: boolean): Spinner | null {
  if (!enabled) {
    return null;
  }

  const spinner = ora({
    text,
    color: "cyan",
  });

  return spinner;
}

/**
 * Create a progress bar using cli-progress
 * Returns null if disabled (e.g., in json mode)
 *
 * @param total - Total number of items
 * @param enabled - Whether to create an actual progress bar or return null
 * @returns ProgressBar instance or null
 */
export function createProgressBar(total: number, enabled: boolean): ProgressBar | null {
  if (!enabled) {
    return null;
  }

  const bar = new cliProgress.SingleBar(
    {
      format: "{bar} {percentage}% | {value}/{total}",
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591",
      hideCursor: true,
    },
    cliProgress.Presets.shades_classic
  );

  return bar;
}

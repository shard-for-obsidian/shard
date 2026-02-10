import ora from "ora";

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

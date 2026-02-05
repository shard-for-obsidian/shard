/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/**
 * Simple logger that writes to stderr for progress messages.
 * This allows JSON output on stdout while still showing progress.
 */
export class Logger {
  private silent: boolean;

  constructor(silent = false) {
    this.silent = silent;
  }

  /**
   * Log a message to stderr
   */
  log(message: string): void {
    if (!this.silent) {
      process.stderr.write(message + "\n");
    }
  }

  /**
   * Log an error message to stderr
   */
  error(message: string): void {
    if (!this.silent) {
      process.stderr.write(`Error: ${message}\n`);
    }
  }

  /**
   * Log a success message to stderr
   */
  success(message: string): void {
    if (!this.silent) {
      process.stderr.write(`Success: ${message}\n`);
    }
  }
}

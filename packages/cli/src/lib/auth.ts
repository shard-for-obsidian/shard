/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/**
 * Resolve GitHub authentication token from multiple sources.
 * Priority: CLI flag -> GITHUB_TOKEN -> GH_TOKEN -> error
 *
 * @param cliToken - Token provided via CLI flag
 * @returns Resolved token
 * @throws Error if no token is found
 */
export function resolveAuthToken(cliToken?: string): string {
  // Priority 1: CLI flag
  if (cliToken) {
    return cliToken;
  }

  // Priority 2: GITHUB_TOKEN environment variable (CI/CD)
  const githubToken = process.env.GITHUB_TOKEN;
  if (githubToken) {
    return githubToken;
  }

  // Priority 3: GH_TOKEN environment variable (gh CLI)
  const ghToken = process.env.GH_TOKEN;
  if (ghToken) {
    return ghToken;
  }

  // No token found
  throw new Error(
    "GitHub token required. Use --token flag or set GITHUB_TOKEN environment variable"
  );
}

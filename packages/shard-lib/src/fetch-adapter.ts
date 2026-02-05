/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/**
 * Adapter interface for HTTP requests.
 * Allows OciRegistryClient to work with different fetch implementations.
 */
export interface FetchAdapter {
  /**
   * Perform an HTTP request using fetch semantics.
   * @param input URL string or Request object
   * @param init Optional request initialization
   * @returns Promise resolving to Response
   */
  fetch(input: string | Request, init?: RequestInit): Promise<Response>;
}

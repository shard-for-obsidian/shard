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

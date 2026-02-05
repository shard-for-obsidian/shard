/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import type { RegistryRepo } from "../types/RegistryTypes.js";

export interface RegistryClientOptions {
  name?: string; // mutually exclusive with repo
  repo?: RegistryRepo;
  // log
  username?: string;
  password?: string;
  token?: string; // for bearer auth
  insecure?: boolean;
  scheme?: "https" | "http";
  acceptOCIManifests?: boolean;
  acceptManifestLists?: boolean;
  userAgent?: string;
  scopes?: string[];
  adapter: {
    fetch(input: string | Request, init?: RequestInit): Promise<Response>;
  };
}

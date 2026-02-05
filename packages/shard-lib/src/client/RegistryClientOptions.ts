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

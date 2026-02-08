// Re-export everything from new structure
export * from "./client/OciRegistryClient.js";
export * from "./types/ManifestTypes.js";
export * from "./types/RegistryTypes.js";
export * from "./types/AuthTypes.js";
export * from "./types/RequestTypes.js";
export * from "./parsing/RepoParser.js";
export * from "./parsing/IndexParser.js";
export * from "./parsing/LinkHeaderParser.js";
export * from "./utils/ValidationUtils.js";
export * from "./utils/DigestUtils.js";
export * from "./errors/RegistryErrors.js";
export * from "./ghcr/GhcrConstants.js";
export type { FetchAdapter } from "./client/FetchAdapter.js";
export type { RegistryClientOptions } from "./client/RegistryClientOptions.js";

// Schema exports
export * from "./schemas/index.js";

// OCI exports
export * from "./oci/index.js";

// Marketplace exports
export * from "./marketplace/index.js";

// Adapter exports
export * from "./adapters/index.js";

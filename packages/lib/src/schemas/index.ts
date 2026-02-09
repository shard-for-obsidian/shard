// Schemas
export { ObsidianManifestSchema, type ObsidianManifest } from "./manifest.js";

export {
  PluginAnnotationsSchema,
  type PluginAnnotations,
} from "./annotations.js";

export {
  PluginVersionSchema,
  MarketplacePluginSchema,
  MarketplaceIndexSchema,
  CachedMarketplaceDataSchema,
  type PluginVersion,
  type MarketplacePlugin,
  type MarketplaceIndex,
  type CachedMarketplaceData,
} from "./marketplace.js";

// Transform utilities
export {
  repoToVcsUrl,
  vcsUrlToGitHubUrl,
  manifestToAnnotations,
  annotationsToMarketplacePlugin,
} from "./transforms.js";

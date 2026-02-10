import { buildRouteMap } from "@stricli/core";
import { sync } from "./sync.js";

/**
 * Marketplace route map for content management operations
 */
export const marketplaceRouteMap = buildRouteMap({
  routes: {
    sync,
  },
  docs: {
    brief: "Marketplace content management",
  },
});

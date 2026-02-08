import { buildRouteMap } from "@stricli/core";
import { push } from "./push.js";
import { pull } from "./pull.js";
import { versions } from "./versions.js";

/**
 * Registry route map for direct OCI registry operations
 */
export const registryRouteMap = buildRouteMap({
  routes: {
    push,
    pull,
    versions,
  },
  docs: {
    brief: "Direct OCI registry operations",
  },
});

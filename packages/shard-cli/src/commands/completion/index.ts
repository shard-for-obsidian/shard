import { buildRouteMap } from "@stricli/core";
import { install } from "./install.js";
import { script } from "./script.js";

/**
 * Route map for completion subcommands
 */
export const completionRouteMap = buildRouteMap({
  routes: {
    install,
    script,
  },
  docs: {
    brief: "Shell completion utilities",
  },
});

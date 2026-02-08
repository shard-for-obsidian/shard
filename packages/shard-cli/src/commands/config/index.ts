import { buildRouteMap } from "@stricli/core";
import { get } from "./get.js";
import { set } from "./set.js";
import { list } from "./list.js";
import { clear } from "./clear.js";

/**
 * Config route map for CLI configuration management
 */
export const configRouteMap = buildRouteMap({
  routes: {
    get,
    set,
    list,
    clear,
  },
  docs: {
    brief: "Manage CLI configuration",
  },
});

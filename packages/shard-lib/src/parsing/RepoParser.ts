import type {
  RegistryRepo,
  RegistryIndex,
  RegistryImage,
} from "../types/RegistryTypes.js";

import { splitIntoTwo, DEFAULT_TAG } from "../common.js";

/**
 * Parse a docker repo and tag string: [INDEX/]REPO[:TAG|@DIGEST]
 *
 * Examples:
 *    busybox
 *    google/python
 *    docker.io/ubuntu
 *    localhost:5000/blarg
 *    http://localhost:5000/blarg
 *
 * Dev Notes:
 * - This is meant to mimic
 *   docker.git:registry/config.go#ServiceConfig.NewRepositoryInfo
 *   as much as reasonable -- with the addition that we maintain the
 *   'tag' field.  Also, that we accept the scheme on the "INDEX" is
 *   different than docker.git's parsing.
 * - TODO: what about the '@digest' digest alternative to a tag? See:
 *   // JSSTYLED
 *   https://github.com/docker/docker/blob/0c7b51089c8cd7ef3510a9b40edaa139a7ca91aa/pkg/parsers/parsers.go#L68
 *
 * @param arg {String} The docker repo string to parse. See examples above.
 * @param defaultIndex {Object|String} Optional. The default index to use
 *      if not specified with `arg`. If not given the default is 'docker.io'.
 *      If given it may either be a string, e.g. 'https://myreg.example.com',
 *      or parsed index object, as from `parseIndex()`.
 */
export function parseRepo(
  arg: string,
  defaultIndex?: string | RegistryIndex,
): RegistryRepo {
  // ...implementation moved from common.ts...
  // This function will need to import parseIndex from IndexParser if split
  throw new Error("Not yet implemented: see refactor plan");
}

/**
 * Parse a docker repo and tag/digest string: [INDEX/]REPO[:TAG|@DIGEST|:TAG@DIGEST]
 *
 * Examples:
 *    busybox
 *    busybox:latest
 *    google/python:3.3
 *    docker.io/ubuntu
 *    localhost:5000/blarg
 *    http://localhost:5000/blarg:latest
 *    google/python:3.3@sha256:fb9f16730ac6316afa4d97caa51302199...
 *    alpine@sha256:fb9f16730ac6316afa4d97caa5130219927bfcecf0b0...
 *
 * Dev Notes:
 * - TODO Validation on digest and tag would be nice.
 *
 * @param arg {String} The docker repo:tag string to parse. See examples above.
 * @param defaultIndex {Object|String} Optional. The default index to use
 *      if not specified with `arg`. If not given the default is 'docker.io'.
 *      If given it may either be a string, e.g. 'https://myreg.example.com',
 *      or parsed index object, as from `parseIndex()`.
 */
export function parseRepoAndRef(
  arg: string,
  defaultIndex?: string | RegistryIndex,
): RegistryImage {
  // ...implementation moved from common.ts...
  throw new Error("Not yet implemented: see refactor plan");
}

export const parseRepoAndTag = parseRepoAndRef;

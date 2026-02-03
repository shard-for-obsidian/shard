import { parseRepoAndRef } from "../lib/client/common.mjs";
import { RegistryClientV2 } from "../lib/client/registry-client.mjs";

// The interesting stuff starts here.
const rar = parseRepoAndRef("ghcr.io/gillisandrew/dragonglass-poc:latest");
const client = new RegistryClientV2({
  repo: rar,
  // log: log,
  insecure: false,
  username: "github",
  password: process.env.GITHUB_TOKEN || "",
  acceptOCIManifests: true,
});
const tagOrDigest = rar.tag || rar.digest || "";
const { resp, manifest } = await client.getManifest({
  ref: tagOrDigest,
  acceptManifestLists: false,
});

console.error("# response headers");
console.table([...resp.headers.entries()]);
console.error("# manifest");
console.log(manifest);

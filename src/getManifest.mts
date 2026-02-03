import { parseRepoAndRef } from "../lib/client/common.mjs";
import { GHCRClient } from "../lib/client/registry-client.mjs";

// The interesting stuff starts here.
const rar = parseRepoAndRef(
  "ghcr.io/gillisandrew/dragonglass-poc/example-plugin:latest",
);
const client = new GHCRClient({
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

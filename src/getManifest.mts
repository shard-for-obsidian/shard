import { parseRepoAndRef } from "../lib/client/common.mjs";
import { GHCRClient } from "../lib/client/registry-client.mjs";
import type {
  RequestUrlParam,
  RequestUrlResponse,
} from "../lib/client/types.mjs";

// Mock requestUrl for Node.js environment (in Obsidian, use the real requestUrl)
async function mockRequestUrl(
  request: RequestUrlParam | string,
): Promise<RequestUrlResponse> {
  const req = typeof request === "string" ? { url: request } : request;
  const fetchResp = await fetch(req.url, {
    method: req.method,
    headers: req.headers,
    body: req.body,
  });

  const arrayBuffer = await fetchResp.arrayBuffer();
  const text = new TextDecoder().decode(arrayBuffer);

  // Convert Headers to Record<string, string>
  const headers: Record<string, string> = {};
  fetchResp.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return {
    status: fetchResp.status,
    headers,
    arrayBuffer,
    json: JSON.parse(text),
    text,
  };
}

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
  requestUrl: mockRequestUrl,
});
const tagOrDigest = rar.tag || rar.digest || "";
const { resp, manifest } = await client.getManifest({
  ref: tagOrDigest,
  acceptManifestLists: false,
});

console.error("# response headers");
console.table(Object.entries(resp.headers));
console.error("# manifest");
console.log(manifest);

# shard-lib

OCI-compatible container registry client library for TypeScript/JavaScript.

## Features

- Parse and validate Docker/OCI repository references
- Interact with OCI registries (Docker Hub, GHCR, etc.)
- Support for Docker v2 and OCI manifest formats
- Bearer token and basic authentication
- Link header parsing for pagination

## Installation

```bash
pnpm add shard-lib
```

## Usage

```typescript
import { OciRegistryClient, parseRepoAndRef } from "shard-lib";

// Parse a repository reference
const repo = parseRepoAndRef("ghcr.io/owner/repo:latest");
console.log(repo.index.name); // 'ghcr.io'
console.log(repo.tag); // 'latest'

// Create a registry client
const client = new OciRegistryClient({
  repo: repo,
  adapter: { fetch },
  username: "user",
  password: "token",
});

// List tags
const tags = await client.listTags();

// Get manifest
const manifest = await client.getManifest("latest");
```

## Project Structure

```
src/
  client/          # OCI registry client and adapters
  errors/          # Custom error classes
  ghcr/            # GitHub Container Registry constants
  parsing/         # Repository and index parsing
  types/           # TypeScript type definitions
  utils/           # Utility functions
  __tests__/       # Test files
```

## API

### Parsing

- `parseIndex(arg?: string): RegistryIndex` - Parse registry index/URL
- `parseRepo(arg: string, defaultIndex?: string | RegistryIndex): RegistryRepo` - Parse repository
- `parseRepoAndRef(arg: string, defaultIndex?: string | RegistryIndex): RegistryImage` - Parse repository with tag/digest
- `urlFromIndex(index: RegistryIndex, scheme?: 'http' | 'https'): string` - Generate URL from index

### Client

- `OciRegistryClient` - Main registry client class
  - `listTags()` - List repository tags
  - `getManifest(ref: string)` - Get image manifest
  - `getBlob(digest: string)` - Download blob by digest

### Types

See TypeScript definitions for complete type information.

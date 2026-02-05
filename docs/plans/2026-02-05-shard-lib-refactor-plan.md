# Shard Lib Refactor Plan

## Overview
The `shard-lib` package provides a set of utilities, types, and a client for interacting with OCI-compatible registries (such as Docker Hub and GHCR). The codebase is functional but can be improved for clarity, maintainability, and extensibility by reorganizing files, renaming classes/interfaces, and clarifying responsibilities.

## Current Structure
- `index.ts`: Barrel file exporting all public APIs
- `registry-client.ts`: Main OCI registry client implementation
- `common.ts`: Parsing, constants, and utility functions
- `ghcr.ts`: GHCR-specific constants
- `types.ts`: TypeScript types and interfaces
- `errors.ts`: Custom error classes
- `fetch-adapter.ts`: HTTP adapter interface
- `util/link-header.ts`: Link header parsing utility

## Issues Identified
- File and class names are generic or overloaded (e.g., `common.ts`, `types.ts`)
- Some files mix unrelated concerns (e.g., parsing, constants, and helpers in `common.ts`)
- Error classes could be grouped more clearly
- Adapter pattern could be more explicit
- Some naming is inconsistent (e.g., `OciRegistryClient` vs. `RegistryClientOpts`)

## Proposed New Structure

### File/Folder Layout
```
src/
  client/
    OciRegistryClient.ts         # Main client class
    RegistryClientOptions.ts     # Options interface for client
    adapters/
      FetchAdapter.ts            # HTTP adapter interface
  errors/
    RegistryErrors.ts            # All custom error classes
  ghcr/
    ghcrConstants.ts             # GHCR-specific constants
  parsing/
    RepoParser.ts                # parseRepo, parseRepoAndRef, etc.
    IndexParser.ts               # parseIndex, urlFromIndex
    LinkHeaderParser.ts          # parseLinkHeader
  types/
    ManifestTypes.ts             # Manifest, ManifestOCI, etc.
    RegistryTypes.ts             # RegistryRepo, RegistryIndex, etc.
    AuthTypes.ts                 # AuthInfo, etc.
  utils/
    DigestUtils.ts               # digestFromManifestStr, encodeHex, etc.
    ValidationUtils.ts           # isLocalhost, splitIntoTwo, etc.
index.ts                         # Barrel file
```

### Naming Improvements
- `OciRegistryClient` → `OciRegistryClient` (keep, but move to its own file)
- `RegistryClientOpts` → `RegistryClientOptions`
- `Manifest`, `ManifestOCI`, etc. → Move to `ManifestTypes.ts`
- `parseRepo`, `parseRepoAndRef` → Move to `RepoParser.ts`
- `parseIndex`, `urlFromIndex` → Move to `IndexParser.ts`
- `parseLinkHeader` → `LinkHeaderParser.ts`
- `FetchAdapter` → Move to `adapters/FetchAdapter.ts`
- Error classes → Move to `errors/RegistryErrors.ts`
- Constants (media types, user agent, etc.) → Move to relevant files (e.g., `ghcrConstants.ts`, `ManifestTypes.ts`)

### API/Interface Improvements
- Make all exported types and interfaces explicit and grouped by domain
- Use more descriptive names for types (e.g., `RegistryRepo` → `RepositoryInfo`)
- Document all public APIs and types

## Migration Steps
1. Create new folders/files as per the proposed structure
2. Move and rename classes, types, and functions accordingly
3. Update all imports/exports to match the new structure
4. Update the barrel file (`index.ts`) to re-export the new structure
5. Add or improve documentation for all public APIs
6. (Optional) Add tests for parsing and error handling utilities

## Benefits
- Improved discoverability and maintainability
- Clearer separation of concerns
- Easier onboarding for new contributors
- More scalable for future features

---

*Prepared: 2026-02-05*

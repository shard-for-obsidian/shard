# 2026-02-05-shard-rebrand-refactor-plan

**Date:** 2026-02-05  
**Status:** Draft

## Overview

This document outlines the plan to rebrand and refactor the repository from "obsidian-*" and "plugin-manager" names to "shard" branding. The CLI will use a `shard-` prefix (e.g., `shard-cli`) for npm publication, and all project-specific names will be updated accordingly.

---

## 1. Folder and Package Renames

- Rename `packages/cli` → `packages/shard-cli`
  - In `package.json`, change `"@plugin-manager/cli"` → `"shard-cli"` and update all references.
- Rename `packages/plugin` → `packages/shard-installer`
  - In `package.json`, change `"@plugin-manager/plugin"` → `"shard-installer"` and update all references.
- Rename `packages/lib` → `packages/shard-lib`
  - In `package.json`, change `"@plugin-manager/lib"` → `"shard-lib"` and update all references.
- Update all internal references in `pnpm-workspace.yaml`, root `package.json`, and scripts.

---

## 2. Code and Config Refactors

- Update all imports/exports in code from `@plugin-manager/*` to `shard-*` (for CLI) and `shard-lib`/`shard-installer` as appropriate.
- Change CLI binary from `obsidian-plugin` to `shard`.
- Update CLI help text, usage examples, and documentation to use `shard` branding.
- Update manifest/config fields, e.g., artifact types, label keys, and schema references if they use old names.
- Update all TypeScript types, comments, and variable names that reference "obsidian", "plugin-manager", or "plugin".

---

## 3. Documentation and Schema Updates

- Update all documentation (README, docs/plans, etc.) to use "shard" branding and new package names.
- Update schema files (e.g., `md.obsidian.manifest.v1.schema.json`) to reference "shard" if appropriate, or clarify legacy compatibility.
- Update scripts (e.g., `push-plugin`) to use new label keys and artifact types if rebranding is required at the OCI level.

---

## 4. Additional Notes

- Some references to "obsidian" (e.g., API, manifest fields) may need to remain for compatibility with the Obsidian app, but all project-specific branding should be changed.
- Update keywords, descriptions, and author fields in all `package.json` files.
- Update all test, build, and CI scripts to use new names.

---

## Checklist

- [ ] Rename folders and update package.json names
- [ ] Update all code imports/exports and CLI binary name
- [ ] Refactor documentation and schema references
- [ ] Update scripts and CI configs
- [ ] Verify compatibility and legacy support where needed

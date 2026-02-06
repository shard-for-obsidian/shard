# SvelteKit Marketplace Migration Checklist

**Date Started**: 2026-02-06
**Current Phase**: Phase 1 (Complete)
**Status**: Ready for Phase 2

---

## Phase 1: Parallel Development ✅ COMPLETE

The SvelteKit marketplace has been built and runs in parallel with the existing Hugo site.

### Completed Items

- [x] Create `apps/marketplace` directory structure
- [x] Initialize SvelteKit with adapter-static
- [x] Configure Tailwind CSS v4 with `@tailwindcss/vite`
- [x] Install and configure shadcn-svelte UI components
- [x] Implement type definitions (re-exported from `shard-installer`)
- [x] Create root layout with data loading (`+layout.svelte`, `+layout.ts`)
- [x] Build home page with plugin grid (`+page.svelte`)
- [x] Create plugin detail page routes (`plugins/[id]/+page.svelte`)
- [x] Add prerender entries for all plugin pages
- [x] Update generate script to output to `apps/marketplace/static/`
- [x] Add Lunr.js search dependencies
- [x] Create search index build script
- [x] Implement SearchBar component with client-side search
- [x] Update root package.json scripts (`marketplace:*`)
- [x] Create GitHub Actions workflow for deployment
- [x] Add custom 404 error page
- [x] Write comprehensive app README
- [x] Update marketplace README with migration notes
- [x] Test full build pipeline
- [x] Verify prerendering of all pages

### Build Output Verification

```bash
apps/marketplace/build/
├── index.html                 # Home page (12 KB)
├── 404.html                   # Error page (1.5 KB)
├── plugins/
│   ├── nldates-obsidian.html
│   ├── notebook-navigator.html
│   └── shard-installer.html
├── plugins.json               # Plugin data (2.3 KB)
├── search-index.json          # Search index (13 KB)
└── _app/                      # SvelteKit assets
```

### Known Issues

1. **Favicon Missing**: 404 for `/shard/favicon.png` - add favicon before Phase 2
2. **OCI Query Warnings**: Expected in local builds without `GITHUB_TOKEN`
3. **Hardcoded Plugin IDs**: The `entries()` function in `+page.ts` uses hardcoded plugin IDs - should be kept in sync with `marketplace/plugins/*.md`

---

## Phase 2: Cutover to Production

Switch GitHub Pages deployment from Hugo to SvelteKit.

### Prerequisites

- [ ] Verify Phase 1 complete
- [ ] All tests passing locally
- [ ] Preview site reviewed and approved
- [ ] Backup Hugo deployment workflow
- [ ] Add favicon to `apps/marketplace/static/`

### Cutover Steps

#### 1. Prepare for Deployment

```bash
# Clean build from scratch
cd apps/marketplace
rm -rf build .svelte-kit
cd ../..

# Full production build
env NODE_ENV=production pnpm marketplace:build

# Verify build output
ls -lh apps/marketplace/build/
```

#### 2. Update GitHub Actions Workflow

- [ ] Rename `.github/workflows/marketplace.yml` to `.github/workflows/marketplace-hugo.yml.bak`
- [ ] Rename `.github/workflows/marketplace-sveltekit.yml` to `.github/workflows/marketplace.yml`
- [ ] Review workflow configuration:
  - Triggers on correct paths
  - Uses correct build commands
  - Uploads correct directory (`apps/marketplace/build/`)

#### 3. Deploy to GitHub Pages

- [ ] Push changes to main branch
- [ ] Monitor GitHub Actions workflow execution
- [ ] Verify deployment succeeds
- [ ] Check GitHub Pages URL

#### 4. Validation Tests

Run these tests on the live site:

**Homepage Tests:**

- [ ] Page loads at `https://USERNAME.github.io/shard/`
- [ ] All 3 plugin cards display correctly
- [ ] Plugin names, authors, descriptions visible
- [ ] "View Details" buttons work
- [ ] "Install" buttons display correct commands
- [ ] Responsive layout works (mobile, tablet, desktop)

**Search Tests:**

- [ ] Search bar loads and is interactive
- [ ] Typing in search shows dropdown results
- [ ] Search results are accurate (test queries: "date", "nav", "install")
- [ ] Clicking search results navigates to correct plugin page
- [ ] Search works without JavaScript (graceful degradation)

**Plugin Detail Page Tests:**

- [ ] All 3 plugin pages load correctly:
  - `/plugins/nldates-obsidian/`
  - `/plugins/notebook-navigator/`
  - `/plugins/shard-installer/`
- [ ] Plugin metadata displays (ID, author, registry URL, min Obsidian version)
- [ ] "Copy Install Command" button works
- [ ] Version list displays correctly
- [ ] "Back to marketplace" link works
- [ ] Repository links work (external)

**Error Handling Tests:**

- [ ] 404 page displays for invalid URLs
- [ ] 404 has "Back to Marketplace" button
- [ ] No console errors in browser

**Performance Tests:**

- [ ] Initial page load < 2 seconds
- [ ] Search response < 200ms
- [ ] No layout shift on load
- [ ] Images load correctly (if any)

#### 5. Post-Deployment Monitoring

- [ ] Monitor for 24 hours
- [ ] Check for error reports
- [ ] Review analytics (if configured)
- [ ] Test from multiple browsers (Chrome, Firefox, Safari)

### Rollback Plan

If issues are found after deployment:

1. **Immediate Rollback** (< 5 minutes):

   ```bash
   # Restore Hugo workflow
   git mv .github/workflows/marketplace-hugo.yml.bak .github/workflows/marketplace.yml
   git commit -m "revert: rollback to Hugo marketplace"
   git push
   ```

2. **Wait for Deployment**: Monitor GitHub Actions

3. **Verify Hugo Site**: Check that original site is restored

4. **Document Issues**: Create GitHub issues for any problems found

5. **Fix and Retry**: Address issues in feature branch before re-attempting cutover

---

## Phase 3: Cleanup

Remove Hugo artifacts after successful cutover.

### Prerequisites

- [ ] Phase 2 complete and stable for 1+ week
- [ ] No rollback required
- [ ] User feedback positive

### Cleanup Steps

#### 1. Archive Hugo Files

```bash
# Create archive directory
mkdir -p marketplace/archive

# Move Hugo files
mv marketplace/themes marketplace/archive/
mv marketplace/layouts marketplace/archive/
mv marketplace/static marketplace/archive/
mv marketplace/config.toml marketplace/archive/

# Keep plugin sources and scripts
# Keep: marketplace/plugins/*.md
# Keep: marketplace/scripts/generate-plugins-json.ts
```

#### 2. Remove Hugo Dependencies

```bash
# Check for Hugo references
grep -r "hugo" .github/
grep -r "Hugo" docs/

# Remove Hugo workflow backup
rm .github/workflows/marketplace-hugo.yml.bak
```

#### 3. Update Documentation

- [ ] Update main README to reference SvelteKit marketplace
- [ ] Update CONTRIBUTING.md (if exists) with new submission process
- [ ] Archive old Hugo documentation
- [ ] Update any external links or references

#### 4. Optional: Consolidate Plugin Sources

Decision: Move plugin markdown files to `apps/marketplace/content/` or keep in `marketplace/plugins/`?

If moving:

```bash
mkdir -p apps/marketplace/content/plugins
mv marketplace/plugins/*.md apps/marketplace/content/plugins/

# Update generate script path
# Edit marketplace/scripts/generate-plugins-json.ts
# Change: marketplace/plugins/*.md → apps/marketplace/content/plugins/*.md
```

#### 5. Final Verification

- [ ] Full build still works
- [ ] All scripts run correctly
- [ ] Documentation is up to date
- [ ] No broken references
- [ ] Git history preserved

---

## Validation Checklist

Use this checklist to verify each phase:

### Build Validation

```bash
# Clean build test
rm -rf apps/marketplace/build apps/marketplace/.svelte-kit
env NODE_ENV=production pnpm marketplace:build

# Expected output:
# ✅ Generated plugins.json
# ✅ Generated search-index.json
# ✅ SvelteKit build completes
# ✅ apps/marketplace/build/ contains:
#    - index.html
#    - 404.html
#    - plugins/*.html (one per plugin)
#    - plugins.json
#    - search-index.json
#    - _app/ directory
```

### Preview Validation

```bash
# Start preview server
pnpm marketplace:preview

# Open http://localhost:4173/shard/
# Test all functionality manually
```

### Local Development Validation

```bash
# Test dev server
pnpm marketplace:dev

# Open http://localhost:5173/
# Test hot reload, changes reflect immediately
```

---

## Troubleshooting

### Common Issues and Solutions

**Issue**: Build fails with "Cannot find plugins.json"

- **Solution**: Run `pnpm marketplace:generate` first

**Issue**: Search not working in preview

- **Solution**: Ensure `search-index.json` is in `static/` directory

**Issue**: Plugin detail pages 404

- **Solution**: Check `entries()` function has correct plugin IDs

**Issue**: Styles not loading

- **Solution**: Verify Tailwind v4 config in `app.css` and `vite.config.ts`

**Issue**: Base path incorrect in production

- **Solution**: Check `svelte.config.js` base path is `/shard`

---

## Contact and Support

- **Primary Contact**: [Your Name/Team]
- **GitHub Issues**: https://github.com/gillisandrew/shard/issues
- **Documentation**: `apps/marketplace/README.md`

---

## Appendix: Key Files Reference

### Configuration Files

- `apps/marketplace/svelte.config.js` - SvelteKit adapter and base path
- `apps/marketplace/vite.config.ts` - Vite and Tailwind v4 plugin
- `apps/marketplace/package.json` - Dependencies and scripts
- `apps/marketplace/src/app.css` - Tailwind v4 CSS config

### Route Files

- `apps/marketplace/src/routes/+layout.svelte` - Root layout
- `apps/marketplace/src/routes/+layout.ts` - Data loading
- `apps/marketplace/src/routes/+page.svelte` - Home page
- `apps/marketplace/src/routes/plugins/[id]/+page.svelte` - Plugin detail
- `apps/marketplace/src/routes/plugins/[id]/+page.ts` - Plugin loader + entries
- `apps/marketplace/src/routes/+error.svelte` - Error page

### Build Scripts

- `marketplace/scripts/generate-plugins-json.ts` - Plugin data generation
- `apps/marketplace/scripts/build-search-index.ts` - Search index generation

### Workflow Files

- `.github/workflows/marketplace-sveltekit.yml` - SvelteKit deployment
- `.github/workflows/marketplace.yml` - Active workflow (Hugo → SvelteKit after Phase 2)

---

**Last Updated**: 2026-02-06
**Next Review**: Before Phase 2 cutover

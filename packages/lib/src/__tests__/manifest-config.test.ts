// packages/shard-lib/src/__tests__/manifest-config.test.ts
import { describe, it, expect } from 'vitest';
import type { ObsidianManifest } from '../types/ManifestTypes.js';

describe('Obsidian Manifest as OCI Config', () => {
  it('should define ObsidianManifest type with required fields', () => {
    const manifest: ObsidianManifest = {
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
      minAppVersion: '0.15.0',
      description: 'A test plugin',
      author: 'Test Author',
    };

    expect(manifest.id).toBe('test-plugin');
    expect(manifest.version).toBe('1.0.0');
  });
});

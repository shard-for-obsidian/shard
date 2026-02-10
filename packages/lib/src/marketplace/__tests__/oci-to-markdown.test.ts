import { describe, it, expect } from 'vitest';
import { ociAnnotationsToFrontmatter } from '../oci-to-markdown.js';

describe('ociAnnotationsToFrontmatter', () => {
  it('should transform OCI annotations to frontmatter structure', () => {
    const annotations = {
      'vnd.obsidianmd.plugin.id': 'test-plugin',
      'vnd.obsidianmd.plugin.name': 'Test Plugin',
      'vnd.obsidianmd.plugin.author': 'Test Author',
      'vnd.obsidianmd.plugin.description': 'A test plugin',
      'vnd.obsidianmd.plugin.source': 'https://github.com/testuser/test-plugin',
      'org.opencontainers.image.source': 'https://github.com/testuser/test-plugin',
      'org.opencontainers.image.licenses': 'MIT',
      'vnd.obsidianmd.plugin.min-app-version': '0.15.0',
    };

    const result = ociAnnotationsToFrontmatter(annotations, 'ghcr.io/test/test-plugin');

    expect(result).toEqual({
      id: 'test-plugin',
      name: 'Test Plugin',
      author: 'Test Author',
      description: 'A test plugin',
      repository: 'https://github.com/testuser/test-plugin',
      license: 'MIT',
      minObsidianVersion: '0.15.0',
      registryUrl: 'ghcr.io/test/test-plugin',
    });
  });

  it('should handle optional fields gracefully', () => {
    const annotations = {
      'vnd.obsidianmd.plugin.id': 'minimal-plugin',
      'vnd.obsidianmd.plugin.name': 'Minimal Plugin',
      'vnd.obsidianmd.plugin.author': 'Author',
      'vnd.obsidianmd.plugin.description': 'Description',
      'vnd.obsidianmd.plugin.source': 'https://github.com/author/minimal',
    };

    const result = ociAnnotationsToFrontmatter(annotations, 'ghcr.io/test/minimal-plugin');

    expect(result).toEqual({
      id: 'minimal-plugin',
      name: 'Minimal Plugin',
      author: 'Author',
      description: 'Description',
      repository: 'https://github.com/author/minimal',
      registryUrl: 'ghcr.io/test/minimal-plugin',
    });
  });

  it('should reject invalid annotations', () => {
    const invalid = {
      'vnd.obsidianmd.plugin.id': 'test',
      // Missing required fields
    };

    expect(() => ociAnnotationsToFrontmatter(invalid, 'ghcr.io/test/test')).toThrow();
  });
});

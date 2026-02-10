import { describe, it, expect } from 'vitest';
import { groupVersionsBySha, sortTagsByPriority } from '../version-grouping.js';

describe('sortTagsByPriority', () => {
  it('should prioritize full semver over partial semver', () => {
    const tags = ['latest', '1.2', '1.2.3'];
    const sorted = sortTagsByPriority(tags);

    expect(sorted[0]).toBe('1.2.3'); // Full semver first
  });

  it('should sort full semver versions in descending order', () => {
    const tags = ['1.0.0', '2.0.0', '1.5.0'];
    const sorted = sortTagsByPriority(tags);

    expect(sorted).toEqual(['2.0.0', '1.5.0', '1.0.0']);
  });

  it('should handle mixed tag types correctly', () => {
    const tags = ['latest', '1.2.3', '1.2', '2.0.0', 'beta'];
    const sorted = sortTagsByPriority(tags);

    expect(sorted[0]).toMatch(/^\d+\.\d+\.\d+$/); // Full semver first
    expect(sorted[1]).toMatch(/^\d+\.\d+\.\d+$/); // Another full semver
  });
});

describe('groupVersionsBySha', () => {
  it('should group multiple tags with same SHA', () => {
    const versions = [
      {
        tag: '1.2.3',
        sha: 'sha256:abc123',
        publishedAt: '2024-01-01T00:00:00Z',
        size: 1000,
        annotations: {},
      },
      {
        tag: '1.2',
        sha: 'sha256:abc123', // Same SHA
        publishedAt: '2024-01-01T00:00:00Z',
        size: 1000,
        annotations: {},
      },
      {
        tag: 'latest',
        sha: 'sha256:abc123', // Same SHA
        publishedAt: '2024-01-01T00:00:00Z',
        size: 1000,
        annotations: {},
      },
    ];

    const grouped = groupVersionsBySha(versions);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].canonicalTag).toBe('1.2.3');
    expect(grouped[0].additionalTags).toContain('1.2');
    expect(grouped[0].additionalTags).toContain('latest');
    expect(grouped[0].sha).toBe('sha256:abc123');
  });

  it('should keep versions with different SHAs separate', () => {
    const versions = [
      {
        tag: '1.0.0',
        sha: 'sha256:aaa',
        publishedAt: '2024-01-01T00:00:00Z',
        size: 1000,
        annotations: {},
      },
      {
        tag: '2.0.0',
        sha: 'sha256:bbb',
        publishedAt: '2024-02-01T00:00:00Z',
        size: 2000,
        annotations: {},
      },
    ];

    const grouped = groupVersionsBySha(versions);

    expect(grouped).toHaveLength(2);
    expect(grouped[0].canonicalTag).toBe('2.0.0');
    expect(grouped[1].canonicalTag).toBe('1.0.0');
  });
});

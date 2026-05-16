import { describe, it, expect, vi } from 'vitest';

// Mock astro:content and astro/loaders
vi.mock('astro:content', () => ({
  defineCollection: vi.fn((config) => config)
}));

vi.mock('astro/loaders', () => ({
  glob: vi.fn((config) => config)
}));

import { collections } from '../../src/content.config';

describe('content config', () => {
  it('should define a blog collection', () => {
    expect(collections).toBeDefined();
    expect(collections.blog).toBeDefined();
    expect(collections.blog.loader).toBeDefined();
    expect(collections.blog.schema).toBeDefined();
  });
});

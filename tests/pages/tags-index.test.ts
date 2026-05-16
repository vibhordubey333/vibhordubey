import { describe, it, expect, beforeAll, vi } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import TagsIndexPage from '../../src/pages/tags/index.astro';

// Mock dependencies
vi.mock('../../src/lib/posts', () => ({
  getPublishedPosts: vi.fn().mockResolvedValue([]),
  getTagCollection: vi.fn().mockReturnValue([
    { label: 'Tag 1', slug: 'tag-1', count: 2 },
    { label: 'Tag 2', slug: 'tag-2', count: 1 }
  ]),
  slugifyTag: vi.fn((tag) => tag.toLowerCase().replace(/\s+/g, '-'))
}));

describe('Tags Index Page', () => {
  let container: AstroContainer;

  beforeAll(async () => {
    container = await AstroContainer.create();
  });

  it('renders the tags index page correctly', async () => {
    const result = await container.renderToString(TagsIndexPage);
    
    expect(result).toContain('Topics');
    expect(result).toContain('Tags keep the archive browsable.');
    
    // Check if tags are rendered with counts
    expect(result).toContain('href="/tags/tag-1/"');
    expect(result).toContain('Tag 1');
    expect(result).toContain('2 posts');
    
    expect(result).toContain('href="/tags/tag-2/"');
    expect(result).toContain('Tag 2');
    expect(result).toContain('1 post');
  });
});

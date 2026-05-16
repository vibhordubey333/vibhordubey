import { describe, it, expect, beforeAll, vi } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import TagPage from '../../../src/pages/tags/[tag].astro';

// Mock dependencies
vi.mock('../../src/lib/posts', () => ({
  getPublishedPosts: vi.fn().mockResolvedValue([]),
  getTagCollection: vi.fn().mockReturnValue([
    { label: 'Tag 1', slug: 'tag-1', count: 2 }
  ]),
  getPostsForTag: vi.fn().mockReturnValue([
    {
      id: 'post-1',
      data: {
        title: 'Tagged Post 1',
        description: 'Description 1',
        pubDate: new Date('2023-01-02'),
        tags: ['Tag 1']
      }
    }
  ]),
  getTagLabel: vi.fn().mockReturnValue('Tag 1'),
  formatDate: vi.fn((date) => date.toISOString()),
  slugifyTag: vi.fn((tag) => tag.toLowerCase().replace(/\s+/g, '-'))
}));

describe('Tag Page', () => {
  let container: AstroContainer;

  beforeAll(async () => {
    container = await AstroContainer.create();
  });

  it('renders a specific tag page correctly', async () => {
    const result = await container.renderToString(TagPage, {
      params: {
        tag: 'tag-1'
      }
    });
    
    // Check title
    expect(result).toContain('Tag 1');
    
    // Check if posts are rendered
    expect(result).toContain('Tagged Post 1');
    
    // Check "All tags" link
    // expect(result).toContain('href="/tags/"');
  });

  it('exports getStaticPaths correctly', async () => {
    const { getStaticPaths } = await import('../../../src/pages/tags/[tag].astro');
    const paths = await getStaticPaths();
    expect(paths).toBeDefined();
    expect(paths.length).toBe(1);
    expect(paths[0].params.tag).toBe('tag-1');
  });

  it('renders a specific tag page correctly with empty posts', async () => {
    // Override mock for this test
    vi.mocked(await import('../../li../../s../../src/lib/posts')).getPostsForTag.mockReturnValueOnce([]);
    
    const result = await container.renderToString(TagPage, {
      params: {
        tag: 'tag-1'
      }
    });
    
    expect(result).toContain('Tag 1');
  });
});

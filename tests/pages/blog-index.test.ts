import { describe, it, expect, beforeAll, vi } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import BlogIndexPage from '../../src/pages/blog/index.astro';

// Mock dependencies
vi.mock('../../src/lib/posts', () => ({
  getPublishedPosts: vi.fn().mockResolvedValue([
    {
      id: 'post-1',
      data: {
        title: 'Blog Post 1',
        description: 'Description 1',
        pubDate: new Date('2023-01-02'),
        tags: ['tag1']
      }
    },
    {
      id: 'post-2',
      data: {
        title: 'Blog Post 2',
        description: 'Description 2',
        pubDate: new Date('2023-01-01'),
        tags: ['tag2']
      }
    }
  ]),
  formatDate: vi.fn((date) => date.toISOString()),
  slugifyTag: vi.fn((tag) => tag.toLowerCase().replace(/\s+/g, '-'))
}));

describe('Blog Index Page', () => {
  let container: AstroContainer;

  beforeAll(async () => {
    container = await AstroContainer.create();
  });

  it('renders the blog index page correctly', async () => {
    const result = await container.renderToString(BlogIndexPage);
    
    // Check if posts are rendered
    expect(result).toContain('Blog Post 1');
    expect(result).toContain('Description 1');
    expect(result).toContain('Blog Post 2');
    expect(result).toContain('Description 2');
  });
});

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import IndexPage from '../../src/pages/index.astro';

// Mock dependencies
vi.mock('../../src/lib/posts', () => ({
  getPublishedPosts: vi.fn().mockResolvedValue([
    {
      id: 'post-1',
      data: {
        title: 'Recent Post 1',
        description: 'Description 1',
        pubDate: new Date('2023-01-02'),
        tags: ['tag1']
      }
    },
    {
      id: 'post-2',
      data: {
        title: 'Recent Post 2',
        description: 'Description 2',
        pubDate: new Date('2023-01-01'),
        tags: ['tag2']
      }
    }
  ]),
  formatDate: vi.fn((date) => date.toISOString()),
  slugifyTag: vi.fn((tag) => tag.toLowerCase().replace(/\s+/g, '-'))
}));

describe('Home Page', () => {
  let container: AstroContainer;

  beforeAll(async () => {
    container = await AstroContainer.create();
  });

  it('renders the home page correctly', async () => {
    const result = await container.renderToString(IndexPage);
    
    // Check if AuthorBio is rendered
    expect(result).toContain('Vibhor Dubey');
    
    // Check if recent posts are rendered
    expect(result).toContain('Recent blog posts');
    expect(result).toContain('Recent Post 1');
    expect(result).toContain('Recent Post 2');
  });
});

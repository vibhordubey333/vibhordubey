import { describe, it, expect, beforeAll, vi } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import PostCard from '../../src/components/PostCard.astro';

// Mock dependencies
vi.mock('../../src/lib/posts', () => ({
  formatDate: vi.fn((date) => date.toISOString()),
  slugifyTag: vi.fn((tag) => tag.toLowerCase().replace(/\s+/g, '-'))
}));

describe('PostCard Component', () => {
  let container: AstroContainer;

  beforeAll(async () => {
    container = await AstroContainer.create();
  });

  it('renders post information correctly', async () => {
    const mockPost = {
      id: 'test-post',
      data: {
        title: 'Test Post Title',
        description: 'Test post description',
        pubDate: new Date('2023-01-01T12:00:00Z'),
        tags: ['tag1', 'tag2']
      }
    } as any;

    const result = await container.renderToString(PostCard, {
      props: {
        post: mockPost
      }
    });
    
    expect(result).toContain('href="/blog/test-post/"');
    expect(result).toContain('Test Post Title');
    expect(result).toContain('Test post description');
    
    // Should render tags
    expect(result).toContain('tag1');
    expect(result).toContain('tag2');
    
    // Should render formatted date (exact format depends on locale)
    expect(result).toMatch(/2023/);
  });
});

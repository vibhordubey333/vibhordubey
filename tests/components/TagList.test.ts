import { describe, it, expect, beforeAll, vi } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import TagList from '../../src/components/TagList.astro';

// Mock dependencies
vi.mock('../../src/lib/posts', () => ({
  slugifyTag: vi.fn((tag) => tag.toLowerCase().replace(/\s+/g, '-'))
}));

describe('TagList Component', () => {
  let container: AstroContainer;

  beforeAll(async () => {
    container = await AstroContainer.create();
  });

  it('renders a list of tags correctly', async () => {
    const tags = ['tag1', 'tag2'];
    const result = await container.renderToString(TagList, {
      props: {
        tags
      }
    });
    
    expect(result).toContain('href="/tags/tag1/"');
    expect(result).toContain('tag1');
    expect(result).toContain('href="/tags/tag2/"');
    expect(result).toContain('tag2');
  });

  it('handles empty tags array', async () => {
    const result = await container.renderToString(TagList, {
      props: {
        tags: []
      }
    });
    
    // Should render the container but no tag links
    expect(result).toContain('class="tag-list"');
    expect(result).not.toContain('href="/tags/');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../../src/pages/rss.xml';
import { getPublishedPosts } from '../../src/lib/posts';

// Mock dependencies
vi.mock('@astrojs/rss', () => ({
  default: vi.fn((config) => {
    return new Response(JSON.stringify(config), {
      status: 200,
      headers: {
        'Content-Type': 'application/xml'
      }
    });
  })
}));

vi.mock('../../src/lib/posts', () => ({
  getPublishedPosts: vi.fn()
}));

vi.mock('../../src/lib/url', () => ({
  withBase: vi.fn((path) => `/base${path}`),
  absoluteUrl: vi.fn((path, site) => `${site}/base${path}`)
}));

describe('rss.xml endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate an RSS feed with published posts', async () => {
    const mockPosts = [
      {
        id: 'post-1',
        data: {
          title: 'Post 1',
          description: 'Description 1',
          pubDate: new Date('2023-01-01'),
          tags: ['tag1', 'tag2']
        }
      },
      {
        id: 'post-2',
        data: {
          title: 'Post 2',
          description: 'Description 2',
          pubDate: new Date('2023-01-02'),
          tags: ['tag3']
        }
      }
    ];

    vi.mocked(getPublishedPosts).mockResolvedValue(mockPosts as any);

    const mockContext = {
      site: new URL('https://example.com')
    } as any;

    const response = await GET(mockContext);
    const data = await response.json();

    expect(data.title).toBeDefined();
    expect(data.description).toBeDefined();
    expect(data.site).toBe('https://example.com//base/');
    expect(data.stylesheet).toBe('/base/rss/styles.xsl');
    
    expect(data.items).toHaveLength(2);
    expect(data.items[0].title).toBe('Post 1');
    expect(data.items[0].link).toBe('/base/blog/post-1/');
    expect(data.items[0].categories).toEqual(['tag1', 'tag2']);
    
    expect(data.customData).toContain('<language>en-us</language>');
  });

  it('should use siteConfig.origin if context.site is not provided', async () => {
    vi.mocked(getPublishedPosts).mockResolvedValue([] as any);

    const mockContext = {} as any;

    const response = await GET(mockContext);
    const data = await response.json();

    expect(data.site).toContain('vibhordubey333.github.io');
  });
});

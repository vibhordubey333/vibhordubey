import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sortPosts,
  getPublishedPosts,
  slugifyTag,
  getTagCollection,
  getPostsForTag,
  getTagLabel,
  formatDate
} from '../../s../../src/lib/posts';
import type { BlogEntry } from '../../s../../src/lib/posts';

// Mock astro:content
vi.mock('astro:content', () => ({
  getCollection: vi.fn()
}));

import { getCollection } from 'astro:content';

describe('posts utilities', () => {
  const mockPosts: BlogEntry[] = [
    {
      id: 'post-1',
      slug: 'post-1',
      body: '',
      collection: 'blog',
      data: {
        title: 'B Post',
        description: 'Description 1',
        pubDate: new Date('2023-01-02'),
        tags: ['Tag 1', 'Tag 2'],
        draft: false
      }
    },
    {
      id: 'post-2',
      slug: 'post-2',
      body: '',
      collection: 'blog',
      data: {
        title: 'A Post',
        description: 'Description 2',
        pubDate: new Date('2023-01-02'), // Same date as post-1 to test title sorting
        tags: ['Tag 2', 'Tag 3 & 4'],
        draft: false
      }
    },
    {
      id: 'post-3',
      slug: 'post-3',
      body: '',
      collection: 'blog',
      data: {
        title: 'C Post',
        description: 'Description 3',
        pubDate: new Date('2023-01-01'),
        tags: ['Tag 1'],
        draft: true
      }
    }
  ] as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sortPosts', () => {
    it('should sort posts by date descending, then by title ascending', () => {
      const sorted = sortPosts(mockPosts);
      expect(sorted[0].id).toBe('post-2'); // A Post (same date, earlier title)
      expect(sorted[1].id).toBe('post-1'); // B Post (same date, later title)
      expect(sorted[2].id).toBe('post-3'); // C Post (earlier date)
    });
  });

  describe('getPublishedPosts', () => {
    it('should fetch and sort published posts', async () => {
      vi.mocked(getCollection).mockImplementation(async (collection, filter) => {
        // Mock the filter behavior
        if (filter) {
          return mockPosts.filter(post => filter(post));
        }
        return mockPosts;
      });

      // Mock import.meta.env.DEV to be false
      process.env.DEV = '';

      const posts = await getPublishedPosts();
      
      expect(getCollection).toHaveBeenCalledWith('blog', expect.any(Function));
      expect(posts.length).toBe(2); // Should exclude the draft post
      expect(posts[0].id).toBe('post-2');
      expect(posts[1].id).toBe('post-1');
    });

    it('should include drafts in DEV environment', async () => {
      vi.mocked(getCollection).mockImplementation(async (collection, filter) => {
        if (filter) {
          return mockPosts.filter(post => filter(post));
        }
        return mockPosts;
      });

      // Mock import.meta.env.DEV to be true
      process.env.DEV = 'true';

      const posts = await getPublishedPosts();
      
      expect(posts.length).toBe(3); // Should include all posts
    });
  });

  describe('slugifyTag', () => {
    it('should slugify tags correctly', () => {
      expect(slugifyTag('Tag 1')).toBe('tag-1');
      expect(slugifyTag('Tag 3 & 4')).toBe('tag-3-and-4');
      expect(slugifyTag('  Extra Spaces  ')).toBe('extra-spaces');
      expect(slugifyTag('Special!@#Chars')).toBe('special-chars');
      expect(slugifyTag('---Dashes---')).toBe('dashes');
    });
  });

  describe('getTagCollection', () => {
    it('should return a sorted collection of tags with counts', () => {
      const tags = getTagCollection(mockPosts);
      
      expect(tags).toHaveLength(3);
      
      expect(tags[0]).toEqual({ label: 'Tag 1', slug: 'tag-1', count: 2 });
      expect(tags[1]).toEqual({ label: 'Tag 2', slug: 'tag-2', count: 2 });
      expect(tags[2]).toEqual({ label: 'Tag 3 & 4', slug: 'tag-3-and-4', count: 1 });
    });
  });

  describe('getPostsForTag', () => {
    it('should return sorted posts for a specific tag slug', () => {
      const tag1Posts = getPostsForTag(mockPosts, 'tag-1');
      expect(tag1Posts).toHaveLength(2);
      expect(tag1Posts[0].id).toBe('post-1');
      expect(tag1Posts[1].id).toBe('post-3');

      const tag3Posts = getPostsForTag(mockPosts, 'tag-3-and-4');
      expect(tag3Posts).toHaveLength(1);
      expect(tag3Posts[0].id).toBe('post-2');

      const emptyPosts = getPostsForTag(mockPosts, 'non-existent');
      expect(emptyPosts).toHaveLength(0);
    });
  });

  describe('getTagLabel', () => {
    it('should return the original label for a tag slug', () => {
      expect(getTagLabel(mockPosts, 'tag-1')).toBe('Tag 1');
      expect(getTagLabel(mockPosts, 'tag-3-and-4')).toBe('Tag 3 & 4');
      expect(getTagLabel(mockPosts, 'non-existent')).toBeUndefined();
    });
  });

  describe('formatDate', () => {
    it('should format date according to site config locale', () => {
      const date = new Date('2023-01-02T12:00:00Z');
      const formatted = formatDate(date);
      
      // The exact format depends on the environment's Intl implementation,
      // but it should contain the day, month, and year
      expect(formatted).toMatch(/2/);
      expect(formatted).toMatch(/Jan/);
      expect(formatted).toMatch(/2023/);
    });
  });
});

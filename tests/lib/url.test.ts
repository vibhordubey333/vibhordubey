import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withBase, absoluteUrl } from '../../src/lib/url';
import siteConfig from '../../src/config/site';

// Mock process.env
beforeEach(() => {
  process.env.BASE_URL = '/base/';
});

describe('url utilities', () => {
  describe('withBase', () => {
    it('should return the path as is if it is an absolute URL', () => {
      expect(withBase('https://example.com')).toBe('https://example.com');
      expect(withBase('http://example.com/path')).toBe('http://example.com/path');
    });

    it('should prepend base URL to a relative path', () => {
      expect(withBase('/path')).toBe('/base/path');
      expect(withBase('path')).toBe('/base/path');
    });

    it('should handle root path correctly', () => {
      expect(withBase('/')).toBe('/base');
    });

    it('should handle default parameter', () => {
      expect(withBase()).toBe('/base');
    });

    it('should handle empty base URL', () => {
      process.env.BASE_URL = '';
      expect(withBase('/path')).toBe('/path');
      expect(withBase('/')).toBe('/');
      
      // Reset mock
      process.env.BASE_URL = '/base/';
    });
  });

  describe('absoluteUrl', () => {
    it('should return an absolute URL using siteConfig.origin by default', () => {
      expect(absoluteUrl('/path')).toBe(`${siteConfig.origin}/base/path`);
    });

    it('should return an absolute URL using a custom site', () => {
      expect(absoluteUrl('/path', 'https://custom.com')).toBe('https://custom.com/base/path');
    });

    it('should handle default parameters', () => {
      expect(absoluteUrl()).toBe(`${siteConfig.origin}/base`);
    });
  });
});

import { describe, it, expect } from 'vitest';
import siteConfig from '../../src/config/site';

describe('site config', () => {
  it('should export a valid configuration object', () => {
    expect(siteConfig).toBeDefined();
    expect(siteConfig.title).toBeTypeOf('string');
    expect(siteConfig.description).toBeTypeOf('string');
    expect(siteConfig.origin).toBeTypeOf('string');
    expect(siteConfig.locale).toBeTypeOf('string');
    expect(siteConfig.dateLocale).toBeTypeOf('string');
    expect(siteConfig.themeColors).toBeDefined();
    expect(siteConfig.themeColors.light).toBeTypeOf('string');
    expect(siteConfig.themeColors.dark).toBeTypeOf('string');
  });
});

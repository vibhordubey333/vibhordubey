import { describe, it, expect, beforeAll } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import SyndicationLinks from '../../src/components/SyndicationLinks.astro';

describe('SyndicationLinks Component', () => {
  let container: AstroContainer;

  beforeAll(async () => {
    container = await AstroContainer.create();
  });

  it('renders nothing when links array is empty', async () => {
    const result = await container.renderToString(SyndicationLinks, {
      props: {
        links: []
      }
    });
    
    // The component should return nothing (or just whitespace)
    expect(result.trim()).toBe('');
  });

  it('renders links correctly when provided', async () => {
    const links = [
      { platform: 'Twitter', url: 'https://twitter.com/example' },
      { platform: 'GitHub', url: 'https://github.com/example' }
    ];
    
    const result = await container.renderToString(SyndicationLinks, {
      props: {
        links
      }
    });
    
    expect(result).toContain('Syndicated to');
    expect(result).toContain('href="https://twitter.com/example"');
    expect(result).toContain('Twitter');
    expect(result).toContain('href="https://github.com/example"');
    expect(result).toContain('GitHub');
  });
});

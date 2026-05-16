import { describe, it, expect, beforeAll } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import BaseLayout from '../../src/layouts/BaseLayout.astro';
import siteConfig from '../../src/config/site';

describe('BaseLayout', () => {
  let container: AstroContainer;

  beforeAll(async () => {
    container = await AstroContainer.create();
  });

  it('renders the layout structure correctly', async () => {
    const result = await container.renderToString(BaseLayout, {
      props: {
        title: 'Test Page',
        description: 'Test Description'
      },
      slots: {
        default: '<main>Test Content</main>'
      }
    });

    // Check HTML structure
    expect(result).toContain('<html lang="en"');
    
    // Check Head component integration
    expect(result).toContain('<title>Test Page |');
    expect(result).toContain('content="Test Description"');
    
    // Check Header
    expect(result).toContain(siteConfig.title);
    expect(result).toContain('href="/"');
    expect(result).toContain('href="/blog/"');
    expect(result).toContain('href="/about/"');
    
    // Check Content
    expect(result).toContain('<main>Test Content</main>');
    
    // Check Footer
    expect(result).toContain('Vibhor Dubey');
    expect(result).toContain('href="/rss.xml"');
  });

  it('passes optional props to Head component', async () => {
    const publishedTime = new Date('2023-01-01T12:00:00Z');
    
    const result = await container.renderToString(BaseLayout, {
      props: {
        title: 'Article Page',
        type: 'article',
        publishedTime,
        noindex: true
      }
    });

    expect(result).toContain('content="article"');
    expect(result).toContain('content="noindex,nofollow"');
    expect(result).toContain(publishedTime.toISOString());
  });
});

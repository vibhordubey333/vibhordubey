import { describe, it, expect, beforeAll } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Head from '../../src/components/Head.astro';
import siteConfig from '../../src/config/site';

describe('Head Component', () => {
  let container: AstroContainer;

  beforeAll(async () => {
    container = await AstroContainer.create();
  });

  it('renders default metadata correctly', async () => {
    const result = await container.renderToString(Head);
    
    expect(result).toContain('<meta charset="utf-8">');
    expect(result).toContain(`<title>${siteConfig.title}</title>`);
    expect(result).toContain(`<meta name="description" content="${siteConfig.description}">`);
    expect(result).toContain(`<link rel="canonical" href="${siteConfig.origin}/">`);
    expect(result).toContain('<meta property="og:type" content="website">');
    expect(result).not.toContain('<meta name="robots"');
    expect(result).not.toContain('<meta property="article:published_time"');
  });

  it('renders custom title and site name correctly', async () => {
    const result = await container.renderToString(Head, {
      props: {
        title: 'Custom Page'
      }
    });
    
    expect(result).toContain(`<title>Custom Page | ${siteConfig.title}</title>`);
  });

  it('renders article metadata when type is article', async () => {
    const publishedTime = new Date('2023-01-01T12:00:00Z');
    const modifiedTime = new Date('2023-01-02T12:00:00Z');
    
    const result = await container.renderToString(Head, {
      props: {
        type: 'article',
        publishedTime,
        modifiedTime,
        tags: ['tag1', 'tag2']
      }
    });
    
    expect(result).toContain('<meta property="og:type" content="article">');
    expect(result).toContain(`<meta property="article:published_time" content="${publishedTime.toISOString()}">`);
    expect(result).toContain(`<meta property="article:modified_time" content="${modifiedTime.toISOString()}">`);
    expect(result).toContain('<meta property="article:tag" content="tag1">');
    expect(result).toContain('<meta property="article:tag" content="tag2">');
  });

  it('renders noindex meta tag when specified', async () => {
    const result = await container.renderToString(Head, {
      props: {
        noindex: true
      }
    });
    
    expect(result).toContain('<meta name="robots" content="noindex,nofollow">');
  });

  it('renders JSON-LD blocks correctly', async () => {
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Person",
      "name": "John Doe"
    };
    
    const result = await container.renderToString(Head, {
      props: {
        jsonLd
      }
    });
    
    expect(result).toContain('<script type="application/ld+json">{"@context":"https://schema.org","@type":"Person","name":"John Doe"}</script>');
  });

  it('handles multiple JSON-LD blocks', async () => {
    const jsonLd = [
      { "@type": "Person", "name": "John" },
      { "@type": "Organization", "name": "Acme" }
    ];
    
    const result = await container.renderToString(Head, {
      props: {
        jsonLd
      }
    });
    
    expect(result).toContain('{"@type":"Person","name":"John"}');
    expect(result).toContain('{"@type":"Organization","name":"Acme"}');
  });
});

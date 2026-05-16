import { describe, it, expect, beforeAll } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import AuthorBio from '../../src/components/AuthorBio.astro';
import siteConfig from '../../src/config/site';

describe('AuthorBio Component', () => {
  let container: AstroContainer;

  beforeAll(async () => {
    container = await AstroContainer.create();
  });

  it('renders author information correctly', async () => {
    const result = await container.renderToString(AuthorBio);
    
    expect(result).toContain('Vibhor Dubey');
    
    // Check if social links are rendered
    // expect(result).toContain('href="https://github.com/vibhordubey333"');
    // expect(result).toContain('GitHub');
  });
});

import { describe, it, expect, beforeAll } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import AboutPage from '../../src/pages/about.astro';

describe('About Page', () => {
  let container: AstroContainer;

  beforeAll(async () => {
    container = await AstroContainer.create();
  });

  it('renders the about page correctly', async () => {
    const result = await container.renderToString(AboutPage);
    
    expect(result).toContain('About');
    expect(result).toContain('I am a Software Engineer');
    
    // Check if AuthorBio is rendered
    expect(result).toContain('Vibhor Dubey');
  });
});

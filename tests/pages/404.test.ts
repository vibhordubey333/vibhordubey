import { describe, it, expect, beforeAll } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import NotFoundPage from '../../src/pages/404.astro';

describe('404 Page', () => {
  let container: AstroContainer;

  beforeAll(async () => {
    container = await AstroContainer.create();
  });

  it('renders the 404 page correctly', async () => {
    const result = await container.renderToString(NotFoundPage);
    
    expect(result).toContain('404');
    expect(result).toContain('Page not found');
    expect(result).toContain('The page you were looking for does not exist.');
    expect(result).toContain('href="/"');
    expect(result).toContain('Return home');
  });
});

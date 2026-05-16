import { describe, it, expect, beforeAll } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Prose from '../../src/components/Prose.astro';

describe('Prose Component', () => {
  let container: AstroContainer;

  beforeAll(async () => {
    container = await AstroContainer.create();
  });

  it('renders children within a prose container', async () => {
    const result = await container.renderToString(Prose, {
      slots: {
        default: '<p>Test content</p>'
      }
    });
    
    expect(result).toContain('class="prose');
    expect(result).toContain('<p>Test content</p>');
  });
});

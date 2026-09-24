// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import html from '../index.html?raw';

// The real map needs WebGL and never fires `load` here, which is exactly the
// window the deep-link restore has to handle before the basemap arrives.
vi.mock('maplibre-gl', () => {
  class Map {
    addControl() {}
    on() {}
  }
  class Control {}
  return { default: { Map, NavigationControl: Control, AttributionControl: Control } };
});

async function boot(search: string) {
  document.body.innerHTML = new DOMParser().parseFromString(html, 'text/html').body.innerHTML;
  window.history.replaceState(null, '', `/${search}`);
  vi.resetModules();
  await import('./main.js');
  return document.querySelector<HTMLElement>('#hint')!;
}

describe('deep-link restore', () => {
  beforeEach(() => {
    window.matchMedia = () => ({ matches: false }) as MediaQueryList;
  });

  it('hides the click hint when the link sets both ends', async () => {
    const hint = await boot('?from=CNSHA&to=NLRTM');
    expect(hint.classList.contains('hidden')).toBe(true);
    expect(document.querySelector<HTMLInputElement>('#origin')!.value).toBe('Shanghai, China (CNSHA)');
  });

  it('asks for B when the link sets only A', async () => {
    const hint = await boot('?from=CNSHA');
    expect(hint.classList.contains('hidden')).toBe(false);
    expect(hint.textContent).toBe('Click again to set B (destination)');
  });

  it('asks for A on a plain visit', async () => {
    const hint = await boot('');
    expect(hint.classList.contains('hidden')).toBe(false);
    expect(hint.textContent).toBe('Click the map to set A (origin)');
  });
});

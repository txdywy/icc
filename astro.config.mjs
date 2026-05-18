import tailwind from '@astrojs/tailwind';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://example.github.io',
  integrations: [tailwind()],
  output: 'static',
});

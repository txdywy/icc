import tailwind from '@astrojs/tailwind';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://txdywy.github.io',
  base: '/icc',
  integrations: [tailwind()],
  output: 'static',
});

// @ts-check

import cloudflare from '@astrojs/cloudflare';
import markdoc from '@astrojs/markdoc';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import keystatic from '@keystatic/astro';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://exemigrantai.lt',
  output: 'static',
  adapter: cloudflare({
    imageService: 'compile',
  }),
  integrations: [react(), markdoc(), keystatic(), sitemap()],

  build: {
    inlineStylesheets: 'always',
  },

  vite: {
    plugins: [tailwindcss()],
  },
});

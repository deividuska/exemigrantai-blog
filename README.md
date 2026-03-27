# Eks Emigrantai

Astro 5 blog for `https://exemigrantai.lt`, now using Keystatic Cloud and local Astro content instead of WordPress as a runtime backend.

## Stack

- Astro 5
- Keystatic Cloud
- Astro content collections
- Markdoc (`.mdoc`) post content
- Cloudflare adapter
- Tailwind CSS 4

## Content

- Posts live in `src/content/posts/*/index.mdoc`
- Site settings live in `src/content/settings/index.yaml`
- Post images live in `src/assets/images/posts`

Keystatic Cloud is already connected in [keystatic.config.ts](./keystatic.config.ts) with project key:

`solid-digital/exemigrantai-blog`

## Commands

```sh
npm install
npm run dev
npm run build
npm run import:wordpress
```

## Cloudflare Pages

This repo is currently safe to deploy through your existing Cloudflare Pages dashboard setup.

Important:

- Do not hand-write a production `wrangler.jsonc` for this existing Pages project unless you want the file to become the new source of truth.
- Cloudflare’s current Pages docs recommend downloading the existing dashboard config first:

```sh
npx wrangler pages download config emigrantai-blog
```

- Review that generated file before committing it.

### Session binding

The Astro Cloudflare adapter in this repo may expect a KV binding named `SESSION` for session storage.

If your deployed site ever reports a missing `SESSION` binding, add a KV namespace binding in Cloudflare Pages or in a downloaded `wrangler.jsonc`:

```json
{
  "kv_namespaces": [
    {
      "binding": "SESSION",
      "id": "<your-kv-namespace-id>"
    }
  ]
}
```

## Safe config template

A non-active template is included at [wrangler.pages.example.jsonc](./wrangler.pages.example.jsonc).

It is intentionally not named `wrangler.jsonc`, so it does not take over your existing Pages configuration by accident.

## Migration notes

- WordPress runtime fetching has been removed.
- 12 posts were imported from `exemigrantailt.WordPress.2026-03-27.xml`.
- Featured images were downloaded into local repo assets.
- The import script excludes trashed placeholder posts.

# CLAUDE.md

Reference document for Claude sessions in this repo. Everything below was verified by reading the actual files — no guesses. Update this file whenever something changes that future-you would otherwise have to re-derive.

---

## 0. WORKING ENVIRONMENT (READ FIRST — THIS BURNS TIME OTHERWISE)

- **The user's dev server runs from the main repo at `C:\Users\ISO-NEW\Desktop\New folder (14)`**, served on `http://127.0.0.1:4321`. It is normally already running — do **not** try to `npm run dev` or you'll hit `EADDRINUSE`.
- Claude Code worktrees live under `.claude/worktrees/<name>/` and are on separate branches. **Uncommitted work in the main repo is invisible from a worktree.** If a feature seems missing, check the main repo first:

  ```bash
  git -C "/c/Users/ISO-NEW/Desktop/New folder (14)" status -uall
  ```

- When a fix needs to be visible in the user's browser immediately, **edit files in the main repo path**, not the worktree. The dev server hot-reloads from the main repo only.
- Windows machine. In bash, use forward-slash paths and quote `"New folder (14)"` (parens are shell metacharacters). PowerShell tool also available.
- To inspect what's actually rendered, hit the dev server:

  ```bash
  curl -s http://127.0.0.1:4321/blog/<slug>/ > /tmp/page.html
  ```

---

## 1. TECH STACK

From [package.json](package.json) and [astro.config.mjs](astro.config.mjs):

- **Astro 5.16.x**, `output: 'static'`, site `https://exemigrantai.lt`
- **Adapter:** `@astrojs/cloudflare` (`imageService: 'compile'`) — deploys to Cloudflare Pages
- **Integrations:** `@astrojs/react`, `@astrojs/markdoc`, `@keystatic/astro`, `@astrojs/sitemap`
- **Styling:** Tailwind CSS 4 (via `@tailwindcss/vite`) + hand-written CSS in `src/styles/global.css`. Components also use scoped Astro `<style>` blocks.
- **CMS:** Keystatic Cloud project `solid-digital/exemigrantai-blog` (see [keystatic.config.ts](keystatic.config.ts))
- **Build:** `inlineStylesheets: 'always'` — all CSS is inlined into HTML
- **No** custom Markdoc config file (no `markdoc.config.{ts,mjs}`), **no** custom remark/rehype plugins. Default Markdoc behavior only.

## 2. COMMANDS

```sh
npm install
npm run dev          # astro dev — but the user usually has this running already
npm run build        # validates content schemas + builds static site
npm run preview
npm run import:wordpress    # scripts/import-wordpress.mjs
npm run normalize:posts     # scripts/normalize-post-frontmatter.mjs
```

## 3. DIRECTORY LAYOUT

```
src/
  assets/images/posts/<slug>/...        # featured + inline post images
  components/
    AffiliateBanner.astro               # affiliate banner card (top/middle/bottom)
    BaseHead.astro                      # SEO/meta/OG/Twitter/AdSense account meta
    Footer.astro
    Header.astro
    PostCard.astro                      # archive/grid card
    ScrollToTop.astro
    StructuredData.astro                # JSON-LD renderer
  content/
    posts/<slug>/index.mdoc             # blog posts (Markdoc)
    settings/index.yaml                 # singleton site settings (incl. affiliateAd)
  lib/
    content.ts                          # post helpers + getSiteSettings()
  pages/
    api/views/[slug].json.ts            # KV-backed view counter (SSR endpoint)
    blog/[slug].astro                   # article page (the big one)
    page/[page].astro                   # /page/2, /page/3, ... archive
    index.astro                         # homepage
    404.astro
    apie-mus.astro
    kontaktai.astro
    privatumo-politika.astro
    redakcine-politika.astro
    rss.xml.js
  styles/global.css
  consts.ts                             # SITE_TITLE, SITE_ALT_NAME, SITE_URL, SITE_DESCRIPTION
  content.config.ts                     # zod schemas for posts + settings collections
public/
  favicon.svg
  robots.txt
scripts/
  import-wordpress.mjs
  normalize-post-frontmatter.mjs
astro.config.mjs
keystatic.config.ts
wrangler.pages.example.jsonc            # NOT active — Pages config lives in CF dashboard
```

Generated/cache dirs to ignore: `.astro/`, `.wrangler/`, `dist/`, `node_modules/`.

## 4. ROUTING

- `/` — homepage (featured post + grid, page 1 of pagination)
- `/page/2`, `/page/3`, … — archive pagination (`POSTS_PER_PAGE = 10` in `lib/content.ts`)
- `/blog/<slug>/` — article page
- `/api/views/<slug>.json` — view counter (GET reads, POST increments)
- `/rss.xml`, `/sitemap-index.xml`
- Static pages: `/apie-mus`, `/kontaktai`, `/redakcine-politika`, `/privatumo-politika`

## 5. CONTENT COLLECTIONS

Defined in [src/content.config.ts](src/content.config.ts).

### `posts` collection (Markdoc)

Frontmatter schema:

```yaml
title: string                  # required
publishedAt: string | Date     # required; strings without TZ are treated as UTC (Z appended)
category: string               # default "Naujienos"
featuredImage: image           # optional, Astro image()
featuredImageAlt: string       # optional
seoTitle: string               # optional
seoDescription: string         # optional
```

Sorting is newest-first via `getAllPosts()` in `lib/content.ts`.

### `settings` collection (data, singleton at `settings/index.yaml`)

```yaml
homepageTitle: string
navigation: [{ label, href }]
facebookGroupUrl: url
footerText: string
affiliateAd:                   # optional
  enabled: boolean
  label: string                # default "Partnerio nuoroda"
  title, description: string
  cta: string                  # default "Sužinoti daugiau"
  url: url
  disclosure, image, imageAlt: string?
  placements: { top: bool, middle: bool, bottom: bool }   # all default true
```

`getSiteSettings()` falls back to `defaultSettings` (with `affiliateAd: undefined`) when the entry is missing.

## 6. BLOG POST RENDERING PIPELINE

[src/pages/blog/[slug].astro](src/pages/blog/%5Bslug%5D.astro):

1. `getStaticPaths()` calls `getAllPosts()` and emits one route per slug.
2. `const { Content } = await post.render()` — Astro Markdoc renders the body.
3. Settings are loaded once via `getSiteSettings()` for the affiliate ad.
4. Hero section: backlink, category eyebrow, title, generated excerpt, formatted date, reading time, view counter span, featured image.
5. Article panel renders, in order:
   - `<AffiliateBanner placement="top">`
   - `<div class="article-prose prose"><Content /></div>`
   - `<div data-middle-affiliate-slot><AffiliateBanner placement="middle" compact /></div>`
   - `<AffiliateBanner placement="bottom">`
   - inline view-counter `<script define:vars={{ slug }}>` (POSTs to `/api/views/<slug>.json`)
   - inline `<script is:inline>` that repositions the middle slot

### Critical Markdoc rendering shape (this is the bug-magnet)

`<Content />` from Markdoc emits roughly:

```html
<div class="article-prose prose">
  <article>          ← single wrapping element
    <p>...</p>
    <h2>...</h2>
    <ul>...</ul>
    <table>...</table>
    ...
  </article>
</div>
```

`.article-prose`'s **only direct child is `<article>`**. Any client-side script that walks the rendered post body must descend into that wrapper:

```js
const proseRoot = prose.querySelector('article') || prose;
```

Filtering `prose.children` for `P/H2/UL/...` directly returns an empty array and silently breaks (this is exactly the bug we fixed in the middle-banner placement script).

### Markdoc table syntax used in posts

```mdoc
{% table %}
- Col A
- Col B
---
- Row A1
- Row B1
{% /table %}
```

Renders as a normal `<table><thead>...<tbody>...</table>` with no extra classes.

## 7. AFFILIATE BANNER SYSTEM

Component: [src/components/AffiliateBanner.astro](src/components/AffiliateBanner.astro).
Data: `affiliateAd` block in [src/content/settings/index.yaml](src/content/settings/index.yaml).
Schema: `settings` collection in [src/content.config.ts](src/content.config.ts).
Rendered from: [src/pages/blog/[slug].astro](src/pages/blog/%5Bslug%5D.astro).

### Component behavior

Renders nothing unless **all** of these are true:

- `ad.enabled === true`
- `ad.url`, `ad.title`, `ad.description` all present
- `ad.placements?.[placement] !== false`

Output: `<aside class="affiliate-banner affiliate-banner-{placement} [compact]">` with label, h2, description, optional disclosure, optional image, and a CTA `<a target="_blank" rel="sponsored noopener noreferrer">`. Styles are scoped via Astro CSS (`data-astro-cid-…`), not in `global.css`.

### Three placements

| Placement | Where it's rendered in the template | Final position |
|-----------|-------------------------------------|----------------|
| `top`     | Above `.article-prose` | Top of article body (static) |
| `middle`  | Inside `<div data-middle-affiliate-slot>` between `.article-prose` and the bottom banner | **Moved by client JS** to mid-article |
| `bottom`  | After the middle slot div | End of article body (static) |

### Middle-banner repositioning script (`<script is:inline>`)

Walks `<article>` inside `.article-prose`, filters direct children for `P/H2/H3/UL/OL/TABLE`, picks `Math.min(Math.max(4, Math.floor(blocks.length * 0.45)), blocks.length - 1)`, and calls `target.after(middleAffiliateSlot)`.

If anything goes wrong (no prose, empty slot, no matching blocks) the script returns early and the slot stays where it was rendered — which means **all three banners pile up at the end of the article** (top stays at top; middle + bottom both at the bottom). That's the visual signature of a broken middle placement.

## 8. VIEW COUNTER

[src/pages/api/views/[slug].json.ts](src/pages/api/views/%5Bslug%5D.json.ts):

- `prerender = false` (SSR endpoint, runs on Cloudflare).
- Reads from `locals.runtime.env.VIEW_COUNTS` (falling back to `SESSION`) — a **Cloudflare KV namespace**. If neither binding exists (e.g. local `astro dev` without bindings), responds `{ enabled: false, count: null }` and the UI silently hides the count.
- Slug is sanitized to `[a-z0-9-]{,160}`.
- KV key shape: `views:<slug>`. POST increments + writes back; GET reads.
- The article template POSTs on every page load — there's no dedup/anti-bot.

## 9. SEO / METADATA

[src/components/BaseHead.astro](src/components/BaseHead.astro):

- `<title>`, meta title/description, robots `index,follow` (default), canonical from `Astro.url.pathname` + `Astro.site`, OG, Twitter cards, RSS + sitemap links, favicon.
- Includes `<meta name="google-adsense-account" content="ca-pub-8209467117735544">` — **the AdSense script itself is not loaded**, only the account verification meta tag.

Article SEO in `blog/[slug].astro`:

- `seoTitle = post.data.seoTitle || post.data.title`
- `seoDescription = post.data.seoDescription || getPostExcerpt(post)`
- OG/Twitter image = featured image when present
- Adds `<meta property="article:published_time">` and JSON-LD `BlogPosting` (headline, description, datePublished, mainEntityOfPage, url, inLanguage `lt`, articleSection, image, publisher)

Homepage emits JSON-LD `WebSite` + `Organization` (with `sameAs: [facebookGroupUrl]`).

## 10. SITE CHROME & DESIGN

- [Header.astro](src/components/Header.astro): brand block ("EE" mark + `SITE_TITLE` + tagline), navigation from `settings.navigation`, mobile menu, mail icon, Facebook icon.
- [Footer.astro](src/components/Footer.astro): label, copyright with `settings.footerText`, links to `/apie-mus`, `/redakcine-politika`, `/kontaktai`, `/privatumo-politika`, and a Facebook group CTA.
- [ScrollToTop.astro](src/components/ScrollToTop.astro): floating "back to top" button.

Global classes (from `src/styles/global.css`): `.page-shell`, `.content-panel`, `.eyebrow`, `.section-title`, `.section-subtitle`, `.pill-link`, `.prose`. CSS variables (`--bg`, `--surface`, `--surface-ink`, `--text`, `--text-soft`, `--text-faint`, `--accent`, `--accent-deep`, `--border`, `--radius-md/lg/xl`, `--shadow`, `--shadow-soft`, `--font-serif` Fraunces, `--font-sans` Manrope) are defined near the top of that file.

## 11. IMAGES

- Frontmatter uses `@assets/images/posts/<slug>/featuredImage.<ext>` (alias resolved via `tsconfig.json` paths).
- Keystatic uploads land in `src/assets/images/posts/` with public path `@assets/images/posts/`.
- Article hero + cards use Astro `<Image>` for optimization (responsive `widths`, `sizes`, `quality`).

## 12. CONTENT VOICE (when writing or editing posts)

Lithuanian, plain/practical/calm. Aimed at real emigrants, not specialists. Typical structure:

1. Bold opening paragraph stating the problem
2. Short answer
3. Sources/date sentence (`Šis straipsnis parengtas remiantis oficialiais ... šaltiniais, patikrintais YYYY m. <mėn> <d> d.`)
4. `##` sections phrased as reader questions or concrete tasks
5. Bulleted checklists; numbered lists for step-by-step
6. Markdoc `{% table %}` for quick references
7. `Ką svarbiausia prisiminti?` summary
8. `Oficialūs šaltiniai`
9. `Svarbi pastaba` disclaimer (for legal/tax/benefits/immigration topics)

Use inline code for document/form names: `P45`, `P60`, `P85`, `PDU1`, `Self Assessment`.

## 13. DEPLOYMENT

- README: deploy via the existing Cloudflare Pages dashboard project — don't hand-write a new `wrangler.jsonc`.
- The Cloudflare adapter may want a KV binding named `SESSION` (and `VIEW_COUNTS` for the view counter) — if session-storage errors appear at runtime, that's why.

## 14. GOTCHAS CHEAT SHEET

- Dev server lives in the main repo, not the worktree → check `git -C` on main before declaring a feature missing.
- Markdoc wraps post content in `<article>` → descend through it before scanning children.
- `<script is:inline>` is preserved verbatim by Astro; runs in the page's parse order, queues `DOMContentLoaded` if `readyState === 'loading'`.
- `output: 'static'` + `prerender = false` on `api/views/[slug].json.ts` means that single endpoint is the only SSR surface — it requires Cloudflare KV bindings to actually return counts.
- `affiliate-banner`, `affiliate-banner-{top,middle,bottom}`, `affiliate-cta`, etc. are **scoped** to `AffiliateBanner.astro` — don't expect to find them in `global.css`.
- PowerShell brackets in paths (`[slug].astro`, `[page].astro`) need `-LiteralPath`.
- Avoid `2>&1` on native exes in PowerShell 5.1 — wraps stderr as ErrorRecords and flips `$?` to false.

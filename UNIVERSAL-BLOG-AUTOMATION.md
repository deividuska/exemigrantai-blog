# Universal AI Blog Automation Instructions

Use this file as a reusable brief for creating an automated blog-post generator in any content website. The goal is to build a scheduled GitHub Actions workflow that generates one useful blog post, validates it, writes it into the existing content structure, commits it, and lets the normal hosting/deployment pipeline publish it.

This guide is written for a future developer or AI coding agent. Before writing code, inspect the target project and adapt everything to the existing blog style, file format, content schema, and deployment flow.

---

## 1. End Goal

Create an automation with this flow:

```text
GitHub Actions schedule
  -> Node generator script
  -> AI model writes one article
  -> script validates article
  -> script writes a new content file
  -> workflow commits and pushes
  -> host rebuilds/deploys normally
```

The automation should:

- Run on a fixed schedule, for example weekdays at `06:00 UTC`.
- Also support manual runs from the GitHub Actions UI.
- Use a repository secret for the API key.
- Read existing posts before generating.
- Match the project's current blog structure and writing style.
- Avoid duplicate or near-duplicate topics.
- Validate article length, required sections, links, title, slug, and formatting.
- Write only complete, safe, buildable content.
- Commit only generated post files.

---

## 2. First Inspect The Project

Do not start by copying code blindly. First inspect the site.

Find:

- Blog content directory, for example:
  - `src/content/posts`
  - `content/blog`
  - `src/pages/blog`
  - `posts`
- Existing post file type:
  - `.md`
  - `.mdx`
  - `.mdoc`
  - `.astro`
  - JSON/YAML content files
- Existing frontmatter schema:
  - `title`
  - `publishedAt` or `date`
  - `category`
  - `tags`
  - `featuredImage`
  - `seoTitle`
  - `seoDescription`
  - `description`
  - `draft`
- Existing slug style:
  - folder slug with `index.md`
  - single file `slug.md`
  - route generated from frontmatter
- Existing image handling:
  - shared default hero
  - per-post image
  - no image
  - CMS-controlled image field
- Existing blog tone:
  - formal or casual
  - short or long posts
  - first person or neutral
  - language
  - heading style
  - whether FAQ/conclusion sections are normal
- Existing internal-link style.
- Build/deploy process:
  - GitHub Pages
  - Cloudflare Pages
  - Vercel
  - Netlify
  - custom CI

Recommended discovery commands:

```bash
rg --files
rg -n "title:|publishedAt:|date:|seoTitle:|description:|category:" .
rg -n "content/posts|content/blog|defineCollection|frontmatter|slug" .
```

For this repo-style automation, prefer a dependency-free Node script using built-in `fetch`.

---

## 3. Files To Create

Create these files unless the project already has equivalents:

```text
scripts/generate-post.mjs
.github/workflows/daily-post.yml
```

Optional:

```text
src/assets/images/posts/default-hero.png
docs/blog-automation.md
```

The generator script owns content creation and validation. The workflow owns scheduling, secrets, and committing.

---

## 4. GitHub Actions Workflow

Create `.github/workflows/daily-post.yml`.

Recommended default schedule: Monday-Friday at `06:00 UTC`.

```yaml
name: Daily AI blog post

on:
  schedule:
    # 06:00 UTC Monday-Friday. GitHub cron is always UTC.
    - cron: '0 6 * * 1-5'
  workflow_dispatch: {}

permissions:
  contents: write

concurrency:
  group: daily-post
  cancel-in-progress: false

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Generate post
        id: gen
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          POST_MODEL: gpt-5.4-mini
          POST_EFFORT: low
        run: node scripts/generate-post.mjs

      - name: Commit and push
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add path/to/blog/content
          if git diff --cached --quiet; then
            echo "No new article to commit."
            exit 0
          fi
          git commit -m "Add automated blog post: ${{ steps.gen.outputs.title }}"
          git push
```

Change `git add path/to/blog/content` to the actual content directory.

If the project uses another model provider, change the secret and generator script accordingly. Keep the secret name obvious, for example `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `AI_API_KEY`.

---

## 5. GitHub Setup

In the repository:

1. Go to `Settings -> Secrets and variables -> Actions`.
2. Add repository secret:
   - `OPENAI_API_KEY`
3. Go to `Settings -> Actions -> General`.
4. Under workflow permissions, enable:
   - `Read and write permissions`
5. Keep Actions failure notifications enabled.
6. Set a monthly spend limit in the AI provider dashboard.

Never commit API keys to the repo. Never put API keys in `.env` if the file is tracked.

---

## 6. Generator Script Responsibilities

The script should do all of this:

1. Check required environment variables.
2. Read existing posts.
3. Build a list of existing titles, slugs, and internal-link targets.
4. Build a project-specific prompt from:
   - site purpose
   - audience
   - language
   - tone
   - article length
   - required sections
   - formatting rules
   - internal-link rules
   - existing posts to avoid
5. Call the AI API.
6. Extract plain Markdown article text.
7. Parse title from the first H1.
8. Derive slug, SEO title, SEO description, and image alt if needed.
9. Validate output.
10. Retry up to 3 times if validation fails.
11. Write the new post file.
12. Append `slug` and `title` to `GITHUB_OUTPUT`.

Recommended script defaults:

```js
const MODEL = process.env.POST_MODEL || 'gpt-5.4-mini';
const EFFORT = process.env.POST_EFFORT || 'low';
const MAX_TOKENS = 6000;
const MIN_ARTICLE_WORDS = 800;
const MAX_ARTICLE_WORDS = 1200;
const MAX_ATTEMPTS = 3;
```

Tune these values per project.

---

## 7. Study Existing Blog Style Before Prompting

The most important part of portability is style matching.

Before writing the prompt, inspect at least 5-10 existing posts and answer:

- How long are posts usually?
- Do posts use H1 in body, or is title only in frontmatter?
- Are headings `##`, `###`, or custom components?
- Are FAQs normal for this site?
- Are conclusions normal?
- Are tables allowed?
- Are images required?
- Are internal links common?
- Is the language formal, practical, devotional, commercial, technical, local, etc.?
- Are posts written as guides, news, opinion, comparisons, tutorials, or evergreen explainers?

Then encode that style in `SYSTEM_PROMPT`.

Example prompt structure:

```text
You are an experienced writer for [site name].

Audience:
- [specific audience]

Voice:
- [tone]
- [reading level]
- [avoid these phrases/styles]

Structure:
- First line must be one H1: "# Title"
- Write 800-1200 words
- Use 4-7 H2 sections
- Include FAQ if this site uses FAQ
- End with a conclusion if this site normally does

Formatting:
- Plain Markdown
- No frontmatter
- No tables unless the site renders tables well
- Use internal links naturally

Accuracy:
- Do not invent facts, prices, dates, statistics, laws, medical claims, or financial claims
- If uncertain, phrase generally

Output:
- Output only the article
```

Avoid generic filler such as:

```text
in today's digital world
whether you're a beginner or expert
it is important to note
unlock the power of
```

---

## 8. Existing Posts And Topic Avoidance

The script must read existing posts before generation.

For each post, collect:

```js
{
  slug,
  title
}
```

Pass the list into the prompt:

```text
We already have these posts. Do not repeat or closely overlap them:
- Existing title 1
- Existing title 2
```

Also validate in code. Do not rely only on the prompt.

Recommended safeguards:

- Reject exact duplicate slug.
- Reject exact duplicate title.
- Reject near-duplicate title using normalized title tokens.
- Retry generation if the title is too similar.

Simple title-similarity strategy:

```js
function titleTokens(title) {
  return slugify(title)
    .split('-')
    .filter((token) => token.length >= 4 && !STOPWORDS.has(token));
}

function titleSimilarity(a, b) {
  const aTokens = new Set(titleTokens(a));
  const bTokens = new Set(titleTokens(b));
  if (!aTokens.size || !bTokens.size) return 0;

  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap++;
  }
  return overlap / new Set([...aTokens, ...bTokens]).size;
}
```

Use a threshold around `0.55`, then tune after seeing real titles.

---

## 9. Internal Links

Build an allow-list of valid internal URLs.

Include:

- home page
- blog index
- category pages
- existing posts
- important evergreen pages

Example:

```js
ALLOWED_PATHS = new Set([
  '/',
  '/blog/',
  '/category/example/',
  ...slugs.map((s) => `/${s}/`),
]);
```

Tell the model:

```text
Use 2-5 internal links where genuinely helpful.
Only link to URLs from this exact list.
Never invent internal URLs.
Use natural descriptive anchor text.
```

Validate links in code:

- Reject unknown internal links.
- Normalize accidental double slashes:
  - `//example-post/` -> `/example-post/`
- Optionally require at least 2 internal links.
- Optionally reject more than 6 links.

For a brand-new site with very few posts, make internal links optional until enough posts exist.

---

## 10. Output Validation

Validation should be strict enough to prevent bad posts, but not so brittle that normal good output fails.

Recommended checks:

- Required fields exist:
  - title
  - slug
  - SEO title/description if the schema needs them
  - image alt if image field exists
- Word count is inside target range.
- Content has no extra H1 after title removal.
- Content does not contain unsupported tables.
- Content ends on a sentence boundary.
- Required sections exist if the prompt requires them.
- Internal links are valid.
- Title is not duplicate or too similar.
- Slug is not reserved.

Avoid brittle checks such as:

- exact punctuation balance for quotation marks
- exact number of headings
- exact number of paragraphs
- exact phrase matching when translated/localized text may vary

Good validation error logs are important:

```text
-> rejected: content too short (612 words); missing FAQ section
-> rejected: title too similar to "Existing Post Title" (0.67)
```

---

## 11. Frontmatter And File Writing

Match the project exactly.

Common patterns:

Folder post:

```text
src/content/posts/my-post-slug/index.md
```

Single-file post:

```text
content/blog/my-post-slug.md
```

Example frontmatter:

```yaml
---
title: "Post title"
publishedAt: "2026-07-10T06:00"
category: "Blog"
featuredImage: "../../../assets/images/posts/default-hero.png"
featuredImageAlt: "Post title"
seoTitle: "Post title"
seoDescription: "Short description"
---
```

Rules:

- Use the existing date format.
- Use the existing category/tag format.
- Use JSON string escaping for YAML scalars if writing manually.
- Do not add fields that the schema does not support.
- If a shared hero image does not exist, omit it or use the site's fallback.
- Make the generated file look like a human-created existing post.

---

## 12. Slugs

Implement a slugifier compatible with the project.

Basic slug rules:

- lowercase
- strip quotes
- transliterate local characters if needed
- replace non-alphanumeric runs with `-`
- trim leading/trailing `-`
- cap length, for example 80 characters

Keep a reserved slug list for pages:

```js
const RESERVED_SLUGS = new Set([
  'blog',
  '404',
  'category',
  'about',
  'contact',
]);
```

If slug exists, usually reject and retry for a fresh topic. Only append `-2` if duplicate topics are acceptable. For SEO automation, rejecting and retrying is usually better.

---

## 13. Model Choice And Cost

For simple evergreen blog posts, use a cheaper model first.

Recommended:

```text
POST_MODEL=gpt-5.4-mini
POST_EFFORT=low
```

Why:

- fast enough for scheduled posts
- cheap enough for frequent publishing
- usually good enough for 800-1200 word evergreen content

Use a stronger model only if:

- the niche is high-stakes
- factual precision is critical
- writing quality is consistently weak
- the mini model repeatedly fails validation

Keep output length controlled. Output tokens dominate cost.

---

## 14. Schedule And SEO Publishing Pace

Reasonable schedules:

```yaml
# Twice weekly, Tuesday and Friday
- cron: '0 6 * * 2,5'

# Weekdays
- cron: '0 6 * * 1-5'

# Daily
- cron: '0 6 * * *'
```

For SEO, publishing 5 posts per week is fine if:

- articles are useful
- topics are distinct
- content is not thin
- internal links are natural
- old posts are not cannibalized by near-duplicates
- the site can maintain quality

Quality beats volume. If the niche is narrow, use 2-3 posts per week or add stronger duplicate-topic checks.

---

## 15. Testing

Before enabling the schedule:

1. Run syntax check:

```bash
node --check scripts/generate-post.mjs
```

2. Run manually with a temporary API key:

```bash
OPENAI_API_KEY="test_key" node scripts/generate-post.mjs
```

PowerShell:

```powershell
$env:OPENAI_API_KEY="test_key"
node scripts/generate-post.mjs
Remove-Item Env:\OPENAI_API_KEY -ErrorAction SilentlyContinue
```

3. Inspect the generated post:

- Does it build?
- Does frontmatter match existing posts?
- Does the article read like the site?
- Are links valid?
- Is the topic unique?
- Is the length correct?
- Does it avoid generic AI filler?

4. Run the site build:

```bash
npm run build
```

5. Test GitHub Actions manually:

```text
Actions -> Daily AI blog post -> Run workflow
```

6. Confirm the workflow commits the post and the host deploys.

---

## 16. Failure Handling

The script should fail cleanly if:

- API key is missing.
- AI API returns an error.
- model output is empty.
- model output hits token limit.
- validation fails after all retries.
- content path is invalid.
- output file already exists unexpectedly.

It should not write partial or invalid content.

Recommended retry count:

```js
const MAX_ATTEMPTS = 3;
```

If all attempts fail:

```text
ERROR: could not produce a complete, valid article after 3 attempts. Nothing written.
```

---

## 17. Useful Diagnostics

Log enough to understand failures, but never log secrets.

Good logs:

```text
Attempt 1/3: generating with gpt-5.4-mini (effort: low)...
[diag] status=completed incomplete_reason=- out_tokens=2738 (max 6000)
[diag] combined_chars=7366
[diag] words=957 links=3
-> passed completeness checks.
Created article:
Title: Example title
Slug: example-title
File: src/content/posts/example-title/index.md
Tokens: in=4830 out=2738
```

Bad logs:

```text
OPENAI_API_KEY=...
```

Never print API keys.

---

## 18. Optional Stronger Safeguards

Add these if the site grows or quality starts drifting:

- Require 2-5 internal links once enough posts exist.
- Reject posts with no internal links.
- Reject titles too similar to last 30 posts more aggressively.
- Keep a topic blacklist or recent-topic memory file.
- Add categories and rotate between them.
- Add a second AI review pass only for sensitive or high-value sites.
- Add a fallback stronger model after 3 failed mini-model attempts.
- Generate a report file with model, tokens, cost estimate, word count, and links.
- Open a pull request instead of committing directly to main.
- Run `npm run build` before committing if CI time is acceptable.

Avoid overengineering at the start. A simple script with strong validation is usually better than a complex content pipeline.

---

## 19. Security And Cost Controls

Required:

- API key only in GitHub Actions secrets.
- No API key in committed files.
- Monthly spend limit in provider dashboard.
- Workflow failure notifications enabled.
- Retry limit.
- Token limit.

Recommended:

- Use a lower-cost model by default.
- Keep article length bounded.
- Avoid web search/tool calls unless needed.
- Use manual approval or pull requests for high-risk niches.
- Rotate any key that is pasted into chat, logs, screenshots, or issue comments.

---

## 20. What To Customize Per Project

Always customize:

- `POSTS_DIR`
- frontmatter fields
- output file path pattern
- slugifier/transliteration
- reserved slugs
- site pages allowed for links
- category/tag defaults
- article language
- article length
- `SYSTEM_PROMPT`
- workflow `git add` path
- schedule

Usually customize:

- image handling
- FAQ requirement
- conclusion requirement
- internal link count
- title similarity threshold
- model and effort

Do not customize unless needed:

- retry/backoff logic
- basic validation structure
- GitHub commit step
- no-dependency approach

---

## 21. Implementation Checklist

Use this checklist when applying the automation to a new repo.

```text
[ ] Inspect existing blog post files
[ ] Identify content directory
[ ] Identify frontmatter schema
[ ] Identify slug/file path pattern
[ ] Identify image handling
[ ] Identify internal link targets
[ ] Identify house writing style
[ ] Create scripts/generate-post.mjs
[ ] Add project-specific SYSTEM_PROMPT
[ ] Read existing posts in script
[ ] Build allowed internal-link list
[ ] Add validation checks
[ ] Add duplicate/near-duplicate topic check
[ ] Write new post file
[ ] Append title and slug to GITHUB_OUTPUT
[ ] Create .github/workflows/daily-post.yml
[ ] Set OPENAI_API_KEY secret
[ ] Enable workflow write permissions
[ ] Run node --check
[ ] Run script locally with temporary key
[ ] Inspect generated article
[ ] Run site build
[ ] Run workflow manually
[ ] Confirm commit and deploy
[ ] Enable schedule
```

---

## 22. Final Principle

The automation should behave like a careful junior editor:

- it reads what already exists
- it follows the site's format
- it writes one useful article
- it checks its own work
- it refuses to publish weak or duplicate content
- it leaves a clear log when something fails

The code can be simple. The safeguards are what make it safe to run on a schedule.

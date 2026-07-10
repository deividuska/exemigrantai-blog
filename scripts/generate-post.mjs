import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const POSTS_DIR = path.join(ROOT, 'src', 'content', 'posts');
const IMAGE_ROOT = path.join(ROOT, 'src', 'assets', 'images', 'posts');
const API_URL = 'https://api.openai.com/v1';
const MODEL = process.env.POST_MODEL || 'gpt-5.4-mini';
const IMAGE_MODEL = process.env.IMAGE_MODEL || 'gpt-image-2';
const MAX_ATTEMPTS = Number(process.env.MAX_ATTEMPTS || 3);
const MIN_ARTICLE_WORDS = Number(process.env.MIN_ARTICLE_WORDS || 900);
const MAX_ARTICLE_WORDS = Number(process.env.MAX_ARTICLE_WORDS || 1_600);
const GENERATE_FEATURED_IMAGE = process.env.GENERATE_FEATURED_IMAGE !== 'false';
const IMAGE_QUALITY = process.env.IMAGE_QUALITY || 'medium';
const IMAGE_SIZE = process.env.IMAGE_SIZE || '1536x1024';
const STOPWORDS = new Set([
  'apie', 'arba', 'darbo', 'dalis', 'gauti', 'grizus', 'grizimas', 'kaip', 'kada',
  'kad', 'kiek', 'kur', 'lietuva', 'lietuviai', 'lietuvoje', 'metais', 'm', 'nuo',
  'savo', 'svarbu', 'tai', 'tarp', 'visa', 'viska', 'with', 'your', 'from', 'into',
]);
const RESERVED_SLUGS = new Set(['404', 'apie-mus', 'blog', 'kontaktai', 'page', 'privatumo-politika', 'redakcine-politika', 'rss.xml']);

const REFERENCE_IMAGES = [
  'hmrc-tax-refund-grizus-is-jk-kada-galima-susigrazinti-permoketus-mokescius',
  'vaiko-grizimas-i-lietuvos-mokykla-is-jk-2026-dokumentai-klase-kalba-pazymiai',
  'grizimas-i-lietuva-su-augintiniu-is-jk-2026-pasas-mikroschema-skiepai-keliones-klaidos',
].map((slug) => path.join(IMAGE_ROOT, slug, 'featuredImage.png'));

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function log(message) {
  console.log(`[blog-generator] ${message}`);
}

function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[‘’'"“”]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

function yamlString(value) {
  return JSON.stringify(String(value));
}

function wordCount(value) {
  return value.replace(/[`*_#>{}\[\]()|]/g, ' ').split(/\s+/).filter(Boolean).length;
}

function titleTokens(title) {
  return new Set(slugify(title).split('-').filter((token) => token.length >= 4 && !STOPWORDS.has(token)));
}

function titleSimilarity(a, b) {
  const aTokens = titleTokens(a);
  const bTokens = titleTokens(b);
  if (!aTokens.size || !bTokens.size) return 0;
  const union = new Set([...aTokens, ...bTokens]);
  const overlap = [...aTokens].filter((token) => bTokens.has(token)).length;
  return overlap / union.size;
}

function extractFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const frontmatter = match?.[1] || '';
  const foldedTitle = frontmatter.match(/^title:\s*>-?\s*\r?\n((?:\s{2,}[^\r\n]+\r?\n?)+)/m)?.[1];
  const inlineTitle = frontmatter.match(/^title:\s*["']?([^\r\n"']+)/m)?.[1];
  const title = (foldedTitle ? foldedTitle.replace(/^\s+/gm, '').replace(/\s+/g, ' ') : inlineTitle || '').trim();
  return { title };
}

async function getExistingPosts() {
  const entries = await readdir(POSTS_DIR, { withFileTypes: true });
  const posts = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const file = path.join(POSTS_DIR, entry.name, 'index.mdoc');
    try {
      const raw = await readFile(file, 'utf8');
      posts.push({ slug: entry.name, title: extractFrontmatter(raw).title || entry.name });
    } catch {
      // A folder without an index.mdoc is not a published post.
    }
  }
  return posts;
}

function outputText(response) {
  if (typeof response.output_text === 'string' && response.output_text.trim()) return response.output_text.trim();
  const parts = [];
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
}

async function openaiJson(apiKey, body) {
  const response = await fetch(`${API_URL}/responses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`OpenAI Responses API failed (${response.status}): ${data.error?.message || 'unknown error'}`);
  return data;
}

function buildPrompt(existingPosts) {
  const existing = existingPosts.map(({ title, slug }) => `- ${title} (${slug})`).join('\n');
  return `You are the careful Lithuanian editor for Eks Emigrantai, a practical informational site for Lithuanians moving between Lithuania and the UK, USA, Canada, Sweden and Norway, or returning to Lithuania.

Write one timely evergreen article in Lithuanian. Pick a useful, specific topic that does not overlap the existing list. Prioritise UK <-> Lithuania and USA <-> Lithuania. USA return articles should be useful to long-term emigrants and retirees; UK articles should also serve working-age people and families. Do not write political commentary. For current migration rules, benefits, pensions, tax or healthcare, use web search and rely only on primary official sources.

House style:
- Calm, plain, practical, reader-first Lithuanian.
- Start articleMarkdown with a bold real-life problem paragraph, then a short direct answer paragraph.
- Then add a sentence stating that the article is based on official sources checked today.
- Use concrete ## question/task headings, short paragraphs, checklists and numbered steps where helpful.
- Include a practical summary headed "## Ką svarbiausia prisiminti?", "## Oficialūs šaltiniai", and, for legal/tax/benefits/immigration/health matters, "## Svarbi pastaba".
- Use Markdoc tables only when they simplify a real comparison. Do not use unsupported HTML.
- Cite official sources as Markdown links in relevant text and list 2-6 official sources at the end. Never invent URLs, rules, figures, dates, forms or statistics. Do not cite search-result pages.
- Use 1-3 natural internal links only from the allow-list below.
- Avoid generic AI filler and do not include frontmatter or an H1.

Image brief rules:
- Capture the article's practical promise in one landscape featured image, not every paragraph.
- Specify country direction, 3-5 concrete symbolic objects, and an action or route.
- No readable text, logos, flags filling the composition, photorealism, neon, or generic person-with-suitcase imagery.
- The visual style is warm editorial paper-cut / 2.5D collage: cream background, muted petrol teal, sage, ochre, sand and restrained coral; layered paper forms, gentle shadows, subtle grain, calm useful mood.

Return valid JSON only with this shape:
{
  "title": "...",
  "category": "Naujienos",
  "seoTitle": "...",
  "seoDescription": "...",
  "articleMarkdown": "...",
  "imageBrief": {
    "alt": "...",
    "concept": "...",
    "countryDirection": "...",
    "objects": ["...", "...", "..."],
    "avoid": ["readable text", "logos"]
  }
}

Internal-link allow-list:
${existingPosts.map(({ slug, title }) => `- [${title}](/blog/${slug}/)`).join('\n')}

Existing posts to avoid:
${existing}`;
}

function validateDraft(draft, existingPosts) {
  const errors = [];
  const fields = ['title', 'category', 'seoTitle', 'seoDescription', 'articleMarkdown'];
  for (const field of fields) if (!String(draft?.[field] || '').trim()) errors.push(`missing ${field}`);
  if (!draft?.imageBrief?.concept || !draft?.imageBrief?.alt || !Array.isArray(draft?.imageBrief?.objects)) errors.push('incomplete imageBrief');
  if (errors.length) return errors;

  const slug = slugify(draft.title);
  if (slug.length < 12) errors.push('title produces a too-short slug');
  if (RESERVED_SLUGS.has(slug)) errors.push('reserved slug');
  if (existingPosts.some((post) => post.slug === slug)) errors.push('duplicate slug');
  if (existingPosts.some((post) => post.title.toLowerCase() === draft.title.toLowerCase())) errors.push('duplicate title');
  const similar = existingPosts.find((post) => titleSimilarity(post.title, draft.title) >= 0.55);
  if (similar) errors.push(`title too similar to existing post: ${similar.title}`);

  const article = draft.articleMarkdown.trim();
  const words = wordCount(article);
  if (words < MIN_ARTICLE_WORDS || words > MAX_ARTICLE_WORDS) errors.push(`article has ${words} words (expected ${MIN_ARTICLE_WORDS}-${MAX_ARTICLE_WORDS})`);
  if (/^#\s+/m.test(article)) errors.push('article contains an H1');
  for (const heading of ['Ką svarbiausia prisiminti?', 'Oficialūs šaltiniai']) {
    if (!new RegExp(`^##\\s+${heading.replace(/[?]/g, '\\?')}`, 'm').test(article)) errors.push(`missing required section: ${heading}`);
  }
  if (!/^\*\*.+\*\*/.test(article)) errors.push('opening paragraph is not bold');
  if (!/https:\/\//.test(article)) errors.push('article has no external source links');
  if ((draft.imageBrief.objects || []).length < 3 || (draft.imageBrief.objects || []).length > 5) errors.push('image brief needs 3-5 objects');
  if (!String(draft.imageBrief.countryDirection || '').trim()) errors.push('image brief has no country direction');

  const internalLinks = [...article.matchAll(/\]\((\/[^)]+)\)/g)].map((match) => match[1]);
  const allowed = new Set(['/'].concat(existingPosts.map((post) => `/blog/${post.slug}/`)));
  for (const link of internalLinks) if (!allowed.has(link)) errors.push(`unknown internal link: ${link}`);
  if (internalLinks.length > 3) errors.push('more than three internal links');
  return errors;
}

function frontmatter(draft, slug, includeImage) {
  const date = new Date().toISOString();
  return [
    '---',
    `title: ${yamlString(draft.title)}`,
    `publishedAt: ${yamlString(date)}`,
    `category: ${yamlString(draft.category || 'Naujienos')}`,
    ...(includeImage ? [`featuredImage: ${yamlString(`@assets/images/posts/${slug}/featuredImage.png`)}`, `featuredImageAlt: ${yamlString(draft.imageBrief.alt)}`] : []),
    `seoTitle: ${yamlString(draft.seoTitle)}`,
    `seoDescription: ${yamlString(draft.seoDescription)}`,
    '---',
    '',
  ].join('\n');
}

async function generateImage(apiKey, imageBrief, slug) {
  const form = new FormData();
  form.set('model', IMAGE_MODEL);
  form.set('size', IMAGE_SIZE);
  form.set('quality', IMAGE_QUALITY);
  form.set('output_format', 'png');
  form.set('background', 'opaque');
  form.set('prompt', `Create one landscape blog featured image. ${imageBrief.concept}\nCountry direction: ${imageBrief.countryDirection}.\nRequired symbolic objects: ${imageBrief.objects.join(', ')}.\nAvoid: ${(imageBrief.avoid || []).join(', ')}.\nUse the supplied images only as visual-style references. Keep the new subject original. Warm editorial paper-cut / 2.5D collage illustration, cream background, muted petrol teal, sage, ochre, sand and restrained coral, layered paper shapes, gentle shadows, subtle grain, calm trustworthy practical mood. No readable text, no logos, no watermarks, no photorealism, no neon.`);

  for (const reference of REFERENCE_IMAGES) {
    const bytes = await readFile(reference);
    form.append('image[]', new Blob([bytes], { type: 'image/png' }), path.basename(reference));
  }

  const response = await fetch(`${API_URL}/images/edits`, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`OpenAI Images API failed (${response.status}): ${data.error?.message || 'unknown error'}`);
  const base64 = data.data?.[0]?.b64_json;
  if (!base64) throw new Error('OpenAI Images API returned no image data');
  const outputDir = path.join(IMAGE_ROOT, slug);
  await mkdir(outputDir, { recursive: true });
  const output = path.join(outputDir, 'featuredImage.png');
  await writeFile(output, Buffer.from(base64, 'base64'));
  return output;
}

function setGithubOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) return writeFile(process.env.GITHUB_OUTPUT, `${name}=${String(value).replace(/\r?\n/g, ' ')}\n`, { flag: 'a' });
}

async function main() {
  const apiKey = requiredEnv('OPENAI_API_KEY');
  const existingPosts = await getExistingPosts();
  log(`loaded ${existingPosts.length} existing posts`);
  let draft;
  let slug;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    log(`attempt ${attempt}/${MAX_ATTEMPTS}: researching and generating with ${MODEL}`);
    const response = await openaiJson(apiKey, {
      model: MODEL,
      reasoning: { effort: process.env.POST_EFFORT || 'low' },
      tools: [{ type: 'web_search' }],
      input: buildPrompt(existingPosts),
    });
    const text = outputText(response);
    try {
      draft = JSON.parse(text.replace(/^```json\s*|\s*```$/g, ''));
    } catch {
      log('rejected: model response was not valid JSON');
      continue;
    }
    const errors = validateDraft(draft, existingPosts);
    if (errors.length) {
      log(`rejected: ${errors.join('; ')}`);
      continue;
    }
    slug = slugify(draft.title);
    break;
  }

  if (!draft || !slug) throw new Error(`Could not produce a complete valid article after ${MAX_ATTEMPTS} attempts. Nothing written.`);
  const postDir = path.join(POSTS_DIR, slug);
  let imagePath;
  if (GENERATE_FEATURED_IMAGE) {
    imagePath = await generateImage(apiKey, draft.imageBrief, slug);
    log(`created featured image: ${path.relative(ROOT, imagePath)}`);
  }
  await mkdir(postDir, { recursive: true });
  const postFile = path.join(postDir, 'index.mdoc');
  await writeFile(postFile, `${frontmatter(draft, slug, Boolean(imagePath))}${draft.articleMarkdown.trim()}\n`, 'utf8');
  await setGithubOutput('title', draft.title);
  await setGithubOutput('slug', slug);
  log(`created article: ${path.relative(ROOT, postFile)}`);
  log(`words=${wordCount(draft.articleMarkdown)} image=${Boolean(imagePath)}`);
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
});

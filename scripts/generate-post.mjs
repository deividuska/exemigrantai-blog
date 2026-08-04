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
const MIN_ARTICLE_WORDS = Number(process.env.MIN_ARTICLE_WORDS || 700);
const MAX_ARTICLE_WORDS = Number(process.env.MAX_ARTICLE_WORDS || 1_600);
const GENERATE_FEATURED_IMAGE = process.env.GENERATE_FEATURED_IMAGE !== 'false';
const IMAGE_QUALITY = process.env.IMAGE_QUALITY || 'medium';
const IMAGE_SIZE = process.env.IMAGE_SIZE || '1536x1024';
const CONTENT_LANES = new Set(['auto', 'migration', 'lithuanian_knowledge']);
const LITHUANIAN_KNOWLEDGE_CATEGORY = 'Ką turi žinoti kiekvienas lietuvis';
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

function resolveContentLane() {
  const requested = (process.env.CONTENT_LANE || 'auto').trim();
  if (!CONTENT_LANES.has(requested)) {
    throw new Error(`Invalid CONTENT_LANE: ${requested}. Use auto, migration, or lithuanian_knowledge.`);
  }
  if (requested !== 'auto') return requested;

  const day = new Date().getUTCDay();
  return day === 2 || day === 4 ? 'lithuanian_knowledge' : 'migration';
}

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

function buildPrompt(existingPosts, retryFeedback = '', lane = 'migration') {
  const existing = existingPosts.map(({ title, slug }) => `- ${title} (${slug})`).join('\n');
  if (lane === 'lithuanian_knowledge') {
    return `You are the careful Lithuanian editor for Eks Emigrantai, writing the section "${LITHUANIAN_KNOWLEDGE_CATEGORY}".

Write one evergreen Lithuanian article for Lithuanians abroad, returning emigrants, and their children who want to understand Lithuania more deeply. Pick a useful, searchable topic that does not overlap the existing list. The section covers Lithuanian history, statehood, culture, public memory, everyday nostalgia, media, cinema, TV and shared national reference points.

Topic range examples:
- Early Lithuania: first mention of Lithuania, Baltic tribes, Mindaugas, the Grand Duchy of Lithuania.
- Historical milestones: Žalgirio mūšis, Vasario 16-oji, Kovo 11-oji, occupations, Sąjūdis, exile and return.
- Culture and memory: Soviet-era and early independence TV, cinema, music, books, public rituals, why certain shows such as "Vergė Izaura" became cultural memories.
- Direct-answer queries: when an event happened, what it means, why it matters, what Lithuanians should remember.

Do not write a random trivia article. The article must explain the topic clearly enough that an ordinary Lithuanian could tell the story to their child or to a foreign-born family member. Give historical/cultural background, the essential facts, why it mattered then, why it still matters now, and what people often misunderstand.

Use web search. Prefer authoritative Lithuanian sources: official state or museum pages, Lithuanian encyclopaedia/Visuotinė lietuvių enciklopedija, universities, reputable archives, LRT or other serious cultural/history coverage. For cultural nostalgia topics, use reliable sources and clearly distinguish documented facts from interpretation.

Length: aim for 800-1,300 useful Lithuanian words in articleMarkdown. An article may be as short as 700 words only when it fully answers a naturally narrow reader question. Never add filler merely to meet a length target.

House style:
- Calm, plain, warm, reader-first Lithuanian.
- Start articleMarkdown with a bold real-life problem paragraph for a Lithuanian abroad, then a short direct answer paragraph.
- Use concrete ## question headings, short paragraphs, and occasional bullet lists.
- Include these exact sections: "## Ką svarbiausia prisiminti?" and "## Šaltiniai ir tolesnis skaitymas".
- Add "## Kodėl tai svarbu lietuviams užsienyje?" when the topic is historical, cultural or identity-related.
- Avoid academic stiffness, school-essay tone, nationalist exaggeration, political campaigning and generic AI filler.
- Do not use template-like source-disclosure sentences such as "parengta remiantis šaltiniais, patikrintais šiandien". Sources belong naturally in the text and in the final source section.
- For historical or cultural-memory topics, verify the exact date, period and political context before writing. If an event happened in late Soviet Lithuania, during Sąjūdis, after independence, or in interwar Lithuania, say that precisely. Do not blur different eras together.
- Prefer concrete Lithuanian details over abstract phrases. Use examples, dates, viewing habits, institutions, names, places or everyday context where reliable sources support them.
- Cite sources as Markdown links in relevant text and list 2-6 reliable sources at the end. Never invent URLs, dates, names, statistics or claims. Do not cite search-result pages.
- Use 1-3 natural internal links only from the allow-list below.
- Use clean, direct source URLs only. Never include tracking parameters such as utm_source, and never include an OpenAI attribution or referral parameter.
- Do not include frontmatter or an H1.

Image brief rules:
- Capture the article's central memory or historical meaning in one landscape featured image.
- Specify Lithuania/cultural-memory direction, 3-5 concrete symbolic objects, and one mood/action.
- For copyrighted films, TV shows or characters, evoke the era with symbolic objects instead of recreating protected characters, actors, logos or stills.
- No readable text, logos, flags filling the composition, photorealism, neon, or generic classroom imagery.
- The visual style is warm editorial paper-cut / 2.5D collage: cream background, muted petrol teal, sage, ochre, sand and restrained coral; layered paper forms, gentle shadows, subtle grain, calm useful mood.

Return valid JSON only with this shape:
{
  "title": "...",
  "category": "${LITHUANIAN_KNOWLEDGE_CATEGORY}",
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
${existing}
${retryFeedback ? `\nPrevious draft feedback - correct every applicable point in this new draft:\n${retryFeedback}` : ''}`;
  }

  return `You are the careful Lithuanian editor for Eks Emigrantai, a practical informational site for Lithuanians moving between Lithuania and the UK, USA, Canada, Sweden and Norway, or returning to Lithuania.

Write one timely evergreen article in Lithuanian. Pick a useful, specific topic that does not overlap the existing list. Prioritise UK <-> Lithuania and USA <-> Lithuania. USA return articles should be useful to long-term emigrants and retirees; UK articles should also serve working-age people and families. Do not write political commentary. For current migration rules, benefits, pensions, tax or healthcare, use web search and rely only on primary official sources.

Length: aim for 800-1,200 useful Lithuanian words in articleMarkdown. An article may be as short as 700 words only when it fully answers a naturally narrow reader question. Never add filler merely to meet a length target.

House style:
- Calm, plain, practical, reader-first Lithuanian.
- Start articleMarkdown with a bold real-life problem paragraph, then a short direct answer paragraph.
- Use concrete ## question/task headings, short paragraphs, checklists and numbered steps where helpful.
- Include a practical summary headed "## Ką svarbiausia prisiminti?", "## Oficialūs šaltiniai", and, for legal/tax/benefits/immigration/health matters, "## Svarbi pastaba".
- Use Markdoc tables only when they simplify a real comparison. Do not use unsupported HTML.
- Cite official sources as Markdown links in relevant text and list 2-6 official sources at the end. Never invent URLs, rules, figures, dates, forms or statistics. Do not cite search-result pages.
- Use 1-3 natural internal links only from the allow-list below.
- Use clean, direct source URLs only. Never include tracking parameters such as utm_source, and never include an OpenAI attribution or referral parameter.
- Do not use template-like source-disclosure sentences such as "parengta remiantis šaltiniais, patikrintais šiandien". Mention source context only when it reads naturally, and keep formal source lists in the source section.
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
${existing}
${retryFeedback ? `\nPrevious draft feedback — correct every applicable point in this new draft:\n${retryFeedback}` : ''}`;
}

function buildRepairPrompt(existingPosts, previousOutput, feedback, lane = 'migration') {
  const expectedCategory = lane === 'lithuanian_knowledge' ? LITHUANIAN_KNOWLEDGE_CATEGORY : 'Naujienos';
  const sourceHeading = lane === 'lithuanian_knowledge' ? 'Šaltiniai ir tolesnis skaitymas' : 'Oficialūs šaltiniai';
  const laneInstruction =
    lane === 'lithuanian_knowledge'
      ? `This is for the "${LITHUANIAN_KNOWLEDGE_CATEGORY}" section. Preserve the Lithuanian history, culture or public-memory angle. The explanation must be deep enough for ordinary Lithuanians abroad to understand the context, meaning, timeline and common misunderstandings.`
      : 'This is for the practical migration/returning-to-Lithuania lane. Preserve the official-source practical guidance angle.';

  return `You are revising one already-researched Lithuanian article for Eks Emigrantai.

Do NOT use web search and do NOT replace the article with a newly researched topic. Preserve the original article's factual claims, official source URLs, practical focus and image concept unless a listed validation issue requires a small correction. Do not invent any new rules, dates, figures, forms, statistics or URLs.

${laneInstruction}

Return a complete replacement in valid JSON only, using exactly this shape:
{
  "title": "...",
  "category": "${expectedCategory}",
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

Apply every validation correction below. The finished articleMarkdown must be in natural Lithuanian, start with a bold real-life problem paragraph, contain no frontmatter or H1, and retain the required sections "## Ką svarbiausia prisiminti?" and "## ${sourceHeading}". Keep it between ${MIN_ARTICLE_WORDS} and ${MAX_ARTICLE_WORDS} words. Retain 2-6 direct source links. Use only 1-3 internal links from the allow-list, if any:
${existingPosts.map(({ slug, title }) => `- [${title}](/blog/${slug}/)`).join('\n')}

Do not add template-like source-disclosure sentences such as "parengta remiantis šaltiniais, patikrintais šiandien". If the article is historical or cultural, preserve exact dates, period labels and political context.

Validation issues to fix:
${feedback}

Previous response to repair (it may be malformed JSON; recover its article rather than starting again):
---
${previousOutput}
---`;
}

function normalizeInternalLinks(article, existingPosts) {
  const canonicalPaths = new Set(existingPosts.map((post) => `/blog/${post.slug}`));
  return article.replace(/\]\((\/blog\/[^)\s#?]+)(?=[)\s#?])/g, (match, link) => {
    const pathWithoutSlash = link.replace(/\/+$/, '');
    return canonicalPaths.has(pathWithoutSlash) ? `](${pathWithoutSlash}/` : match;
  });
}

function sanitizeExternalUrl(value) {
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()]) {
      const normalizedKey = key.toLowerCase();
      const normalizedValue = (url.searchParams.get(key) || '').toLowerCase();
      if (
        normalizedKey.startsWith('utm_') ||
        ['fbclid', 'gclid', 'dclid', 'msclkid', 'mc_cid', 'mc_eid'].includes(normalizedKey) ||
        normalizedValue === 'openai'
      ) {
        url.searchParams.delete(key);
      }
    }
    return url.toString();
  } catch {
    return value;
  }
}

function sanitizeExternalUrls(article) {
  return article.replace(/https?:\/\/[^\s<>()\]]+/g, sanitizeExternalUrl);
}

async function sanitizeExistingPostUrls() {
  const entries = await readdir(POSTS_DIR, { withFileTypes: true });
  let changed = 0;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const file = path.join(POSTS_DIR, entry.name, 'index.mdoc');
    try {
      const raw = await readFile(file, 'utf8');
      const sanitized = sanitizeExternalUrls(raw);
      if (sanitized !== raw) {
        await writeFile(file, sanitized, 'utf8');
        changed += 1;
        log(`sanitized source URLs: ${path.relative(ROOT, file)}`);
      }
    } catch {
      // A folder without an index.mdoc is not a published post.
    }
  }
  log(`sanitized ${changed} existing post(s)`);
}

function validateDraft(draft, existingPosts, lane = 'migration') {
  const errors = [];
  const sourceHeading = lane === 'lithuanian_knowledge' ? 'Šaltiniai ir tolesnis skaitymas' : 'Oficialūs šaltiniai';
  const fields = ['title', 'category', 'seoTitle', 'seoDescription', 'articleMarkdown'];
  for (const field of fields) if (!String(draft?.[field] || '').trim()) errors.push(`missing ${field}`);
  if (!draft?.imageBrief?.concept || !draft?.imageBrief?.alt || !Array.isArray(draft?.imageBrief?.objects)) errors.push('incomplete imageBrief');
  if (errors.length) return errors;
  if (lane === 'lithuanian_knowledge' && draft.category !== LITHUANIAN_KNOWLEDGE_CATEGORY) {
    errors.push(`category must be "${LITHUANIAN_KNOWLEDGE_CATEGORY}"`);
  }

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
  for (const heading of ['Ką svarbiausia prisiminti?', sourceHeading]) {
    if (!new RegExp(`^##\\s+${heading.replace(/[?]/g, '\\?')}`, 'm').test(article)) errors.push(`missing required section: ${heading}`);
  }
  if (!/^\*\*.+\*\*/.test(article)) errors.push('opening paragraph is not bold');
  if (!/https:\/\//.test(article)) errors.push('article has no external source links');
  if (/[?&][^\s#=&]+=[^\s#&]*openai/i.test(article)) errors.push('article contains an OpenAI tracking parameter');
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
  if (process.env.SANITIZE_EXISTING_POST_URLS === 'true') {
    await sanitizeExistingPostUrls();
    return;
  }
  const apiKey = requiredEnv('OPENAI_API_KEY');
  const contentLane = resolveContentLane();
  const existingPosts = await getExistingPosts();
  log(`loaded ${existingPosts.length} existing posts`);
  log(`content lane: ${contentLane}`);
  let draft;
  let slug;
  let retryFeedback = '';
  let previousOutput = '';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const isRepair = attempt > 1;
    log(`attempt ${attempt}/${MAX_ATTEMPTS}: ${isRepair ? 'repairing saved draft without web search' : 'researching and generating'} with ${MODEL}`);
    const response = await openaiJson(apiKey, {
      model: MODEL,
      reasoning: { effort: process.env.POST_EFFORT || 'low' },
      ...(isRepair ? {} : { tools: [{ type: 'web_search' }] }),
      input: isRepair
        ? buildRepairPrompt(existingPosts, previousOutput, retryFeedback, contentLane)
        : buildPrompt(existingPosts, retryFeedback, contentLane),
    });
    const text = outputText(response);
    previousOutput = text;
    try {
      draft = JSON.parse(text.replace(/^```json\s*|\s*```$/g, ''));
    } catch {
      log('rejected: model response was not valid JSON');
      retryFeedback = '- The previous response was not valid JSON. Return the complete replacement article in the exact JSON shape requested.';
      continue;
    }
    draft.articleMarkdown = sanitizeExternalUrls(normalizeInternalLinks(draft.articleMarkdown || '', existingPosts));
    const errors = validateDraft(draft, existingPosts, contentLane);
    if (errors.length) {
      log(`rejected: ${errors.join('; ')}`);
      retryFeedback = errors.map((error) => `- ${error}`).join('\n');
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
  await setGithubOutput('content_lane', contentLane);
  log(`created article: ${path.relative(ROOT, postFile)}`);
  log(`words=${wordCount(draft.articleMarkdown)} image=${Boolean(imagePath)}`);
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
});

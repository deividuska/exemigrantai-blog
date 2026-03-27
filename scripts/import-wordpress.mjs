import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const xmlPath = path.join(rootDir, 'exemigrantailt.WordPress.2026-03-27.xml');
const postsDir = path.join(rootDir, 'src', 'content', 'posts');
const imagesDir = path.join(rootDir, 'src', 'assets', 'images', 'posts');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodeXmlText(value) {
  if (!value) return '';

  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

function extractTag(block, tagName) {
  const pattern = new RegExp(`<${escapeRegExp(tagName)}(?: [^>]*)?>([\\s\\S]*?)<\\/${escapeRegExp(tagName)}>`);
  const match = block.match(pattern);
  return match ? decodeXmlText(match[1]) : '';
}

function extractAll(block, pattern) {
  return [...block.matchAll(pattern)];
}

function stripTags(value) {
  return decodeXmlText(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function convertInlineHtml(html) {
  return decodeXmlText(
    html
      .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => `[${stripTags(text)}](${href})`)
      .replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, (_, _tag, text) => `**${stripTags(text)}**`)
      .replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, (_, _tag, text) => `*${stripTags(text)}*`)
      .replace(/<code>([\s\S]*?)<\/code>/gi, (_, text) => `\`${stripTags(text)}\``)
      .replace(/<br\s*\/?>/gi, '  \n')
      .replace(/<\/?span[^>]*>/gi, '')
      .replace(/<\/?div[^>]*>/gi, '')
      .replace(/<\/?p[^>]*>/gi, '')
      .replace(/<\/?[^>]+>/g, '')
  );
}

function convertList(html, ordered) {
  const items = extractAll(html, /<li[^>]*>([\s\S]*?)<\/li>/gi).map((match, index) => {
    const prefix = ordered ? `${index + 1}. ` : '- ';
    return `${prefix}${convertInlineHtml(match[1])}`;
  });

  return items.join('\n');
}

function convertTable(html) {
  const rows = extractAll(html, /<tr[^>]*>([\s\S]*?)<\/tr>/gi).map((rowMatch) =>
    extractAll(rowMatch[1], /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi).map((cellMatch) =>
      convertInlineHtml(cellMatch[1]).replace(/\|/g, '\\|')
    )
  );

  if (!rows.length) return '';

  const header = rows[0];
  const body = rows.slice(1);
  const separator = header.map(() => '---');
  const lines = [
    `| ${header.join(' | ')} |`,
    `| ${separator.join(' | ')} |`,
    ...body.map((row) => `| ${row.join(' | ')} |`),
  ];

  return lines.join('\n');
}

function convertHtmlToMarkdown(html) {
  let output = html
    .replace(/<!--[\s\S]*?-->/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (_, code) => `\n\`\`\`\n${decodeXmlText(code)}\n\`\`\`\n`)
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, quote) => {
      const lines = convertInlineHtml(quote).split('\n').map((line) => line.trim()).filter(Boolean);
      return `\n${lines.map((line) => `> ${line}`).join('\n')}\n`;
    })
    .replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_, table) => `\n${convertTable(table)}\n`)
    .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, list) => `\n${convertList(list, true)}\n`)
    .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, list) => `\n${convertList(list, false)}\n`)
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, text) => {
      return `\n${'#'.repeat(Number(level))} ${convertInlineHtml(text)}\n`;
    })
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, text) => `\n${convertInlineHtml(text)}\n`)
    .replace(/<hr[^>]*\/?>/gi, '\n---\n');

  output = output
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/Welcome to WordPress\. This is your first post\. Edit or delete it, then start writing!/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return output;
}

function yamlScalar(value) {
  return JSON.stringify(value ?? '');
}

function formatKeystaticDateTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid WordPress publication date: ${value}`);
  }

  return date.toISOString().slice(0, 16);
}

function normaliseSeoTitle(value, title) {
  const seoTitle = (value || '').trim();
  return seoTitle && seoTitle !== '1' ? seoTitle : title;
}

function truncateText(value, maxLength = 160) {
  const text = value.replace(/\s+/g, ' ').trim();

  if (text.length <= maxLength) {
    return text;
  }

  const truncated = text.slice(0, maxLength + 1);
  const lastSpace = truncated.lastIndexOf(' ');
  return `${(lastSpace > 80 ? truncated.slice(0, lastSpace) : text.slice(0, maxLength)).trim()}...`;
}

function normaliseSeoDescription(value, excerpt, title) {
  const seoDescription = (value || '').trim();
  const titleYear = title.match(/\b(20\d{2})\b/)?.[1];
  const descriptionYear = seoDescription.match(/\b(20\d{2})\b/)?.[1];

  if (
    seoDescription &&
    seoDescription !== '1' &&
    seoDescription !== title &&
    (!titleYear || !descriptionYear || titleYear === descriptionYear)
  ) {
    return seoDescription;
  }

  return truncateText(excerpt || title);
}

function buildFrontmatter(post) {
  const lines = [
    '---',
    `title: ${yamlScalar(post.title)}`,
    `publishedAt: ${yamlScalar(post.publishedAt)}`,
    `excerpt: ${yamlScalar(post.excerpt)}`,
    `category: ${yamlScalar(post.category || 'Naujienos')}`,
  ];

  if (post.featuredImage) {
    lines.push(`featuredImage: ${yamlScalar(post.featuredImage)}`);
  }

  if (post.featuredImageAlt) {
    lines.push(`featuredImageAlt: ${yamlScalar(post.featuredImageAlt)}`);
  }

  lines.push(`seoTitle: ${yamlScalar(post.seoTitle)}`);
  lines.push(`seoDescription: ${yamlScalar(post.seoDescription)}`);

  lines.push('---', '');
  return lines.join('\n');
}

function normaliseFilename(url) {
  const { pathname } = new URL(url);
  return path.basename(pathname);
}

async function downloadBuffer(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  const xml = await readFile(xmlPath, 'utf8');
  const items = extractAll(xml, /<item>([\s\S]*?)<\/item>/g).map((match) => match[1]);

  const attachmentMap = new Map(
    items
      .filter((item) => extractTag(item, 'wp:post_type') === 'attachment')
      .map((item) => [extractTag(item, 'wp:post_id'), extractTag(item, 'wp:attachment_url')])
  );

  const posts = items
    .filter((item) => extractTag(item, 'wp:post_type') === 'post')
    .map((item) => {
      const meta = new Map(
        extractAll(item, /<wp:postmeta>([\s\S]*?)<\/wp:postmeta>/g).map((metaMatch) => {
          const metaBlock = metaMatch[1];
          return [extractTag(metaBlock, 'wp:meta_key'), extractTag(metaBlock, 'wp:meta_value')];
        })
      );

      const category = extractAll(item, /<category domain="category"[^>]*>([\s\S]*?)<\/category>/g)
        .map((match) => decodeXmlText(match[1]))
        .filter(Boolean)[0] || 'Naujienos';

      const content = extractTag(item, 'content:encoded');
      const markdown = convertHtmlToMarkdown(content);
      const slug = extractTag(item, 'wp:post_name');
      const excerptSource = extractTag(item, 'excerpt:encoded') || stripTags(content);
      const excerpt = stripTags(excerptSource).slice(0, 240).trim();
      const title = extractTag(item, 'title');
      const seoTitle = normaliseSeoTitle(meta.get('_tsf_title_no_blogname'), title);
      const seoDescription = normaliseSeoDescription(meta.get('_genesis_description'), excerpt, title);
      const thumbnailUrl = attachmentMap.get(meta.get('_thumbnail_id'));

      return {
        slug,
        title,
        publishedAt: formatKeystaticDateTime(extractTag(item, 'pubDate')),
        excerpt,
        category,
        seoTitle,
        seoDescription,
        content: markdown,
        thumbnailUrl,
        isTrashed: slug.includes('__trashed') || meta.has('_wp_trash_meta_status'),
      };
    })
    .filter((post) => post.slug && !post.isTrashed);

  await rm(postsDir, { recursive: true, force: true });
  await rm(imagesDir, { recursive: true, force: true });
  await mkdir(postsDir, { recursive: true });
  await mkdir(imagesDir, { recursive: true });

  for (const post of posts) {
    const postDir = path.join(postsDir, post.slug);
    const postImageDir = path.join(imagesDir, post.slug);

    await mkdir(postDir, { recursive: true });

    let featuredImage;
    if (post.thumbnailUrl) {
      await mkdir(postImageDir, { recursive: true });
      const filename = normaliseFilename(post.thumbnailUrl);
      const targetPath = path.join(postImageDir, filename);
      const imageBuffer = await downloadBuffer(post.thumbnailUrl);
      await writeFile(targetPath, imageBuffer);
      featuredImage = `@assets/images/posts/${post.slug}/${filename}`;
    }

    const document = `${buildFrontmatter({
      ...post,
      featuredImage,
      featuredImageAlt: post.title,
    })}${post.content}\n`;

    await writeFile(path.join(postDir, 'index.mdoc'), document, 'utf8');
  }

  console.log(`Imported ${posts.length} posts into src/content/posts.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

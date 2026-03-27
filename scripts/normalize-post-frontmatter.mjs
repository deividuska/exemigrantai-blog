import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const postsDir = path.join(rootDir, 'src', 'content', 'posts');

function truncateText(value, maxLength = 160) {
  const text = value.replace(/\s+/g, ' ').trim();

  if (text.length <= maxLength) {
    return text;
  }

  const truncated = text.slice(0, maxLength + 1);
  const lastSpace = truncated.lastIndexOf(' ');
  return `${(lastSpace > 80 ? truncated.slice(0, lastSpace) : text.slice(0, maxLength)).trim()}...`;
}

function parseFrontmatter(document) {
  const match = document.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);

  if (!match) {
    throw new Error('Invalid mdoc frontmatter.');
  }

  const [, frontmatter, content] = match;
  const data = {};

  for (const line of frontmatter.split('\n')) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();

    if (!key) continue;

    try {
      data[key] = JSON.parse(rawValue);
    } catch {
      data[key] = rawValue;
    }
  }

  return { data, content };
}

function toYamlScalar(value) {
  return JSON.stringify(value ?? '');
}

function normaliseSeoTitle(value, title) {
  const seoTitle = (value || '').trim();
  return seoTitle && seoTitle !== '1' ? seoTitle : title;
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

function buildFrontmatter(data) {
  const lines = [
    '---',
    `title: ${toYamlScalar(data.title)}`,
    `publishedAt: ${toYamlScalar(data.publishedAt)}`,
    `excerpt: ${toYamlScalar(data.excerpt)}`,
    `category: ${toYamlScalar(data.category || 'Naujienos')}`,
  ];

  if (data.featuredImage) {
    lines.push(`featuredImage: ${toYamlScalar(data.featuredImage)}`);
  }

  if (data.featuredImageAlt) {
    lines.push(`featuredImageAlt: ${toYamlScalar(data.featuredImageAlt)}`);
  }

  lines.push(`seoTitle: ${toYamlScalar(data.seoTitle)}`);
  lines.push(`seoDescription: ${toYamlScalar(data.seoDescription)}`);
  lines.push('---', '');

  return lines.join('\n');
}

async function main() {
  const postDirectories = await readdir(postsDir, { withFileTypes: true });

  for (const entry of postDirectories) {
    if (!entry.isDirectory()) continue;

    const filePath = path.join(postsDir, entry.name, 'index.mdoc');
    const document = await readFile(filePath, 'utf8');
    const { data, content } = parseFrontmatter(document);

    const normalized = {
      ...data,
      seoTitle: normaliseSeoTitle(data.seoTitle, data.title),
      seoDescription: normaliseSeoDescription(data.seoDescription, data.excerpt, data.title),
    };

    delete normalized.readingTime;

    const nextDocument = `${buildFrontmatter(normalized)}${content.replace(/^\n*/, '')}`;
    await writeFile(filePath, nextDocument, 'utf8');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

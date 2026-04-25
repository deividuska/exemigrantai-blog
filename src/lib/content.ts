import { getCollection, getEntry, type CollectionEntry } from 'astro:content';

// This controls how many posts appear on the homepage and each archive page.
export const POSTS_PER_PAGE = 10;

export const defaultSettings = {
  homepageTitle: 'Naujausi įrašai',
  navigation: [{ label: 'Kontaktai', href: '/kontaktai' }],
  facebookGroupUrl: 'https://www.facebook.com/groups/372993659852080',
  footerText: 'Eks Emigrantai. All rights reserved.',
  affiliateAd: undefined,
};

export type PostEntry = CollectionEntry<'posts'>;

// Keystatic can save dates as either strings or Date objects, so we normalize both here.
export function parsePublishedAt(value: string | Date) {
  if (value instanceof Date) {
    return value;
  }

  const normalizedValue =
    /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`;
  const date = new Date(normalizedValue);

  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Invalid publishedAt value: ${value}`);
  }

  return date;
}

// Reading time is calculated automatically from the raw post body.
export function estimateReadingTime(content: string) {
  const plainText = content
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/`{1,3}[^`]*`{1,3}/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_\-\[\]\(\)\|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const wordCount = plainText ? plainText.split(/\s+/).length : 0;
  return Math.max(1, Math.ceil(wordCount / 200));
}

function stripMarkdown(content: string) {
  return content
    .replace(/^---[\s\S]*?---\s*/m, '')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/`{1,3}([^`]*)`{1,3}/g, '$1')
    .replace(/[*_~]+/g, '')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\|/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateExcerpt(content: string, maxLength = 180) {
  if (content.length <= maxLength) {
    return content;
  }

  const truncated = content.slice(0, maxLength + 1);
  const lastSpace = truncated.lastIndexOf(' ');
  return `${(lastSpace > 100 ? truncated.slice(0, lastSpace) : content.slice(0, maxLength)).trim()}...`;
}

// Cards, RSS, and SEO fallbacks all use this generated excerpt.
export function getPostExcerpt(post: PostEntry) {
  return truncateExcerpt(stripMarkdown(post.body));
}

function sortPosts(posts: PostEntry[]) {
  return posts.sort(
    (left, right) =>
      parsePublishedAt(right.data.publishedAt).getTime() -
      parsePublishedAt(left.data.publishedAt).getTime()
  );
}

export async function getAllPosts() {
  const posts = await getCollection('posts');
  return sortPosts(posts);
}

export async function getPost(slug: string) {
  return getEntry('posts', slug);
}

// The homepage uses page 1, and /page/2, /page/3, etc. use the same helper.
export async function getPaginatedPosts(page: number, perPage = POSTS_PER_PAGE) {
  const allPosts = await getAllPosts();
  const totalPosts = allPosts.length;
  const totalPages = Math.max(1, Math.ceil(totalPosts / perPage));
  const start = (page - 1) * perPage;
  const posts = allPosts.slice(start, start + perPage);

  return {
    posts,
    totalPosts,
    totalPages,
  };
}

export async function getSiteSettings() {
  const settings = await getEntry('settings', 'index');
  return settings?.data ?? defaultSettings;
}

export function formatLithuanianDate(value: string | Date) {
  return parsePublishedAt(value).toLocaleDateString('lt-LT', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

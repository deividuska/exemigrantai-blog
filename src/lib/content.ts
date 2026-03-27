import { getCollection, getEntry, type CollectionEntry } from 'astro:content';

export const POSTS_PER_PAGE = 9;

export const defaultSettings = {
  homepageTitle: 'Naujausi įrašai',
  navigation: [{ label: 'Kontaktai', href: '/kontaktai' }],
  facebookGroupUrl: 'https://www.facebook.com/groups/372993659852080',
  footerText: 'Eks Emigrantai. All rights reserved.',
};

export type PostEntry = CollectionEntry<'posts'>;

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

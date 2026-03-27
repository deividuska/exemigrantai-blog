import { getCollection, getEntry, type CollectionEntry } from 'astro:content';

export const POSTS_PER_PAGE = 9;

export const defaultSettings = {
  homepageTitle: 'Naujausi įrašai',
  navigation: [{ label: 'Kontaktai', href: '/kontaktai' }],
  facebookGroupUrl: 'https://www.facebook.com/groups/372993659852080',
  footerText: 'Eks Emigrantai. All rights reserved.',
};

export type PostEntry = CollectionEntry<'posts'>;

function sortPosts(posts: PostEntry[]) {
  return posts.sort(
    (left, right) =>
      new Date(right.data.publishedAt).getTime() - new Date(left.data.publishedAt).getTime()
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

export function formatLithuanianDate(value: string) {
  return new Date(value).toLocaleDateString('lt-LT', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

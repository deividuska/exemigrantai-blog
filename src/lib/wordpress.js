const WP_API_URL = import.meta.env.WP_API_URL || 'https://wp.emigrantai.lt/wp-json/wp/v2';
const WP_BASE_URL = WP_API_URL.replace('/wp-json/wp/v2', '');
const EASY_IO_CDN = 'enbxd79stev.exactdn.com';

// Number of posts per page - change this to show more/less posts
export const POSTS_PER_PAGE = 9;

// Convert WordPress image URLs to Easy IO CDN for WebP/AVIF and optimization
export function toEasyIOUrl(url) {
  if (!url) return url;
  return url.replace('wp.exemigrantai.lt', EASY_IO_CDN);
}

// Get total number of posts
export async function getTotalPosts() {
  try {
    const response = await fetch(`${WP_API_URL}/posts?per_page=1`);
    if (!response.ok) {
      return 0;
    }
    return parseInt(response.headers.get('X-WP-Total') || '0');
  } catch (error) {
    console.error('Error fetching total posts:', error);
    return 0;
  }
}

// Get posts with pagination
export async function getPosts(page = 1, perPage = POSTS_PER_PAGE) {
  try {
    const response = await fetch(`${WP_API_URL}/posts?_embed&per_page=${perPage}&page=${page}`);
    if (!response.ok) {
      console.error('Failed to fetch posts:', response.status);
      return { posts: [], totalPages: 0, totalPosts: 0 };
    }
    const posts = await response.json();
    const totalPosts = parseInt(response.headers.get('X-WP-Total') || '0');
    const totalPages = parseInt(response.headers.get('X-WP-TotalPages') || '0');
    return { posts, totalPages, totalPosts };
  } catch (error) {
    console.error('Error fetching posts:', error);
    return { posts: [], totalPages: 0, totalPosts: 0 };
  }
}

// Get all posts (for sitemap, etc.)
export async function getAllPosts() {
  try {
    const response = await fetch(`${WP_API_URL}/posts?_embed&per_page=100`);
    if (!response.ok) {
      console.error('Failed to fetch all posts:', response.status);
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching all posts:', error);
    return [];
  }
}

export async function getPost(slug) {
  try {
    const response = await fetch(`${WP_API_URL}/posts?slug=${slug}&_embed`);
    if (!response.ok) {
      console.error('Failed to fetch post:', response.status);
      return null;
    }
    const posts = await response.json();
    return posts[0] || null;
  } catch (error) {
    console.error('Error fetching post:', error);
    return null;
  }
}

export async function getPages() {
  try {
    const response = await fetch(`${WP_API_URL}/pages`);
    if (!response.ok) {
      console.error('Failed to fetch pages:', response.status);
      return [];
    }
    const pages = await response.json();
    return pages;
  } catch (error) {
    console.error('Error fetching pages:', error);
    return [];
  }
}

export async function getMenu(menuId) {
  try {
    // Try the provided menu ID first, then fallback to the other one
    const menuIds = menuId ? [menuId, menuId === 2 ? 4 : 2] : [2, 4];
    
    for (const id of menuIds) {
      const response = await fetch(`${WP_BASE_URL}/wp-json/menus/v1/menus/${id}`);
      
      if (response.ok) {
        const menu = await response.json();
        if (menu.items && menu.items.length > 0) {
          return menu.items;
        }
      }
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching menu:', error);
    return [];
  }
}

export async function getACFOptions() {
  try {
    const response = await fetch(`${WP_BASE_URL}/wp-json/custom/v1/options`);
    if (!response.ok) {
      console.error('Failed to fetch ACF options:', response.status);
      return {};
    }
    return response.json();
  } catch (error) {
    console.error('Error fetching ACF options:', error);
    return {};
  }
}

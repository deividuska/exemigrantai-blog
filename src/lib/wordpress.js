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

// Decode HTML entities (e.g., &#x2d; → -, &amp; → &)
export function decodeHtmlEntities(text) {
  if (!text) return '';
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// Get SEO description from post - checks SEO Framework fields first, then falls back to excerpt
export function getSeoDescription(post) {
  // The SEO Framework custom REST field (requires functions.php snippet)
  if (post?.seo_description) {
    return decodeHtmlEntities(post.seo_description);
  }
  
  // Other SEO plugins
  const seoDescription = 
    post?.yoast_head_json?.description ||  // Yoast
    post?.rank_math?.description ||         // Rank Math
    null;
  
  if (seoDescription) {
    return decodeHtmlEntities(seoDescription);
  }
  
  // Fallback to excerpt (strip HTML and limit length)
  const excerpt = post?.excerpt?.rendered?.replace(/<[^>]*>/g, '').trim() || '';
  const decoded = decodeHtmlEntities(excerpt);
  // Limit to ~160 characters for SEO
  return decoded.length > 160 ? decoded.substring(0, 157) + '...' : decoded;
}

// Get SEO title from post - checks SEO Framework fields first, then falls back to post title
export function getSeoTitle(post) {
  // The SEO Framework custom REST field (requires functions.php snippet)
  if (post?.seo_title) {
    return decodeHtmlEntities(post.seo_title);
  }
  
  // Other SEO plugins
  const seoTitle = 
    post?.yoast_head_json?.title ||  // Yoast
    post?.rank_math?.title ||         // Rank Math
    null;
  
  if (seoTitle) {
    return decodeHtmlEntities(seoTitle);
  }
  
  // Fallback to post title (decode HTML entities)
  return decodeHtmlEntities(post?.title?.rendered || '');
}

// Get OG title - falls back to SEO title
export function getOgTitle(post) {
  if (post?.seo_og_title) {
    return decodeHtmlEntities(post.seo_og_title);
  }
  return getSeoTitle(post);
}

// Get OG description - falls back to SEO description
export function getOgDescription(post) {
  if (post?.seo_og_description) {
    return decodeHtmlEntities(post.seo_og_description);
  }
  return getSeoDescription(post);
}

// Get Twitter title - falls back to OG title, then SEO title
export function getTwitterTitle(post) {
  if (post?.seo_twitter_title) {
    return decodeHtmlEntities(post.seo_twitter_title);
  }
  return getOgTitle(post);
}

// Get Twitter description - falls back to OG description, then SEO description
export function getTwitterDescription(post) {
  if (post?.seo_twitter_description) {
    return decodeHtmlEntities(post.seo_twitter_description);
  }
  return getOgDescription(post);
}

// Get social image URL from SEO Framework
export function getSocialImage(post) {
  // SEO Framework custom social image
  if (post?.seo_social_image) {
    return post.seo_social_image;
  }
  // Fallback to featured image
  return post?._embedded?.['wp:featuredmedia']?.[0]?.source_url || '';
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

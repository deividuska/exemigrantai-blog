const WP_API_URL = import.meta.env.WP_API_URL || 'https://wp.emigrantai.lt/wp-json/wp/v2';
const WP_BASE_URL = WP_API_URL.replace('/wp-json/wp/v2', '');

export async function getPosts() {
  try {
    const response = await fetch(`${WP_API_URL}/posts?_embed`);
    if (!response.ok) {
      console.error('Failed to fetch posts:', response.status);
      return [];
    }
    const posts = await response.json();
    return posts;
  } catch (error) {
    console.error('Error fetching posts:', error);
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

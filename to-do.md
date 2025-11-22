# Astro + WordPress Headless Blog Setup

## Project Overview
- **Frontend:** Astro (static site generator)
- **Backend:** WordPress REST API
- **Main domain:** emigrantai.lt (Astro frontend)
- **WordPress backend:** wp.emigrantai.lt

## Local Development Setup

### Prerequisites to Install
```bash
# Check if Node.js is installed (need v18+)
node --version

# If not installed, download from nodejs.org or use:
# Ubuntu/Debian:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify npm is installed
npm --version
```

### Step 1: Create Astro Project
```bash
# Create new Astro project
npm create astro@latest emigrantai-blog

# When prompted:
# - Template: Choose "Blog" or "Empty"
# - TypeScript: No (unless you want it)
# - Install dependencies: Yes
# - Git repository: Yes

cd emigrantai-blog
```

### Step 2: Install Required Dependencies
```bash
# For fetching WordPress data
npm install node-fetch

# Optional but recommended
npm install date-fns  # For date formatting
```

### Step 3: Configure WordPress API Connection

Create `.env` file in project root:
```env
WP_API_URL=https://wp.emigrantai.lt/wp-json/wp/v2
```

### Step 4: Create WordPress Fetch Utility

Create `src/lib/wordpress.js`:
```javascript
const WP_API_URL = import.meta.env.WP_API_URL || 'https://wp.emigrantai.lt/wp-json/wp/v2';

export async function getPosts() {
  const response = await fetch(`${WP_API_URL}/posts?_embed`);
  const posts = await response.json();
  return posts;
}

export async function getPost(slug) {
  const response = await fetch(`${WP_API_URL}/posts?slug=${slug}&_embed`);
  const posts = await response.json();
  return posts[0];
}

export async function getPages() {
  const response = await fetch(`${WP_API_URL}/pages`);
  const pages = await response.json();
  return pages;
}
```

### Step 5: Create Blog Post List Page

Update `src/pages/index.astro`:
```astro
---
import { getPosts } from '../lib/wordpress';

const posts = await getPosts();
---

<html lang="lt">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>Emigrantai.lt - Tinklaraštis</title>
  </head>
  <body>
    <main>
      <h1>Naujausi įrašai</h1>
      
      <div class="posts">
        {posts.map((post) => (
          <article>
            <h2>
              <a href={`/blog/${post.slug}`}>
                {post.title.rendered}
              </a>
            </h2>
            <time>{new Date(post.date).toLocaleDateString('lt-LT')}</time>
            <div set:html={post.excerpt.rendered} />
          </article>
        ))}
      </div>
    </main>
  </body>
</html>
```

### Step 6: Create Dynamic Blog Post Pages

Create `src/pages/blog/[slug].astro`:
```astro
---
import { getPosts, getPost } from '../../lib/wordpress';

export async function getStaticPaths() {
  const posts = await getPosts();
  
  return posts.map((post) => ({
    params: { slug: post.slug },
    props: { post },
  }));
}

const { slug } = Astro.params;
const post = await getPost(slug);
---

<html lang="lt">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>{post.title.rendered} - Emigrantai.lt</title>
  </head>
  <body>
    <main>
      <article>
        <h1 set:html={post.title.rendered} />
        <time>{new Date(post.date).toLocaleDateString('lt-LT')}</time>
        
        {post._embedded?.['wp:featuredmedia']?.[0] && (
          <img 
            src={post._embedded['wp:featuredmedia'][0].source_url} 
            alt={post.title.rendered}
          />
        )}
        
        <div set:html={post.content.rendered} />
      </article>
      
      <a href="/">← Atgal į pradžią</a>
    </main>
  </body>
</html>
```

### Step 7: Configure Astro Settings

Update `astro.config.mjs`:
```javascript
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://emigrantai.lt',
  output: 'static',
});
```

### Step 8: Local Development
```bash
# Start development server
npm run dev

# Opens at http://localhost:4321
# Hot reload enabled - changes appear instantly
```

### Step 9: Build for Production
```bash
# Build static site
npm run build

# Output goes to dist/ folder
# Preview the build locally:
npm run preview
```

### Step 10: Deploy to RunCloud
```bash
# Build the site
npm run build

# Upload dist/ contents to RunCloud server
# Option A: Using rsync (replace with your server details)
rsync -avz --delete dist/ runcloud@your-server-ip:/home/runcloud/webapps/emigrantai.lt/public/

# Option B: Using SFTP
# Connect to your RunCloud server via SFTP
# Upload all contents of dist/ folder to: /home/runcloud/webapps/emigrantai.lt/public/
```

## WordPress Setup (wp.emigrantai.lt)

### Required WordPress Configuration

1. **Enable REST API** (already enabled by default in WP 4.7+)

2. **Install recommended plugins:**
   - Yoast SEO (for better meta data in API)
   - Advanced Custom Fields (if you need custom fields)

3. **Enable CORS (if needed):**
   Add to WordPress `wp-config.php` or via plugin:
```php
   header("Access-Control-Allow-Origin: https://emigrantai.lt");
```

4. **Test API endpoint:**
   Visit: `https://wp.emigrantai.lt/wp-json/wp/v2/posts`
   Should return JSON data

## Project Structure
```
emigrantai-blog/
├── src/
│   ├── pages/
│   │   ├── index.astro          # Homepage (blog list)
│   │   └── blog/
│   │       └── [slug].astro     # Individual blog posts
│   ├── lib/
│   │   └── wordpress.js         # WordPress API functions
│   └── layouts/                 # (optional) Create layouts
├── public/                      # Static assets (images, etc.)
├── dist/                        # Build output (upload this to RunCloud)
├── .env                         # Environment variables
├── astro.config.mjs            # Astro configuration
└── package.json
```

## Workflow Summary

1. **Write post** in WordPress admin (wp.emigrantai.lt/wp-admin)
2. **Rebuild locally:** `npm run build`
3. **Upload dist/** to RunCloud server
4. **Done** - new post is live at emigrantai.lt

## Completed Setup

### ✅ GitHub Repository
- Repository: `deividuska/exemigrantai-blog`
- Branch: `main`
- All source code pushed (dist/ excluded via .gitignore)

### ✅ RunCloud Deployment
- Server path: `/home/runcloud/webapps/app-quitzon`
- Manual deployment via SFTP (FileZilla)
- Files uploaded from `dist/` folder

### ✅ Security & Performance
- Error handling added to all WordPress API functions (getPosts, getPost, getPages, getMenu)
- URL parsing improved in Header component (using URL constructor)
- Google Fonts optimized (non-blocking with media="print" onload="this.media='all'")
- Demo blog posts removed (first-post, second-post, third-post, markdown-style-guide, using-mdx)

### ✅ WordPress Backend Protection
- Cloudflare WAF custom rule configured
- Blocks wp.exemigrantai.lt frontend access
- Allows: wp-admin, wp-login, wp-json (REST API), wp-content, wp-includes
- SEO plugins work normally in admin

### ✅ Sitemap
- Generated at: `https://exemigrantai.lt/sitemap-index.xml`
- Contains only real WordPress posts (no demo posts)
- Ready for Google Search Console submission

## Automation Options (Future)

- Set up RunCloud Git deployment with automated build script
- Trigger rebuilds via WordPress webhook on post publish (WP Webhooks plugin)
- Alternative: GitHub Actions for automated deployments

## Current Workflow

1. **Write post** in WordPress admin (wp.exemigrantai.lt/wp-admin)
2. **Build locally:** `npm run build` 
3. **Upload via SFTP:** Upload `dist/` contents to `/home/runcloud/webapps/app-quitzon`
4. **Done** - new post is live at exemigrantai.lt

## Troubleshooting

**WordPress API not accessible:**
- Check CORS settings
- Verify wp.emigrantai.lt is live and accessible
- Test API endpoint directly in browser

**Build fails:**
- Check .env file has correct WP_API_URL
- Ensure WordPress has at least one published post
- Check Node.js version (need 18+)

**Images not loading:**
- WordPress images are served from wp.emigrantai.lt
- They load directly (no copying needed)
- Check WordPress media library URLs
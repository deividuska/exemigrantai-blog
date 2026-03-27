import rss from '@astrojs/rss';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';
import { getAllPosts } from '../lib/content';

export async function GET(context) {
	const posts = await getAllPosts();
	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		items: posts.map((post) => ({
			title: post.data.title,
			pubDate: new Date(post.data.publishedAt),
			description: post.data.excerpt,
			link: `/blog/${post.slug}/`,
		})),
	});
}

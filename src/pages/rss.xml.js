import rss from '@astrojs/rss';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';
import { getAllPosts } from '../lib/wordpress';

export async function GET(context) {
	const posts = await getAllPosts();
	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		items: posts.map((post) => ({
			title: post.title.rendered,
			pubDate: new Date(post.date),
			description: post.excerpt.rendered.replace(/<[^>]*>/g, ''),
			link: `/blog/${post.slug}/`,
		})),
	});
}

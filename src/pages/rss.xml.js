import rss from '@astrojs/rss';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';
import { getAllPosts, getPostExcerpt, parsePublishedAt } from '../lib/content';

export async function GET(context) {
	const posts = await getAllPosts();
	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		items: posts.map((post) => ({
			title: post.data.title,
			pubDate: parsePublishedAt(post.data.publishedAt),
			description: getPostExcerpt(post),
			link: `/blog/${post.slug}/`,
		})),
	});
}

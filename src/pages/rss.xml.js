import rss from '@astrojs/rss';
import config from '@config/config.json';
import { getSinglePage } from '@utils/getAllTags';

export async function GET(context) {
  const posts = await getSinglePage('blog');
  return rss({
    title: config.site.title,
    description: config.site.description,
    site: context.site,
    items: posts.map((post) => ({
      ...post.data,
      link: `/blog/${post.slug}/`,
    })),
  });
}

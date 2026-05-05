import type { APIContext } from "astro";
import rss from "@astrojs/rss";
import siteConfig from "../config/site";
import { getPublishedPosts } from "../lib/posts";

export async function GET(context: APIContext) {
  const posts = await getPublishedPosts();

  return rss({
    title: `${siteConfig.title} RSS`,
    description: siteConfig.description,
    site: context.site ?? siteConfig.origin,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      categories: post.data.tags,
      link: `/blog/${post.id}/`
    })),
    customData: `<language>en-us</language>`
  });
}

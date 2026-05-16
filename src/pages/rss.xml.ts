import type { APIContext } from "astro";
import rss from "@astrojs/rss";
import siteConfig from "../config/site";
import { getPublishedPosts } from "../lib/posts";
import { withBase, absoluteUrl } from "../lib/url";

export async function GET(context: APIContext) {
  const posts = await getPublishedPosts();

  return rss({
    title: "RSS Feed : Vibhor Dubey's Blog",
    description: siteConfig.description,
    site: absoluteUrl("/", context.site ?? siteConfig.origin),
    stylesheet: withBase('/rss/styles.xsl'),
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      categories: post.data.tags,
      link: withBase(`/blog/${post.id}/`)
    })),
    customData: `<language>en-us</language><link>${absoluteUrl("/", context.site ?? siteConfig.origin)}</link>`
  });
}

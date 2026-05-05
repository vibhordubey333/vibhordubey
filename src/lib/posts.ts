import { getCollection, type CollectionEntry } from "astro:content";
import siteConfig from "../config/site";

export type BlogEntry = CollectionEntry<"blog">;

export function sortPosts(posts: BlogEntry[]) {
  return [...posts].sort((left, right) => {
    const dateDiff = right.data.pubDate.valueOf() - left.data.pubDate.valueOf();

    if (dateDiff !== 0) {
      return dateDiff;
    }

    return left.data.title.localeCompare(right.data.title);
  });
}

export async function getPublishedPosts() {
  const posts = await getCollection("blog", ({ data }) => import.meta.env.DEV || !data.draft);
  return sortPosts(posts);
}

export function slugifyTag(tag: string) {
  return tag
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getTagCollection(posts: BlogEntry[]) {
  const tagCounts = new Map<string, number>();

  for (const post of posts) {
    for (const tag of post.data.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  return [...tagCounts.entries()]
    .map(([label, count]) => ({
      label,
      slug: slugifyTag(label),
      count
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function getPostsForTag(posts: BlogEntry[], tagSlug: string) {
  return sortPosts(posts.filter((post) => post.data.tags.some((tag) => slugifyTag(tag) === tagSlug)));
}

export function getTagLabel(posts: BlogEntry[], tagSlug: string) {
  return getTagCollection(posts).find((tag) => tag.slug === tagSlug)?.label;
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat(siteConfig.dateLocale, {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

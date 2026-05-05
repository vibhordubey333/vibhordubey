import siteConfig from "../config/site";

export function withBase(path = "/") {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL.slice(0, -1)
    : import.meta.env.BASE_URL;
  const normalized = path.startsWith("/") ? path : `/${path}`;

  if (normalized === "/") {
    return `${base || "/"}`;
  }

  return `${base}${normalized}`;
}

export function absoluteUrl(path = "/", site: string | URL = siteConfig.origin) {
  const href = withBase(path);
  return new URL(href, site).toString();
}

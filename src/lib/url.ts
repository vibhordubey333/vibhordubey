import siteConfig from "../config/site";

export function withBase(path = "/") {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  // Use process.env for Vitest, fallback to import.meta.env for Astro
  const baseEnv = process.env.BASE_URL || import.meta.env?.BASE_URL || "/";
  const base = baseEnv.endsWith("/")
    ? baseEnv.slice(0, -1)
    : baseEnv;
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

# Field Notes by Vibhor Dubey

**Live at:** [https://vibhordubey333.github.io/vibhordubey](https://vibhordubey333.github.io/vibhordubey)

A POSSE-style technical blog built with [Astro](https://astro.build/) and deployed on GitHub Pages.

The publishing model is simple:

1. Write in Markdown on your own site.
2. Publish there first.
3. Syndicate outward to Medium, dev.to, and other platforms.
4. Keep the canonical URL pointing back to your site.

## Why this stack

- **Astro** keeps the site fast, static, and content-first.
- **Markdown content collections** make posts easy to write and easy to validate.
- **GitHub** stays the source of truth for the site, content, and deployment history.
- **GitHub Pages** keeps hosting simple and backend-free.

## Features

- Markdown-based posts with typed frontmatter
- Home, Blog, About, Tags, and RSS navigation
- RSS feed at `/rss.xml`
- SEO metadata, canonical URLs, Open Graph tags, and Twitter card tags
- JSON-LD for `WebSite`, `Person`, and `BlogPosting`
- Built-in Shiki syntax highlighting for code fences
- Tag archive pages
- Optional `Syndicated to` links per post
- Accessible, responsive editorial layout

## Project structure

```text
/
├── .github/workflows/deploy.yml
├── public/
│   ├── favicon.svg
│   ├── og/default-social.svg
│   └── robots.txt
├── src/
│   ├── components/
│   ├── config/site.ts
│   ├── content/blog/
│   ├── layouts/BaseLayout.astro
│   ├── lib/
│   ├── pages/
│   ├── styles/global.css
│   └── content.config.ts
├── astro.config.mjs
├── package.json
└── tsconfig.json
```

## Local development

Install dependencies:

```bash
npm install
```

Start the local development server:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

Run Astro checks:

```bash
npm run check
```

## Writing a new post

Create a new Markdown file in `src/content/blog/`.

Suggested filename:

```text
src/content/blog/my-new-post.md
```

Recommended frontmatter template:

```md
---
title: My New Post
description: A short summary for cards, search results, and feeds.
pubDate: 2026-05-05
updatedDate: 2026-05-06
tags:
  - Astro
  - Publishing
category: Tooling
type: tutorial
heroImage: /og/default-social.svg
syndicatedTo:
  - platform: Medium
    url: https://example.com/my-medium-post
  - platform: dev.to
    url: https://example.com/my-devto-post
draft: false
---
```

Notes:

- `tags` are required and power the archive pages.
- `type` is optional and intended for `tutorial`, `note`, or `essay`.
- `draft: true` keeps a post out of production builds.
- `syndicatedTo` is optional and only renders when links are present.

## POSSE publishing workflow

The intended rhythm is:

1. Write the post locally in Markdown.
2. Preview it with `npm run dev`.
3. Commit and push the post.
4. Let GitHub Pages deploy the canonical version.
5. Publish adapted versions to Medium, dev.to, or other platforms.
6. On those platforms, set the canonical URL to the original post on this site.
7. Come back to the source Markdown file and add the outbound syndication links in `syndicatedTo`.
8. Push again so the original post documents where it has been republished.

This keeps the GitHub repository as the durable source of truth.

## Deployment to GitHub Pages

This repo is configured as a **project site**, so Astro uses:

- `site: "https://vibhordubey333.github.io"`
- `base: "/vibhordubey"`

### GitHub setup

1. Push this repository to GitHub.
2. Go to `Settings -> Pages`.
3. Set the source to **GitHub Actions**.
4. Push to `master` to trigger deployment.

The workflow lives at `.github/workflows/deploy.yml` and uses:

- `withastro/action@v6` to install dependencies, build the site, and upload the artifact
- `actions/deploy-pages@v5` to publish the build

If the default branch is renamed from `master` to `main`, update the workflow trigger in `.github/workflows/deploy.yml`.

## Changing the site URL later

### If you rename the repository

Update these values:

- `astro.config.mjs` -> `base`
- `src/config/site.ts` -> `repoName` if you want the config to stay descriptive
- `public/robots.txt` -> sitemap URL if needed

### If you move to a custom domain

1. Add `public/CNAME` with your custom domain on one line.
2. Change `site` in `astro.config.mjs` to your custom domain.
3. Remove the `base` setting from `astro.config.mjs`.
4. Update the URLs in `public/robots.txt`.

## Accessibility and design notes

- The layout includes a skip link and clear keyboard focus states.
- Typography uses a serif headline voice, a clean sans-serif body, and a readable mono stack for code.
- Motion is intentionally light and respects `prefers-reduced-motion`.
- The site stays intentionally small so writing remains the main event.

## Sample content

Three example posts are included:

- a GitHub Pages + Astro tutorial
- a short note on content collections
- a POSSE-focused essay with illustrative syndication links

The sample syndication URLs are placeholders. Replace them with real platform URLs after publishing.

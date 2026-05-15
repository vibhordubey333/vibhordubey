# Blog Authoring Guidelines

This directory contains the blog posts for the site. When creating new posts, please follow these guidelines to ensure consistency across the site.

## Frontmatter Schema

Every markdown file must include the following frontmatter:

```yaml
---
title: "Your Post Title"
description: "A short, 1-2 sentence description of the post."
pubDate: 2026-05-15
updatedDate: 2026-05-16 # Optional
draft: false # Optional, defaults to false
tags:
  - Tag1
  - Tag2
category: Engineering # Optional
type: tutorial # Optional: "tutorial", "note", or "essay"
heroImage: "/path/to/image.jpg" # Optional
syndicatedTo: # Optional
  - platform: "Medium"
    url: "https://medium.com/..."
---
```

## Custom HTML Components

Astro supports raw HTML inside Markdown. We use several custom HTML components for rich content:

### 1. Callouts
Use callouts to highlight important information, warnings, or tips.

```html
<div class="callout info">
  <div class="callout-label">Note</div>
  This is an informational callout.
</div>

<div class="callout warn">
  <div class="callout-label">Warning</div>
  This is a warning callout.
</div>

<div class="callout danger">
  <div class="callout-label">Danger</div>
  This is a danger callout.
</div>

<div class="callout success">
  <div class="callout-label">Success</div>
  This is a success callout.
</div>
```

### 2. Scenarios
Use scenarios to present real-world problems and solutions.

```html
<div class="scenario">
  <div class="scenario-header">
    <span class="scenario-tag tag-real-world">Real World</span>
    <span class="scenario-title">The Problem Scenario</span>
  </div>
  <div class="scenario-body">
    <p>Describe the scenario here.</p>
  </div>
</div>
```
Available tags: `tag-real-world`, `tag-problem`, `tag-fix`, `tag-demo`.

### 3. Transaction Visualizations
Use this component to visualize concurrent database transactions or timelines.

```html
<div class="txn-viz">
  <div class="txn-col txn1">
    <div class="txn-header">Transaction A</div>
    <div class="txn-step"><span class="step-time">T1</span> BEGIN;</div>
    <div class="txn-step highlight"><span class="step-time">T3</span> SELECT * FROM table;</div>
  </div>
  <div class="txn-col txn2">
    <div class="txn-header">Transaction B</div>
    <div class="txn-step"><span class="step-time">T2</span> BEGIN;</div>
    <div class="txn-step error"><span class="step-time">T4</span> UPDATE table SET val = 1;</div>
  </div>
</div>
```
Step modifiers: `highlight`, `error`, `success`, `wait`, `empty`.

### 4. Comparison Cards
Use comparison cards to contrast two approaches side-by-side.

```html
<div class="compare-grid">
  <div class="compare-card pessimistic">
    <div class="compare-card-header">Pessimistic Locking</div>
    <div class="compare-card-body">
      <ul>
        <li>Locks data immediately</li>
        <li>Prevents conflicts early</li>
      </ul>
    </div>
  </div>
  <div class="compare-card optimistic">
    <div class="compare-card-header">Optimistic Locking</div>
    <div class="compare-card-body">
      <ul>
        <li>Checks for conflicts at commit</li>
        <li>Better for read-heavy workloads</li>
      </ul>
    </div>
  </div>
</div>
```

## Styling Conventions

- The site uses a light/dark theme. Custom components should use the CSS variables defined in `src/styles/global.css` (e.g., `--post-bg`, `--post-surface`, `--post-accent`) to ensure they look good in both themes.
- Do not use inline styles with hardcoded colors.
- Use `---` or `<div class="divider"></div>` for section breaks.

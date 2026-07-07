# jrowing.com — site redesign

A complete set of Jekyll layouts and shared CSS covering the whole site.

## File structure

```
_layouts/
  default.html     — base layout (nav + footer + theme toggle) used by all pages
  home.html        — homepage with hero, latest card, projects grid
  writing.html     — writing index (lists posts automatically, falls back to static)
  cv.html          — curriculum vitae
  post.html        — individual article / essay

_includes/
  nav.html         — sticky nav with dark mode toggle, active-link detection
  footer.html      — find-me links + copyright
  theme-script.html — tiny inline script that sets data-theme before first paint

assets/css/
  main.css         — single CSS file covering all page types
```

## Integration

1. Copy all folders into your Jekyll repo root.
2. Update front matter on existing pages:

```yaml
# index.md / index.html
---
layout: home
---

# writing.html
---
layout: writing
title: Writing — Joe Rowing
---

# cv.html
---
layout: cv
title: CV — Joe Rowing
---

# _posts/*.md  (individual posts)
---
layout: post
title: "Your post title"
description: "One-sentence teaser shown on the writing index and in the latest card."
date: 2026-07-06
---
```

3. Remove any inline `<style>` blocks or per-page CSS links that conflict.
4. In `_config.yml`, add:

```yaml
description: "Chartered Physicist, educator, and author. Teaching physics on Praslin, Seychelles."
```

## Dark mode

- Stored in `localStorage` under the key `theme`.
- On first visit, respects `prefers-color-scheme` (system setting).
- The `theme-script.html` include runs inline in `<head>` before first paint — no flash of wrong theme.
- The toggle button in the nav switches between modes; the `<script>` at the bottom of each layout wires up the click handler.
- All colours are CSS custom properties in two blocks at the top of `main.css` — easy to adjust.

## Accent colour

In dark mode: `#c8a96e` (warm amber-gold).
In light mode: falls back to `--text-muted` (neutral grey).
Used on: italic brand name, section labels, project numbers, "Read →" link, latest-writing label, footer col labels, CV section labels, list dashes, active nav underline.

To change the dark accent: edit `--accent` in the `[data-theme="dark"]` block in `main.css`.

## Resource pages (interactive HTML tools)

Individual resource pages (car friction sim, spinners, etc.) are standalone HTML files and don't use the Jekyll layout system. To give them the same nav/footer, either:

a) Convert them to use `layout: default` and put their interactive content in `{{ content }}`
b) Add a small `<link rel="stylesheet" href="/assets/css/main.css">` and copy in the nav/footer HTML manually

Option (a) is cleaner long-term.

## Nav active states

The nav uses Jekyll's `page.url` to set `aria-current="page"` on the current link. This works automatically — no configuration needed.

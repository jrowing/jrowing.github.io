# jrowing.com

Jekyll site hosted on GitHub Pages.

## File structure

```
_config.yml
index.html          ← homepage
resources.html      ← resources index
planner.html        ← planner page
blog.html           ← blog index
cv.html             ← CV
_layouts/
  default.html      ← nav + footer shell (used by everything)
  post.html         ← blog post pages
  resource.html     ← individual resource pages
assets/css/
  style.css         ← all styles
_posts/
  YYYY-MM-DD-title.md   ← blog posts go here
resources/
  yourfile.html     ← resource pages go here
```

## Adding a resource page

Create a file in `resources/` with this front matter:

```
---
layout: resource
title: "Page Title"
is_resource: true
description: "Optional description shown on the resources page"
---

Your content here.
```

## Adding a blog post

Create a file in `_posts/` named `YYYY-MM-DD-title.md`:

```
---
layout: post
title: "Post Title"
date: 2026-05-15
tags: [physics, teaching]
---

Your content here.
```

## Important

There are NO index.html files inside subfolders. All main pages live at the root as `.html` files. The old `planner/`, `resources/`, `blog/`, and `cv/` subfolders with their own `index.html` files must be deleted from the repo — they will override the new flat files.

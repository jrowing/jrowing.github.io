# jrowing.com

Personal site for Joe Rowing, built with Jekyll and hosted on GitHub Pages.

## Adding a resource page

1. Create an HTML file anywhere in the `resources/` folder
2. Add these **two lines** at the very top:

```
---
layout: resource
title: "Your Page Title Here"
is_resource: true
---
```

3. Write your content below the `---`
4. Push to GitHub — it appears in the nav and homepage automatically

That's it. No config files to edit, no JSON to update.

---

## Setup (first time)

1. Push this repo to GitHub
2. Go to **Settings → Pages → Deploy from branch `main` / root**
3. Point your domain DNS at GitHub Pages (or use the default `username.github.io` URL)

## File structure

```
.
├── _config.yml           ← Site settings
├── _layouts/
│   ├── default.html      ← Nav + footer shell used by all pages
│   └── resource.html     ← Wrapper for resource pages (adds back link)
├── index.html            ← Homepage
└── resources/
    └── waves-optics.html ← Example resource (copy to add more)
```

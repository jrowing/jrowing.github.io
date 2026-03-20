# jrowing.com — Jekyll / GitHub Pages Site

A Jekyll site for Joe Rowing. GitHub Pages builds it natively — no Actions workflow, no build scripts.

---

## Setup (5 minutes)

### 1. Push to GitHub
```bash
git init && git add . && git commit -m "initial commit"
# Create a new repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### 2. Enable GitHub Pages
- **Settings → Pages**
- Source: **Deploy from a branch**
- Branch: `main`, folder: `/ (root)`
- GitHub detects Jekyll automatically — no extra configuration needed.

### 3. Custom domain (optional)
Add a file called `CNAME` at the repo root containing just:
```
jrowing.com
```
Then update your DNS to point to GitHub Pages (see GitHub's docs for current IP addresses).

---

## Adding a resource page

Create a file in `resources/` — either `.html` or `.md` — starting with this front matter:

```
---
layout: resource
title: "Your Page Title"
is_resource: true
---
```

Push it. GitHub Pages rebuilds the site and the page appears in the homepage Resources
section and the nav dropdown automatically. No other files to edit.

### Markdown example
```markdown
---
layout: resource
title: "Newton's Laws — Summary Sheet"
is_resource: true
---

## Newton's Laws

Content here in normal Markdown...
```

### HTML example
```html
---
layout: resource
title: "Interactive Wave Demo"
is_resource: true
---

<h2>Wave Demo</h2>
<p>Full HTML content here...</p>
```

---

## File structure

```
.
├── _config.yml           ← Site settings
├── _layouts/
│   ├── default.html      ← Base layout (nav + footer)
│   └── resource.html     ← Layout for resource pages
├── _includes/
│   ├── nav.html          ← Shared nav (auto-lists resources via Liquid)
│   └── styles.html       ← Shared CSS variables & nav styles
├── index.html            ← Homepage
├── Gemfile               ← github-pages gem (for local preview)
└── resources/
    ├── waves-optics.html ← Example HTML resource
    └── dataloggers.md    ← Example Markdown resource
```

---

## Local preview (optional)

```bash
gem install bundler
bundle install
bundle exec jekyll serve
# Open http://localhost:4000
```

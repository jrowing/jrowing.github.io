# jrowing.com

## Structure — everything is flat at the root

```
_config.yml
index.html          homepage
resources.html      resources list
planner.html        planner
cv.html             CV
_layouts/
  default.html      nav + footer (used by all pages)
  resource.html     individual resource pages
assets/css/
  style.css
resources/
  physics-notes.html
  diving.html
  car_friction_wide.html
  teacher-calendar.html
  (etc — resource pages only, NO index.html here)
```

No blog. No subfolders with their own index pages.

## Adding a resource page

Drop a file in `resources/` with this front matter:

```
---
layout: resource
title: "Page Title"
is_resource: true
description: "One-line description (shown on resources list)"
---
```

It will automatically appear in the nav dropdown and on the resources page.

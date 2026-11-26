#!/usr/bin/env python3
"""Share new _writing posts to Bluesky with a link card.

Used by .github/workflows/bluesky-share.yml. For each post file given on the
command line it:
  - skips drafts (published: false) and posts with `bluesky: false`
  - skips posts already shared (a post in your feed already links to the URL)
  - waits until the article is live on the site, so the link works
  - posts "Title + description" with a link card (and the first image as thumbnail)

The comments box on each article finds this Bluesky post by itself, so nothing
needs writing back into the repo.

Env: BLUESKY_HANDLE, BLUESKY_APP_PASSWORD, SITE_URL (e.g. https://www.jrowing.com)
"""
import datetime
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

HANDLE = os.environ.get("BLUESKY_HANDLE", "jrowing.com")
PASSWORD = os.environ.get("BLUESKY_APP_PASSWORD", "")
SITE = os.environ.get("SITE_URL", "https://www.jrowing.com").rstrip("/")
PDS = "https://bsky.social"
APPVIEW = "https://public.api.bsky.app"
UA = {"User-Agent": "jrowing.com bluesky-share"}


def http(url, data=None, headers=None, method=None):
    h = dict(UA)
    h.update(headers or {})
    if isinstance(data, (dict, list)):
        data = json.dumps(data).encode()
        h.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    with urllib.request.urlopen(req, timeout=30) as r:
        body = r.read()
        ctype = r.headers.get("Content-Type", "")
    return json.loads(body) if "json" in ctype else body


def front_matter(path):
    text = open(path, encoding="utf-8").read()
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", text, re.S)
    if not m:
        return {}, text
    fm = {}
    for line in m.group(1).splitlines():
        mm = re.match(r"^([A-Za-z_]+):\s*(.*)$", line)
        if mm:
            v = mm.group(2).strip()
            if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
                v = v[1:-1].replace('\\"', '"')
            fm[mm.group(1)] = v
    return fm, m.group(2)


def norm(u):
    p = urllib.parse.urlparse(u)
    host = p.netloc.lower().removeprefix("www.")
    return host + p.path.rstrip("/")


def already_shared(url):
    target = norm(url)
    cursor = None
    for _ in range(3):  # last ~300 posts
        q = {"actor": HANDLE, "limit": 100, "filter": "posts_no_replies"}
        if cursor:
            q["cursor"] = cursor
        feed = http(f"{APPVIEW}/xrpc/app.bsky.feed.getAuthorFeed?" + urllib.parse.urlencode(q))
        for item in feed.get("feed", []):
            post = item.get("post", {})
            if post.get("author", {}).get("handle") != HANDLE:
                continue  # reposts of other people
            rec = post.get("record", {})
            ext = (rec.get("embed") or {}).get("external") or {}
            links = [ext.get("uri", "")]
            for f in rec.get("facets", []) or []:
                for feat in f.get("features", []):
                    links.append(feat.get("uri", ""))
            if any(l and norm(l) == target for l in links):
                return True
        cursor = feed.get("cursor")
        if not cursor:
            break
    return False


def wait_until_live(url, minutes=15):
    deadline = time.time() + minutes * 60
    while time.time() < deadline:
        try:
            urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20)
            return True
        except urllib.error.HTTPError as e:
            if e.code != 404:
                print(f"  {url} -> HTTP {e.code}, retrying")
        except Exception as e:
            print(f"  {url} -> {e}, retrying")
        time.sleep(30)
    return False


def thumbnail(body, session):
    m = re.search(r'<img[^>]+src="(/[^"]+\.(?:png|jpe?g|webp|gif))"', body, re.I)
    if not m:
        return None
    path = urllib.parse.unquote(m.group(1)).lstrip("/")
    if not os.path.isfile(path) or os.path.getsize(path) == 0:
        return None
    try:
        from PIL import Image
        im = Image.open(path).convert("RGB")
        im.thumbnail((1200, 1200))
        buf = io.BytesIO()
        q = 85
        while True:
            buf.seek(0); buf.truncate()
            im.save(buf, "JPEG", quality=q)
            if buf.tell() < 950_000 or q <= 40:
                break
            q -= 10
        data, mime = buf.getvalue(), "image/jpeg"
    except Exception as e:
        print(f"  thumbnail skipped: {e}")
        return None
    res = http(f"{PDS}/xrpc/com.atproto.repo.uploadBlob", data=data,
               headers={"Authorization": f"Bearer {session['accessJwt']}", "Content-Type": mime})
    return res.get("blob")


def clip(s, n):
    s = re.sub(r"\s+", " ", s).strip()
    return s if len(s) <= n else s[: n - 1].rstrip() + "…"


def share(path, session):
    fm, body = front_matter(path)
    name = os.path.splitext(os.path.basename(path))[0]
    if fm.get("published", "").lower() == "false":
        print(f"skip {name}: draft"); return
    if fm.get("bluesky", "").lower() == "false" or fm.get("comments", "").lower() == "false":
        print(f"skip {name}: bluesky/comments turned off"); return
    url = f"{SITE}/writing/{name}.html"
    if already_shared(url):
        print(f"skip {name}: already on Bluesky"); return
    if not wait_until_live(url):
        print(f"skip {name}: {url} never went live"); return

    title = fm.get("title") or name.replace("-", " ").capitalize()
    desc = re.sub(r"<[^>]+>|\$+", "", fm.get("description", ""))
    text = title if not desc else f"{title}\n\n{clip(desc, 300 - len(title) - 2)}"
    text = text[:300]

    external = {"uri": url, "title": title, "description": clip(desc, 300)}
    thumb = thumbnail(body, session)
    if thumb:
        external["thumb"] = thumb

    record = {
        "$type": "app.bsky.feed.post",
        "text": text,
        "createdAt": datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
        "langs": ["en"],
        "embed": {"$type": "app.bsky.embed.external", "external": external},
    }
    res = http(f"{PDS}/xrpc/com.atproto.repo.createRecord",
               data={"repo": session["did"], "collection": "app.bsky.feed.post", "record": record},
               headers={"Authorization": f"Bearer {session['accessJwt']}"})
    rkey = res["uri"].rsplit("/", 1)[-1]
    print(f"posted {name}: https://bsky.app/profile/{HANDLE}/post/{rkey}")


def main(paths):
    paths = [p for p in paths if p.startswith("_writing/") and os.path.isfile(p)]
    if not paths:
        print("No new writing posts to share."); return
    if not PASSWORD:
        sys.exit("BLUESKY_APP_PASSWORD secret is not set.")
    session = http(f"{PDS}/xrpc/com.atproto.server.createSession",
                   data={"identifier": HANDLE, "password": PASSWORD})
    for p in paths:
        try:
            share(p, session)
        except urllib.error.HTTPError as e:
            print(f"failed {p}: HTTP {e.code} {e.read()[:300]!r}")


if __name__ == "__main__":
    main(sys.argv[1:])

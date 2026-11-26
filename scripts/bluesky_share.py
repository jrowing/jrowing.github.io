#!/usr/bin/env python3
"""Share jrowing.com articles and resources on Bluesky.

Two modes, used by the workflows in .github/workflows/:

  bluesky_share.py share FILE...   Share these files now (new posts, or by hand).
  bluesky_share.py drip            Maybe share one random not-yet-shared item.

Every share is recorded in _data/bluesky.json (page path -> Bluesky post), which
the comments box under each page uses to find its replies.

Drip pacing (env, all optional):
  DRIP_CHANCE    chance that any one scheduled run posts      (default 0.12)
  DRIP_MIN_DAYS  minimum days since the last share of anything (default 2)
With the schedule in bluesky-drip.yml (5 runs a day, daytime UTC) that works out
at roughly two posts a week, on random days at random times.

Skips anything with `published: false`, `bluesky: false` or `comments: false`.

Env: BLUESKY_HANDLE, BLUESKY_APP_PASSWORD, SITE_URL
"""
import datetime
import glob
import io
import json
import os
import random
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

HANDLE = os.environ.get("BLUESKY_HANDLE", "jrowing.com")
PASSWORD = os.environ.get("BLUESKY_APP_PASSWORD", "")
SITE = os.environ.get("SITE_URL", "https://www.jrowing.com").rstrip("/")
DRIP_CHANCE = float(os.environ.get("DRIP_CHANCE", "0.12"))
DRIP_MIN_DAYS = float(os.environ.get("DRIP_MIN_DAYS", "2"))
DATA = "_data/bluesky.json"
PDS = "https://bsky.social"
APPVIEW = "https://public.api.bsky.app"
UA = {"User-Agent": "jrowing.com bluesky-share"}
COLLECTIONS = {"_writing": "writing", "_resources": "resources"}


# ── helpers ──────────────────────────────────────────────────────────────────

def http(url, data=None, headers=None):
    h = dict(UA)
    h.update(headers or {})
    if isinstance(data, (dict, list)):
        data = json.dumps(data).encode()
        h.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=data, headers=h)
    with urllib.request.urlopen(req, timeout=30) as r:
        body = r.read()
        ctype = r.headers.get("Content-Type", "")
    return json.loads(body) if "json" in ctype else body


def now():
    return datetime.datetime.now(datetime.timezone.utc)


def iso(dt):
    return dt.isoformat().replace("+00:00", "Z")


def norm(u):
    p = urllib.parse.urlparse(u)
    return p.netloc.lower().removeprefix("www.") + p.path.rstrip("/")


def front_matter(path):
    text = open(path, encoding="utf-8").read()
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", text, re.S)
    if not m:
        return None, text
    fm = {}
    for line in m.group(1).splitlines():
        mm = re.match(r"^([A-Za-z_]+):\s*(.*)$", line)
        if mm:
            v = mm.group(2).strip()
            if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
                v = v[1:-1].replace('\\"', '"')
            fm[mm.group(1)] = v
    return fm, m.group(2)


def page_path(file):
    folder = file.split("/", 1)[0]
    name = os.path.splitext(os.path.basename(file))[0]
    return f"/{COLLECTIONS[folder]}/{name}.html"


def shareable(file):
    """Return (front matter, body) if this file should be shared, else None."""
    if not file.endswith((".html", ".md")) or file.split("/", 1)[0] not in COLLECTIONS:
        return None
    if not os.path.isfile(file):
        return None
    fm, body = front_matter(file)
    if fm is None:
        return None
    for key in ("published", "bluesky", "comments"):
        if fm.get(key, "").lower() == "false":
            return None
    if fm.get("redirect_to"):
        return None
    return fm, body


def load_data():
    try:
        return json.load(open(DATA, encoding="utf-8"))
    except (FileNotFoundError, ValueError):
        return {}


def save_data(data):
    os.makedirs(os.path.dirname(DATA), exist_ok=True)
    with open(DATA, "w", encoding="utf-8") as f:
        json.dump(dict(sorted(data.items())), f, indent=2, ensure_ascii=False)
        f.write("\n")


def my_site_posts(max_pages=40):
    """All of my own Bluesky posts that link to the site: {normalised url: (uri, createdAt)}."""
    found, cursor = {}, None
    for _ in range(max_pages):
        q = {"actor": HANDLE, "limit": 100, "filter": "posts_no_replies"}
        if cursor:
            q["cursor"] = cursor
        feed = http(f"{APPVIEW}/xrpc/app.bsky.feed.getAuthorFeed?" + urllib.parse.urlencode(q))
        for item in feed.get("feed", []):
            post = item.get("post", {})
            if item.get("reason") or post.get("author", {}).get("handle") != HANDLE:
                continue
            rec = post.get("record", {})
            emb = rec.get("embed") or {}
            ext = emb.get("external") or (emb.get("media") or {}).get("external") or {}
            links = [ext.get("uri", "")]
            for f in rec.get("facets") or []:
                links += [x.get("uri", "") for x in f.get("features", [])]
            for l in links:
                n = norm(l) if l else ""
                if n.startswith(norm(SITE)) and n not in found:
                    found[n] = (post["uri"], rec.get("createdAt", ""))
        cursor = feed.get("cursor")
        if not cursor:
            break
    return found


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


def clip(s, n):
    s = re.sub(r"\s+", " ", s).strip()
    return s if len(s) <= n else s[: n - 1].rstrip() + "…"


# ── posting ──────────────────────────────────────────────────────────────────

class Bluesky:
    def __init__(self):
        if not PASSWORD:
            sys.exit("BLUESKY_APP_PASSWORD secret is not set.")
        s = http(f"{PDS}/xrpc/com.atproto.server.createSession",
                 data={"identifier": HANDLE, "password": PASSWORD})
        self.jwt, self.did = s["accessJwt"], s["did"]

    def auth(self, extra=None):
        h = {"Authorization": f"Bearer {self.jwt}"}
        h.update(extra or {})
        return h

    def thumbnail(self, body):
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
            buf, q = io.BytesIO(), 85
            while True:
                buf.seek(0); buf.truncate()
                im.save(buf, "JPEG", quality=q)
                if buf.tell() < 950_000 or q <= 40:
                    break
                q -= 10
        except Exception as e:
            print(f"  thumbnail skipped: {e}")
            return None
        res = http(f"{PDS}/xrpc/com.atproto.repo.uploadBlob", data=buf.getvalue(),
                   headers=self.auth({"Content-Type": "image/jpeg"}))
        return res.get("blob")

    def post(self, file, fm, body):
        path = page_path(file)
        url = SITE + path
        name = os.path.splitext(os.path.basename(file))[0]
        title = fm.get("title") or name.replace("-", " ").capitalize()
        desc = re.sub(r"<[^>]+>|\$+|\\\\?[a-z]+\{?", "", fm.get("description", "")).strip()
        text = title if not desc else f"{title}\n\n{clip(desc, 300 - len(title) - 2)}"
        external = {"uri": url, "title": title, "description": clip(desc, 300)}
        thumb = self.thumbnail(body)
        if thumb:
            external["thumb"] = thumb
        record = {
            "$type": "app.bsky.feed.post",
            "text": text[:300],
            "createdAt": iso(now()),
            "langs": ["en"],
            "embed": {"$type": "app.bsky.embed.external", "external": external},
        }
        res = http(f"{PDS}/xrpc/com.atproto.repo.createRecord",
                   data={"repo": self.did, "collection": "app.bsky.feed.post", "record": record},
                   headers=self.auth())
        web = f"https://bsky.app/profile/{HANDLE}/post/{res['uri'].rsplit('/', 1)[-1]}"
        print(f"posted {path}: {web}")
        return {"uri": res["uri"], "url": web, "date": record["createdAt"]}


# ── modes ────────────────────────────────────────────────────────────────────

def cmd_share(files):
    data = load_data()
    todo = [(f, shareable(f)) for f in files]
    todo = [(f, s) for f, s in todo if s]
    if not todo:
        print("Nothing to share."); return
    feed = my_site_posts()
    bsky = None
    for f, (fm, body) in todo:
        path = page_path(f)
        if path in data or norm(SITE + path) in feed:
            print(f"skip {path}: already on Bluesky"); continue
        if not wait_until_live(SITE + path):
            print(f"skip {path}: never went live"); continue
        bsky = bsky or Bluesky()
        data[path] = bsky.post(f, fm, body)
        save_data(data)


def cmd_drip():
    data = load_data()
    feed = my_site_posts()

    # Anything already shared by hand gets recorded too, so its comments box finds it.
    files = sorted(glob.glob("_writing/*") + glob.glob("_resources/*"))
    candidates = []
    changed = False
    for f in files:
        s = shareable(f)
        if not s:
            continue
        path = page_path(f)
        hit = feed.get(norm(SITE + path))
        if hit and path not in data:
            uri, created = hit
            data[path] = {"uri": uri, "date": created,
                          "url": f"https://bsky.app/profile/{HANDLE}/post/{uri.rsplit('/', 1)[-1]}"}
            changed = True
        if path not in data:
            candidates.append((f, s))
    if changed:
        save_data(data)

    print(f"{len(candidates)} items still to share.")
    if not candidates:
        return

    dates = [v.get("date", "") for v in data.values()] + [c for _, c in feed.values()]
    dates = [datetime.datetime.fromisoformat(d.replace("Z", "+00:00")) for d in dates if d]
    if dates:
        gap = (now() - max(dates)).total_seconds() / 86400
        if gap < DRIP_MIN_DAYS:
            print(f"Last share was {gap:.1f} days ago; waiting for at least {DRIP_MIN_DAYS}.")
            return
    if os.environ.get("DRIP_FORCE") != "true" and random.random() > DRIP_CHANCE:
        print("Not this time (random).")
        return

    f, (fm, body) = random.choice(candidates)
    data[page_path(f)] = Bluesky().post(f, fm, body)
    save_data(data)


if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "drip":
        cmd_drip()
    elif len(sys.argv) >= 2 and sys.argv[1] == "share":
        cmd_share(sys.argv[2:])
    else:
        sys.exit(__doc__)

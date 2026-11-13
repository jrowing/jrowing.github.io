#!/usr/bin/env python3
"""Download Substack-hosted images used in _writing/ into images/writing/<post>/ and rewrite the posts.
Run from the repo root on a machine with internet access:  python3 scripts/localise-images.py
Safe to re-run: files already downloaded are skipped."""
import re, os, sys, subprocess, urllib.parse, glob
URL = re.compile(r'https://substack-post-media\.s3\.amazonaws\.com/[^"\s)<>]+')
ok = bad = 0
print('Working... (each image has a 60s limit)', flush=True)
for post in sorted(glob.glob('_writing/*.html')):
    slug = os.path.basename(post)[:-5]
    text = open(post, encoding='utf-8').read()
    def fetch(m):
        global ok, bad
        url = m.group(0)
        name = urllib.parse.unquote(url.rsplit('/', 1)[-1]).replace(' ', '-')
        dest = f'images/writing/{slug}/{name}'
        if not os.path.exists(dest):
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            r = subprocess.run(['curl', '-fsSL', '--connect-timeout', '15', '--max-time', '60', '--retry', '1', '-o', dest, url], capture_output=True, text=True)
            if r.returncode != 0:
                if os.path.exists(dest): os.remove(dest)
                bad += 1; print('FAILED', url, r.stderr.strip(), file=sys.stderr); return url
        ok += 1
        return '/' + urllib.parse.quote(dest)
    new = URL.sub(fetch, text)
    if new != text: open(post, 'w', encoding='utf-8').write(new)
print(f'{ok} images localised, {bad} failed')

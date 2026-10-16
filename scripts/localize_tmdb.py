"""Download every image.tmdb.org picture used in seenjeem/index.html into img/
and point the game at the local copy (adds it to BUNDLED).
Safe to re-run: already-downloaded images are skipped."""
import re, sys, time, urllib.request, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
html_path = ROOT / "seenjeem" / "index.html"
html = html_path.read_text(encoding="utf-8")
urls = sorted(set(re.findall(r'https://image\.tmdb\.org/t/p/\w+/([A-Za-z0-9_-]+)\.jpg', html)))
print(f"{len(urls)} TMDB images")

done, failed = [], []
for name in urls:
    dest = ROOT / "img" / f"{name}.jpg"
    if not dest.exists():
        # grab the biggest size used for this image
        size = max(re.findall(rf'https://image\.tmdb\.org/t/p/w(\d+)/{name}\.jpg', html), key=int)
        url = f"https://image.tmdb.org/t/p/w{size}/{name}.jpg"
        for attempt in range(4):
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                data = urllib.request.urlopen(req, timeout=30).read()
                if data[:3] != b"\xff\xd8\xff":
                    raise ValueError("not a jpeg")
                dest.write_bytes(data)
                break
            except Exception as e:
                print("retry", name, e); time.sleep(2 ** attempt)
        else:
            failed.append(name); continue
    done.append(name)

for name in done:
    html = re.sub(rf'https://image\.tmdb\.org/t/p/\w+/{name}\.jpg', name, html)
m = re.search(r'const BUNDLED=new Set\(\[', html)
have = set(re.findall(r'"([^"]+)"', html[m.end():html.index("])", m.end())]))
add = [n for n in done if n not in have]
if add:
    html = html[:m.end()] + "".join(f'"{n}", ' for n in add) + html[m.end():]
html_path.write_text(html, encoding="utf-8")
print(f"localized {len(done)}, failed {len(failed)}: {failed}")
sys.exit(1 if failed else 0)

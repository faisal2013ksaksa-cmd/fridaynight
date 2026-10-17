"""Apply the choices made on the picture page (pick/) to سين جيم.

Input: every picks/*.json file. Each one looks like
  {"v": 1, "picks": {"BB-02": {"do": "tmdb", "path": "/abc.jpg", "kind": "backdrop"},
                     "TT-04": {"do": "upload", "data": "data:image/jpeg;base64,..."},
                     "SF-07": {"do": "noimage"},
                     "BO-03": {"do": "delete"}}}
For each question (by its code):
  tmdb / upload -> the picture is shrunk (max 1024px, JPEG) into img/<id>.jpg and set as the question's image
  noimage       -> the question works with the series cover: it is no longer listed as needing a picture
  delete        -> the question is removed from the game
Processed files are removed (their pictures now live in img/)."""
import base64, hashlib, io, json, pathlib, re, sys, time, urllib.request
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
HTML = ROOT / "seenjeem" / "index.html"
IMG = ROOT / "img"
MAX_SIDE, QUALITY = 1024, 78

def shrink(raw):
    im = Image.open(io.BytesIO(raw))
    im = im.convert("RGB")
    im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
    out = io.BytesIO(); im.save(out, "JPEG", quality=QUALITY, optimize=True, progressive=True)
    return out.getvalue()

def fetch(url):
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            return urllib.request.urlopen(req, timeout=30).read()
        except Exception as e:
            print("retry", url, e); time.sleep(2 ** attempt)
    raise RuntimeError("could not download " + url)

def main():
    files = sorted((ROOT / "picks").glob("*.json"))
    if not files:
        print("no picks"); return
    html = HTML.read_text(encoding="utf-8")
    m = re.search(r"const SERIES=(\[.*?\]);\n", html, re.S)
    series = json.loads(m.group(1))
    byCode = {q["c"]: (c, q) for c in series for q in c["qs"]}
    added, done, missing = [], {"image": 0, "noimage": 0, "delete": 0}, []
    test = False
    for f in files:
        doc = json.loads(f.read_text(encoding="utf-8"))
        picks = doc.get("picks", {})
        if doc.get("test"):   # dry run: download + shrink, change nothing
            test = True
            for code, p in picks.items():
                if p.get("do") == "tmdb": raw = fetch("https://image.tmdb.org/t/p/original" + p["path"])
                elif p.get("do") == "upload": raw = base64.b64decode(p["data"].split(",", 1)[1])
                else: print("test", code, p.get("do"), "known" if code in byCode else "unknown"); continue
                jpg = shrink(raw); im = Image.open(io.BytesIO(jpg))
                print("test", code, p["do"], "ok:", len(raw), "bytes ->", im.size, len(jpg), "bytes")
            continue
        for code, p in picks.items():
            if code not in byCode: missing.append(code); continue
            cat, q = byCode[code]
            do = p.get("do")
            if do in ("tmdb", "upload"):
                if do == "tmdb":
                    path = p.get("path", "")
                    if not re.fullmatch(r"/[A-Za-z0-9_\-]+\.(jpg|png)", path): missing.append(code); continue
                    raw = fetch("https://image.tmdb.org/t/p/original" + path)
                else:
                    data = p.get("data", "")
                    if "," not in data: missing.append(code); continue
                    raw = base64.b64decode(data.split(",", 1)[1])
                jpg = shrink(raw)
                pid = hashlib.md5(jpg).hexdigest()
                (IMG / f"{pid}.jpg").write_bytes(jpg)
                q["m"] = {"t": "image", "id": pid}
                if do == "tmdb": q["src"] = "tmdb"
                added.append(pid); done["image"] += 1
            elif do == "noimage":
                q.pop("r", None); q["ni"] = 1; done["noimage"] += 1
            elif do == "delete":
                cat["qs"] = [x for x in cat["qs"] if x["c"] != code]; done["delete"] += 1
    if test and not added and not any(done.values()):
        for f in files: f.unlink()
        print("test run only, nothing changed"); return
    html = html[:m.start(1)] + json.dumps(series, ensure_ascii=False) + html[m.end(1):]
    b = re.search(r"const BUNDLED=new Set\(\[", html)
    have = set(re.findall(r'"([^"]+)"', html[b.end():html.index("])", b.end())]))
    new = [x for x in dict.fromkeys(added) if x not in have]
    if new:
        html = html[:b.end()] + "".join(f'"{x}", ' for x in new) + html[b.end():]
    HTML.write_text(html, encoding="utf-8")
    for f in files: f.unlink()   # applied: the pictures now live in img/
    print("applied", done, "unknown codes:", missing)

if __name__ == "__main__":
    main()

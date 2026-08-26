"""Generate a STATIC, CRAWLABLE page per guide pack at /guide/<slug>/.

THE PROBLEM (measured 2026-07-25): the guide was invisible to every search engine for
three compounding reasons, and only the third was the one people kept guessing at:
  1. `<meta name="robots" content="noindex, nofollow">` in guide/index.html
  2. `Disallow: /guide/` in robots.txt, repeated for all 22 named crawlers
  3. every pack shared ONE url (`/guide/?pack=<slug>`) and the content was fetched by JS
(1) and (2) are now removed. This script fixes (3): each pack gets a real URL serving the
whole guide as plain HTML in the initial response, so a crawler needs no JavaScript.

⚠️ SPOILERS ARE INTENTIONAL HERE. The interactive viewer hides level 2/3 text behind a
spoiler control. These static pages deliberately render EVERY level, because Sami's call
(2026-07-25) was: "I want everything in the guide and every single letter to be indexed…
we want people to be able to search collectible items or locations." Someone who has
finished the game should be able to Google one collectible and land on it. The static page
says so at the top so nobody is ambushed.

The interactive viewer stays the primary experience: every static page links into
`/guide/?pack=<slug>`, and `?pack=` keeps working exactly as before (nothing about the
viewer's URL handling is changed, so no existing link breaks).
"""
from __future__ import annotations

import html
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACKS = ROOT / "guide" / "packs"
SITE = "https://www.samimirash.com"

LEVEL_LABEL = {"1": "Hint", "2": "Where", "3": "Full detail"}


def esc(s) -> str:
    return html.escape(str(s or ""), quote=True)


def render(pack: dict, slug: str) -> str:
    game = pack.get("game") or slug
    target = pack.get("target") or "100% completion"
    areas = pack.get("areas", [])
    n_items = sum(len(a.get("items", [])) for a in areas)

    head = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{esc(game)} — 100% collectible guide | Sami Mirash</title>
<meta name="description" content="Complete {esc(game)} guide: {n_items} collectibles and objectives across {len(areas)} areas, with exact locations. Written while playing, no spoilers in the interactive version.">
<meta name="robots" content="index, follow">
<link rel="canonical" href="{SITE}/guide/{slug}/">
<link rel="stylesheet" href="../guide.css">
<style>
  .static-wrap{{max-width:760px;margin:0 auto;padding:20px 16px 64px}}
  @media(min-width:1200px){{.static-wrap{{max-width:920px}}}}
  .static-wrap h1{{font-size:26px;margin:.2em 0}}
  .static-wrap h2{{font-size:20px;margin:1.6em 0 .4em;color:var(--gold)}}
  .static-wrap h3{{font-size:16px;margin:1.1em 0 .3em}}
  .static-wrap .lvl{{margin:.15em 0 .15em 0;padding-left:12px;border-left:2px solid var(--line)}}
  .static-wrap .lvl b{{color:var(--muted);font-weight:600;font-size:12px;
     text-transform:uppercase;letter-spacing:.6px;display:block}}
  .spoiler-note{{border:1px solid var(--gold);border-radius:10px;padding:12px 14px;margin:16px 0}}
  .cta{{display:inline-block;margin:8px 0 4px;padding:12px 18px;border-radius:10px;
     background:var(--gold);color:#151109;font-weight:800;text-decoration:none}}
  .static-wrap img.sk{{display:block;width:100%;max-width:560px;margin:8px 0;
     border:1px solid var(--line);border-radius:8px}}
</style>
</head>
<body>
<div class="static-wrap">
<a class="homelink" href="/">&#8592; <span>samimirash.com</span></a>
<h1>{esc(game)}</h1>
<p class="muted">{esc(target)} &middot; {len(areas)} areas &middot; {n_items} tracked items</p>

<div class="spoiler-note">
  <strong>This page shows everything, including exact locations.</strong>
  It exists so you can search for one specific collectible and find it.
  If you are playing blind, use the
  <a href="../?pack={esc(slug)}">interactive spoiler-free version</a> instead — it hides
  locations until you ask for them, one item at a time.
</div>

<p><a class="cta" href="../?pack={esc(slug)}">Open the spoiler-free interactive guide</a></p>
"""

    body = []
    for area in areas:
        body.append(f'<h2>{esc(area.get("name") or area.get("id"))}</h2>')
        if area.get("location_cue"):
            body.append(f'<p class="muted"><em>You are here when:</em> {esc(area["location_cue"])}</p>')
        if area.get("note"):
            body.append(f'<p>{esc(area["note"])}</p>')
        for it in area.get("items", []):
            label = esc(it.get("label") or it.get("id"))
            kind = esc(it.get("safe_type") or it.get("type") or "")
            miss = ' <span class="muted">(missable)</span>' if it.get("missable") else ""
            body.append(f'<h3>{label}{miss}</h3>')
            if kind:
                body.append(f'<p class="muted small">{kind}</p>')
            levels = it.get("levels") or {}
            for k in sorted(levels, key=lambda x: str(x)):
                txt = levels[k]
                if not txt:
                    continue
                body.append(f'<div class="lvl"><b>{esc(LEVEL_LABEL.get(str(k), "Detail "+str(k)))}</b>{esc(txt)}</div>')
            sk = it.get("sketch") or {}
            if sk.get("src"):
                # sk["src"] is pack-relative ("sketches/foo.webp"); this page lives at
                # /guide/<slug>/, so the asset is ../packs/<slug>/sketches/foo.webp
                # ⭐ UNLESS IT IS ABSOLUTE — guide images are moving to Cloudflare Pages because
                # the finished set needs ~30 GB at 4K and GitHub Pages caps a published site at
                # 1 GB. ⛔ The same backward-compatible test as viewer.js, and it must STAY the
                # same: two places deciding this differently is how the interactive page and the
                # crawlable page end up disagreeing about where an image lives.
                _src = sk["src"]
                if _src.lower().startswith(("http://", "https://")):
                    _url = esc(_src)
                else:
                    _url = f'../packs/{esc(slug)}/{esc(_src)}'
                body.append(
                    f'<img class="sk" loading="lazy" src="{_url}" '
                    f'alt="Location sketch for {label} in {esc(game)}">')

    tail = f"""
<hr>
<p><a class="cta" href="../?pack={esc(slug)}">Open the spoiler-free interactive guide</a></p>
<p class="muted small">Part of the 100% guide collection at
<a href="/guides.html">samimirash.com/guides</a>.</p>
</div>
</body>
</html>
"""
    return head + "\n".join(body) + tail


def main() -> int:
    slugs = sorted(d.name for d in PACKS.iterdir() if (d / "pack.json").is_file())
    written = 0
    for slug in slugs:
        pack = json.loads((PACKS / slug / "pack.json").read_text(encoding="utf-8"))
        out_dir = ROOT / "guide" / slug
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / "index.html").write_text(render(pack, slug), encoding="utf-8", newline="\n")
        written += 1
    print(f"wrote {written} static guide pages -> /guide/<slug>/index.html")
    return 0


if __name__ == "__main__":
    sys.exit(main())

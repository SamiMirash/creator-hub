r"""Merge everything the site knows about a game into ONE record per franchise.

THE PROBLEM (the creator, 2026-08-16): "I want the guide and the game list and the game settings — all
these game-related things — under one page. Right now they're separated. When we search a game and
click on it I want the settings to be there, I want the guide to be there, like everything about
that game, that version of the game that we have chosen, and also how long we've played it."

Today those live in four unrelated places and three separate pages:
    data/games.json           1239 franchises - which edition he chose, rating, notes   (8.5 MB)
    data/setups.json          per-game SETTINGS, keyed by slug
    data/playtime_totals.json hours + sessions, keyed by lowercase display name
    guide/packs/index.json    159 spoiler-free guides, keyed by slug

⭐ WHY PRE-MERGE INSTEAD OF JOINING IN THE BROWSER: games.json is 8.5 MB. Making every visitor
download it to read one game is why this was never combined. This writes one small file per
franchise (~7 KB) plus a compact search index, so a game page fetches ONE small file.

Outputs:
    data/game_index.json      compact: slug, title, years, flags — for search
    data/games/<slug>.json    the full merged record for one franchise

Run after any change to games.json / setups.json / playtime / guide packs.
"""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUT_DIR = DATA / "games"


ROMAN = {"ii": "2", "iii": "3", "iv": "4", "v": "5", "vi": "6", "vii": "7",
         "viii": "8", "ix": "9", "x": "10"}


def slugify(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode()
    # ⚠️ drop apostrophes FIRST. Treating them as separators turned "Marvel's Midnight Suns"
    # into marvel-s-midnight-suns and orphaned its guide.
    s = s.replace("'", "").replace("’", "")
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return re.sub(r"-{2,}", "-", s)


def deroman(slug: str) -> str:
    """god-of-war-iii -> god-of-war-3, so roman-numbered guides find their entry."""
    parts = [ROMAN.get(p, p) for p in slug.split("-")]
    return "-".join(parts)


def pack_candidates(title: str, year) -> list[str]:
    """Slug forms a guide pack might use for this entry.

    ⚠️ Exact slug matching alone orphaned 19 of 159 guides — all naming variants, not missing
    games: `god-of-war-2005` vs "God of War" (2005), `the-sims-2000` vs "The Sims",
    `resident-evil-1996` vs "Resident Evil". A guide that exists but never appears on its game
    page is exactly the fragmentation this whole job is meant to remove, so try the variants.
    """
    base = slugify(title)
    out = [base]
    if year:
        out.append(f"{base}-{year}")
    # drop a leading article, and drop everything after a colon/dash subtitle
    if ":" in str(title):
        head = slugify(str(title).split(":")[0])
        out += [head, f"{head}-{year}"] if year else [head]
    if "-" in base:
        out.append(base.rsplit("-", 1)[0])
    # trailing edition words a guide slug usually omits
    trimmed = re.sub(r"-(hd|remaster|remastered|redux|edition|definitive|gold)(-.*)?$", "", base)
    if trimmed != base:
        out.append(trimmed)
    out += [deroman(s) for s in list(out)]
    return [s for s in dict.fromkeys(out) if s]


STOP = {"the", "a", "of", "hd", "remaster", "remastered", "redux", "edition",
        "definitive", "gold", "classic", "complete"}


def canon(slug: str) -> str:
    """Order-insensitive canonical form, so wording differences still match.

    Catches 'resident-evil-the-umbrella-chronicles' vs 'resident-evil-umbrella-chronicles'
    and 'strange-journey-redux' vs 'strange-journey'. Used only as a LAST resort, after the
    exact and variant forms, so it cannot steal a pack from a better match.
    """
    toks = [t for t in deroman(slug).split("-") if t and t not in STOP]
    return "-".join(sorted(toks))


def load(name, default):
    p = DATA / name if not str(name).startswith("guide") else ROOT / name
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return default


def main() -> int:
    games = load("games.json", [])
    setups = {}
    for s in (load("setups.json", {}).get("games") or []):
        setups[s.get("id")] = s
        # ⭐ a setup may name an EDITION ("death-stranding-directors-cut") while the archive lists
        # the title ("Death Stranding"); applies_to states the target explicitly rather than
        # relying on fuzzy matching, which could attach settings to the wrong game.
        if s.get("applies_to"):
            setups[s["applies_to"]] = s
    playtime = load("playtime_totals.json", {}).get("games") or {}
    packs = {p["id"]: p.get("title", "") for p in
             (json.loads((ROOT / "guide" / "packs" / "index.json").read_text(encoding="utf-8"))
              .get("packs") or [])}

    # playtime is keyed by lowercase display name, everything else by slug
    play_by_slug = {slugify(v.get("display") or k): v for k, v in playtime.items()}

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    index = []
    written = 0
    linked_guides = linked_setups = linked_play = 0
    used_packs: set[str] = set()   # a pack belongs to exactly one entry

    for fr in games:
        fslug = fr.get("franchise_slug") or slugify(fr.get("franchise"))
        if not fslug:
            continue
        entries = []
        for e in fr.get("entries") or []:
            eslug = slugify(e.get("title"))
            cands = pack_candidates(e.get("title"), e.get("release_year"))
            guide = next((c for c in cands if c in packs and c not in used_packs), None)
            if guide is None:
                want = canon(eslug)
                guide = next((pid for pid in packs
                              if pid not in used_packs and canon(pid) == want), None)
            if guide:
                used_packs.add(guide)
            setup = next((c for c in cands if c in setups), None)
            play = next((play_by_slug[c] for c in cands if c in play_by_slug), None)
            if guide:
                linked_guides += 1
            if setup:
                linked_setups += 1
            if play:
                linked_play += 1
            entries.append({
                "title": e.get("title"),
                "slug": eslug,
                "release_year": e.get("release_year"),
                "sami": e.get("sami") or {},
                "definitive_edition": e.get("definitive_edition"),
                "emulation": e.get("emulation"),
                "status": e.get("status"),
                "primary": e.get("primary"),
                "secondary": e.get("secondary"),
                "remaster_caveats": e.get("remaster_caveats"),
                # the three things that were previously on other pages entirely
                "guide": {"slug": guide, "url": f"/guide/{guide}/"} if guide else None,
                "settings": setups.get(setup) if setup else None,
                "playtime": play,
            })

        # ⭐ Attach the OTHER versions of the same game. His rule is that one title can require
        # several releases — a remake that removed content does not replace the original — and the
        # site previously showed every entry in isolation, hiding that completely.
        src = {e.get("title"): e for e in (fr.get("entries") or [])}
        for e in entries:
            mine = (src.get(e["title"]) or {}).get("version_groups") or []
            e["version_role"] = (src.get(e["title"]) or {}).get("version_role")
            sibs = []
            for other in fr.get("entries") or []:
                if other.get("title") == e["title"]:
                    continue
                if set(other.get("version_groups") or []) & set(mine):
                    sibs.append({"title": other.get("title"),
                                 "slug": slugify(other.get("title")),
                                 "why": other.get("version_role")})
            e["also_play"] = sibs
            e["version_groups"] = mine

        record = {
            "franchise": fr.get("franchise"),
            "slug": fslug,
            "era": fr.get("era"),
            "summary": fr.get("summary"),
            "entries": entries,
        }
        (OUT_DIR / f"{fslug}.json").write_text(
            json.dumps(record, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8", newline="\n")
        written += 1

        index.append({
            "slug": fslug,
            "franchise": fr.get("franchise"),
            "era": fr.get("era"),
            "titles": [e["title"] for e in entries if e.get("title")],
            "years": sorted({e["release_year"] for e in entries if e.get("release_year")}),
            "has_guide": any(e["guide"] for e in entries),
            "has_settings": any(e["settings"] for e in entries),
            "has_playtime": any(e["playtime"] for e in entries),
        })

    (DATA / "game_index.json").write_text(
        json.dumps({"count": len(index), "games": index}, ensure_ascii=False,
                   separators=(",", ":")),
        encoding="utf-8", newline="\n")

    idx_kb = (DATA / "game_index.json").stat().st_size // 1024
    print(f"  wrote {written} merged franchise records -> data/games/<slug>.json")
    print(f"  wrote data/game_index.json ({idx_kb} KB, {len(index)} franchises)")
    print(f"  linked: {linked_guides} guides, {linked_setups} settings, {linked_play} playtime")
    orphans = sorted(set(packs) - used_packs)
    if orphans:
        # ⛔ never let this be silent — an unlinked guide is invisible on its game page
        print(f"  ⚠️ {len(orphans)} guide(s) still not linked to any game entry:")
        for o in orphans:
            print(f"      {o}")
    else:
        print("  every guide is linked to a game entry")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

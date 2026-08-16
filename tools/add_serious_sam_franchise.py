r"""Add the Serious Sam franchise to data/games.json.

⚠️ WHY: the archive holds 1239 franchises and Serious Sam — the franchise actually being played
and set up all week — was not one of them, so it had no page, and its guide could not link to a
game entry either.

⛔ Only facts established and verified on this machine go in here. rating / difficulty /
completion_date are left EMPTY because he has not played these yet, and inventing them would put
false claims on a public page.

Order is RELEASE DATE, with all versions of one title kept together — his rule.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GAMES = ROOT / "data" / "games.json"

BLANK = {"chosen_platform": "", "rating": "", "difficulty": "",
         "completion_date": "", "notes": ""}


def entry(title, year, platform, definitive="", emulation="", primary="",
          secondary="", caveats="", status="Set up, not yet played", notes=""):
    s = dict(BLANK)
    s["chosen_platform"] = platform
    s["notes"] = notes
    return {
        "title": title,
        "release_year": year,
        "sami": s,
        "primary": primary or platform,
        "secondary": secondary,
        "all_releases": "",
        "fidelity_vs_completeness_conflict": "",
        "definitive_edition": definitive,
        "remaster_caveats": caveats,
        "emulation": emulation,
        "status": status,
        "confidence": "verified on this machine",
    }


ENTRIES = [
    entry("Serious Sam: The First Encounter", 2001, "PC — Gold Edition (classic Serious Engine 1)",
          definitive="Gold Edition, which bundles TFE and TSE and the official Marsh Wastes level",
          caveats="The HD remake REMOVED content, so the classic is still required, not optional.",
          notes="4K, LAA, EAX enabled via DSOAL, HDR through Special K's OpenGL path."),
    entry("Serious Sam (Palm OS)", 2001, "Palm OS via emulation",
          emulation="RetroArch Mu core. Graffiti area hidden, which leaves a square 1:1 image.",
          notes="A genuinely different handheld take on The First Encounter, not a port."),
    entry("Serious Sam: The Second Encounter", 2002, "PC — Gold Edition (classic Serious Engine 1)",
          definitive="Gold Edition, including the official Dark Island campaign",
          notes="4K, LAA, EAX enabled, HDR through Special K."),
    entry("Serious Sam (Xbox)", 2002, "Original Xbox via xemu",
          emulation="xemu, redump converted to XISO, patched in place for real anamorphic 16:9",
          notes="Contains BOTH campaigns plus Xbox exclusives: the Serious Bomb, a chainsaw and a "
                "lives system. Loses some enemies and has smaller levels."),
    entry("Serious Sam Advance", 2004, "Game Boy Advance via NanoBoyAdvance",
          emulation="NanoBoyAdvance", notes="An original story, not an adaptation."),
    entry("Serious Sam: Next Encounter", 2004, "GameCube via Dolphin",
          emulation="Dolphin, Direct3D 12, 6x internal resolution",
          notes="Original story set in Rome, feudal China and Atlantis. True 4:3 — Dolphin's "
                "widescreen hack clips the menu, so it stays pillarboxed."),
    entry("Serious Sam 2", 2005, "PC",
          notes="4K, FOV 96.4183, HDR via dgVoodoo2's own Float16 output."),
    entry("Serious Sam HD: The First Encounter", 2009, "PC",
          caveats="A remake that removed content from the classic, so both are worth playing.",
          notes="4K with HDR via dgVoodoo2 plus a Large Address Aware patch."),
    entry("Serious Sam HD: The Second Encounter", 2010, "PC",
          caveats="Same removals as the HD First Encounter.",
          notes="4K with HDR via dgVoodoo2 plus a Large Address Aware patch."),
    entry("Serious Sam 3: BFE", 2011, "PC", notes="Native HDR path."),
    entry("Serious Sam: Kamikaze Attack!", 2011, "PC", notes="HDR via Special K."),
    entry("Serious Sam: The Random Encounter", 2011, "PC",
          notes="A GDI renderer with no swapchain at all; HDR reached by routing it through "
                "dgVoodoo2 to D3D11 and retrofitting with Special K."),
    entry("Serious Sam Double D XXL", 2013, "PC",
          definitive="Double D XXL, the expanded version of Double D",
          notes="XNA. HDR via the DXVK HDR build, which upgrades only the swap chain."),
    entry("Serious Sam Classics: Revolution", 2019, "PC",
          notes="The modernised classic. Its Special K OpenGL layer is load-bearing — it is what "
                "makes the game render at all under Windows HDR."),
    entry("Serious Sam's Bogus Detour", 2017, "PC",
          notes="Built on BGFX, which ignores locally placed DLLs; HDR needs Special K's global "
                "injection, launched through a wrapper that removes the hook on exit."),
    entry("I Hate Running Backwards", 2018, "PC", notes="HDR via Special K."),
    entry("Serious Sam 4", 2020, "PC (GOG)", notes="Native HDR. GOG's 1.09 is ahead of Steam."),
    entry("Serious Sam: Siberian Mayhem", 2022, "PC (GOG)", notes="Native HDR."),
    entry("Serious Sam: Tormental", 2022, "PC", notes="HDR via Special K."),
]

FRANCHISE = {
    "franchise": "Serious Sam",
    "franchise_slug": "serious-sam",
    "era": "2001 – present",
    "summary": ("Croteam's arena shooter series, played in release order with every version of a "
                "title kept together. The HD remakes removed content, so the classics are still "
                "required rather than superseded."),
    "entries": ENTRIES,
}


def main():
    games = json.loads(GAMES.read_text(encoding="utf-8"))
    if any(f.get("franchise_slug") == "serious-sam" for f in games):
        print("  Serious Sam already present — nothing to do.")
        return 0
    games.append(FRANCHISE)
    games.sort(key=lambda f: (f.get("franchise") or "").lower())
    GAMES.write_text(json.dumps(games, ensure_ascii=False, indent=1),
                     encoding="utf-8", newline="\n")
    print(f"  added Serious Sam ({len(ENTRIES)} entries); games.json now has {len(games)} franchises")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

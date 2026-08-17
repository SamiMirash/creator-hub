r"""Publish the settings for Serious Sam Double D (the 2011 original) to the site.

Every value below was read back from the game's own menus and its renderer log, not from memory.

⛔ No hardware identity. ⛔ No source citations.
Run build_game_index.py afterwards so the entry picks it up.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SETUPS = ROOT / "data" / "setups.json"

ENTRY = {
    "id": "serious-sam-double-d",
    "applies_to": "serious-sam-double-d",
    "title": "Serious Sam Double D (2011 original)",
    "status": "Set up, not yet played",
    "summary": ("The original 2011 release, which has to be played alongside the later expanded "
                "version because that one removed things. It is a 2D game built on an old "
                "framework, so the work here was getting real HDR out of it and choosing the best "
                "aspect-correct mode it will accept."),
    "groups": [
        {"name": "Display", "settings": [
            {"label": "Full Screen", "value": "On"},
            {"label": "Resolution", "value": "1600 x 900 — the highest 16:9 mode the game offers"},
            {"label": "Vsync", "value": "Enabled"},
            {"label": "Draw Shaders", "value": "On — it ships disabled, which quietly drops the "
                                               "game's visual effects"},
        ]},
        {"name": "HDR", "settings": [
            {"label": "Output", "value": "Real scRGB high dynamic range"},
            {"label": "Swap chain format", "value": "R16G16B16A16_SFLOAT (16-bit float per "
                                                    "channel)"},
            {"label": "Colour space", "value": "Extended sRGB linear"},
            {"label": "How it is reached", "value": "A translation layer converts the game's old "
                                                    "graphics calls to a modern one and upgrades "
                                                    "the swap chain to floating point."},
        ]},
    ],
    "settingsNote": (
        "Two things about this game are worth knowing, because neither is obvious.\n\n"
        "The first is where the graphics layer has to live. Games built on this framework do not "
        "load their graphics library from their own folder — the framework pulls it from a shared "
        "system location instead, so a file dropped next to the game is simply ignored. The layer "
        "therefore has to sit in that shared location. But its configuration file is read from the "
        "game's own folder, so a game with the layer available but no configuration beside it gets "
        "no high dynamic range at all and gives no warning. That was the entire difference between "
        "this version and the expanded one: one file.\n\n"
        "The second is the resolution ceiling. The list of resolutions is built into the game "
        "itself rather than read from the screen, and it stops at a size that was generous in "
        "2011. The display offers far more, and the game will not show any of it. 1600 x 900 is "
        "the largest 16:9 option available, so it is the one that keeps everything the correct "
        "shape with nothing stretched, and the graphics card scales it up to fill the screen. "
        "The later expanded version has an updated list and does not have this limit."),
    "mods": [],
    "modsNote": "",
}


def main():
    d = json.loads(SETUPS.read_text(encoding="utf-8"))
    games = d.setdefault("games", [])
    games[:] = [g for g in games if g.get("id") != ENTRY["id"]]
    games.append(ENTRY)
    games.sort(key=lambda g: g.get("id", ""))
    SETUPS.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
    n = sum(len(g["settings"]) for g in ENTRY["groups"])
    print(f"  added {ENTRY['id']} — {len(ENTRY['groups'])} groups, {n} settings")
    print(f"  setups.json now holds {len(games)} games")


if __name__ == "__main__":
    raise SystemExit(main())

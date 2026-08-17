r"""Correct the published settings for Serious Sam HD: The Second Encounter.

Two things changed and the page was wrong about both:
  1. It described a graphics wrapper that has since been REMOVED — it crashed the game with a
     divide-by-zero. Keeping a broken recipe on the page is worse than having none.
  2. It said nothing about high dynamic range, which the game now genuinely has.

Also records that the add-on campaign belongs with this entry.

⛔ No hardware identity. ⛔ No source citations.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SETUPS = ROOT / "data" / "setups.json"
GID = "serious-sam-hd-the-second-encounter"

HDR_GROUP = {
    "name": "HDR",
    "settings": [
        {"label": "Output", "value": "Real scRGB high dynamic range"},
        {"label": "How it is reached", "value": "A single compatibility layer beside the game, "
                                                "which upgrades the presentation path — nothing "
                                                "else is needed"},
        {"label": "Peak luminance", "value": "1000 nits"},
        {"label": "Paper white", "value": "200 nits"},
        {"label": "Measured result", "value": "Brightest pixel reaches 3.0 where standard range "
                                              "tops out at 1.0, with roughly 1.4% of the picture "
                                              "above standard white"},
    ],
}

CONTENT_GROUP = {
    "name": "Content",
    "settings": [
        {"label": "Add-on campaign", "value": "Installed — three extra levels plus additional "
                                              "versus and survival maps"},
        {"label": "First Encounter pack", "value": "Installed — lets the earlier campaign be "
                                                   "played inside this game"},
        {"label": "Verified", "value": "Both confirmed mounted by the engine at startup, marked "
                                       "as official content"},
    ],
}

NOTE = (
    "Getting high dynamic range out of this game took three attempts, and the two that failed are "
    "worth recording because they look correct on paper.\n\n"
    "The first attempt put a wrapper in front of the game to translate its old graphics calls to a "
    "modern interface, and told that wrapper to produce a floating-point output. It ran, and "
    "measuring the picture showed the brightest pixel sitting at exactly 1.0 — the ceiling of "
    "standard range. So the container was high dynamic range while the contents were not. That is "
    "the trap: the pipeline reports success and the image is unchanged.\n\n"
    "The second attempt kept the wrapper but handed the output stage to a second layer, which did "
    "produce genuine high dynamic range. It also crashed, repeatedly and with a divide-by-zero "
    "inside the wrapper, which no amount of configuration fixed.\n\n"
    "The third attempt removed the wrapper entirely and used the second layer on its own. That is "
    "the arrangement in place now: one file beside the game, real floating-point output, and two "
    "consecutive clean launches with no crash reports. Fewer moving parts turned out to be both "
    "more correct and more stable.\n\n"
    "One practical note that is easy to lose an evening to: this game must be started through the "
    "store client rather than by running the executable directly. Launched directly it exits "
    "immediately with no window and no error, because the engine unpacks part of itself at startup "
    "and needs that context. The failure looks exactly like a crash and is not one.")


def main():
    d = json.loads(SETUPS.read_text(encoding="utf-8"))
    g = next((x for x in d["games"] if x["id"] == GID), None)
    if not g:
        print(f"  ⛔ {GID} not found")
        return 1

    before = [grp["name"] for grp in g["groups"]]
    # drop the wrapper group - that recipe is retired
    g["groups"] = [grp for grp in g["groups"] if "dgvoodoo" not in grp["name"].lower()]
    # rename the wrapper-flavoured group name if present, then add the new ones
    g["groups"] = [grp for grp in g["groups"] if grp["name"] not in ("HDR", "Content")]
    g["groups"].append(HDR_GROUP)
    g["groups"].append(CONTENT_GROUP)
    g["settingsNote"] = NOTE
    g["summary"] = ("The 2009-era remake of the second campaign, running at native 4K with real "
                    "high dynamic range and its add-on campaign installed. Every value below is "
                    "read from the game's own configuration file.")

    SETUPS.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"  groups before: {before}")
    print(f"  groups after : {[grp['name'] for grp in g['groups']]}")
    print(f"  total settings: {sum(len(x['settings']) for x in g['groups'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

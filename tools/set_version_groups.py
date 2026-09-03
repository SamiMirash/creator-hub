r"""Tag each game entry with the VERSION GROUP it belongs to, and why that version is played.

The creator, 2026-08-16: "For Serious Sam: The First Encounter there is the Gold, there's the Classic
Revolution... for that particular entry there are many versions that we have to play, so you gotta
mention it, and you gotta mention the reason as well. For all of the franchises that we do."

⭐ THE POINT: his rule is that one TITLE can require several versions to be played - a remake that
removed content does not replace the original, and a drastically different port is its own game.
The site listed every entry in isolation, so a visitor could not see that finishing "The First
Encounter" actually means four different releases, or why.

⭐ A game can belong to MORE THAN ONE group: the original Xbox release and Revolution each contain
both campaigns, so they appear under both. Hence a list, not a single string.

Usage: set_version_groups.py [--apply]
"""
import json
import sys
from pathlib import Path

GAMES = Path(__file__).resolve().parents[1] / "data" / "games.json"

TFE, TSE, DD = "The First Encounter", "The Second Encounter", "Double D"

# title -> (groups, why this particular version is on the list)
ROLES = {
    "Serious Sam: The First Encounter": ([TFE],
        "The original 2001 release, and still the one to play: the HD remake cut content rather "
        "than adding it, so the classic is not superseded."),
    "Serious Sam (Palm OS)": ([TFE],
        "Not a port. The handheld version is a different game built on the same premise, with its "
        "own levels, so it does not overlap with the PC original."),
    "Serious Sam HD: The First Encounter": ([TFE],
        "The 2009 remake. Worth playing for what it rebuilt, but it REMOVED content, which is "
        "exactly why the original stays on the list beside it."),
    "Serious Sam: The Second Encounter": ([TSE],
        "The original 2002 release, including the official Dark Island campaign."),
    "Serious Sam HD: The Second Encounter": ([TSE],
        "The remake of the Second Encounter, with the same trade-off as the first: rebuilt visuals, "
        "but content missing against the original."),
    "Serious Sam Classics: Revolution": ([TFE, TSE],
        "The modernised classic, containing BOTH campaigns. It is the classic engine brought "
        "forward rather than a remake, so it plays differently from the HD versions."),
    "Serious Sam (Xbox)": ([TFE, TSE],
        "Contains both campaigns AND content that exists nowhere else - an extra weapon, an extra "
        "item and a lives system - while cutting enemy counts and level sizes. Different enough "
        "to count as its own game."),
    "Serious Sam Double D XXL": ([DD],
        "The expanded version of Double D. If it only adds to the 2011 original then this one "
        "covers it; if it changed or removed anything, the original joins the list too. That is "
        "still being checked."),
}


def main():
    apply = "--apply" in sys.argv
    games = json.loads(GAMES.read_text(encoding="utf-8"))
    touched = 0
    for fr in games:
        for e in fr.get("entries") or []:
            role = ROLES.get(e.get("title"))
            if not role:
                continue
            groups, why = role
            e["version_groups"] = groups
            e["version_role"] = why
            touched += 1
            print(f"  {e['title']:<42} {groups}")
    print(f"  tagged {touched} entries")
    if apply:
        GAMES.write_text(json.dumps(games, ensure_ascii=False, indent=1),
                         encoding="utf-8", newline="\n")
        print("  written")
    else:
        print("  (dry run - pass --apply)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

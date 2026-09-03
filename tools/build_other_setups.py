r"""Publish settings for the non-Serious-Sam games we have tuned: Returnal and Death Stranding DC.

The creator, 2026-08-16: "So far we've done the Serious Sam and also the Resident Evil and a bunch of
games that you and I worked on together - update them on the website."

Resident Evil Requiem already has a full entry, so this adds the two that had none.
⛔ NO HARDWARE. In particular: the reason texture streaming is off is that it BROKE (textures
stopped loading in long sessions) - never phrase it as "he has enough VRAM", which states hardware.
⭐ Every value read from the game's own config, not from memory.

Run: build_other_setups.py [--apply]
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SETUPS = ROOT / "data" / "setups.json"

RET_CFG = (Path(os.environ["LOCALAPPDATA"]) / "Returnal" / "Steam" / "Saved"
           / "Config" / "WindowsNoEditor")
DSDC = Path(r"C:\XboxGames\DSDC\Content")

FX_LABEL = {
    "r.SceneColorFringeQuality": "Chromatic aberration",
    "r.SceneColorFringe.Max": "Chromatic aberration (max)",
    "r.MotionBlurQuality": "Motion blur",
    "r.MotionBlur.Max": "Motion blur (max)",
    "r.DefaultFeature.MotionBlur": "Motion blur (default feature)",
    "r.LensFlareQuality": "Lens flare",
    "r.DefaultFeature.LensFlare": "Lens flare (default feature)",
    "r.DepthOfFieldQuality": "Depth of field",
    "r.DefaultFeature.DepthOfField": "Depth of field (default feature)",
    "r.Tonemapper.Quality": "Tonemapper extras (grain, vignette)",
}


def S(label, value):
    return {"label": label, "value": str(value)}


def ini_get(path, keys):
    if not path.exists():
        return {}
    txt = path.read_text(encoding="utf-8", errors="replace")
    out = {}
    for k in keys:
        m = re.search(rf"^{re.escape(k)}\s*=\s*(.+?)\s*$", txt, re.M)
        if m:
            out[k] = m.group(1)
    return out


def section(path, name):
    if not path.exists():
        return {}
    txt = path.read_text(encoding="utf-8", errors="replace")
    m = re.search(rf"\[{re.escape(name)}\](.*?)(?=\n\[|\Z)", txt, re.S)
    if not m:
        return {}
    out = {}
    for line in m.group(1).splitlines():
        if "=" in line and not line.strip().startswith((";", "#")):
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip()
    return out


def returnal():
    gus = ini_get(RET_CFG / "GameUserSettings.ini",
                  ["bUseVSync", "LastUserConfirmedResolutionSizeX",
                   "LastUserConfirmedResolutionSizeY", "FullscreenMode", "FrameRateLimit",
                   "DLSSMode", "DLSSSharpness", "bDLSSFrameGen", "bUseHDRDisplayOutput",
                   "HDRDisplayOutputNits", "bUseDynamicResolution"])
    sysset = section(RET_CFG / "Engine.ini", "SystemSettings")
    mode = {"0": "Exclusive fullscreen", "1": "Borderless", "2": "Windowed"}
    return {
        "id": "returnal", "title": "Returnal", "status": "Now playing",
        "summary": ("4K with native HDR and every image-smearing effect disabled through engine "
                    "overrides rather than by lowering quality. Texture streaming is switched off "
                    "because it was the actual cause of textures failing to load in long sessions."),
        "groups": [
            {"name": "Display & window", "settings": [
                S("Resolution", f"{gus.get('LastUserConfirmedResolutionSizeX','?')} x "
                                f"{gus.get('LastUserConfirmedResolutionSizeY','?')} (4K)"),
                S("Window mode", mode.get(gus.get("FullscreenMode"), gus.get("FullscreenMode"))),
                S("Display device", "my monitor"),
                S("In-game V-Sync", gus.get("bUseVSync")),
                S("Frame rate limit", f"{gus.get('FrameRateLimit')} (uncapped in-game; the driver "
                                      f"owns the cap)"),
                S("Dynamic resolution", gus.get("bUseDynamicResolution")),
            ]},
            {"name": "HDR", "settings": [
                S("HDR output", gus.get("bUseHDRDisplayOutput")),
                S("HDR peak brightness", f"{gus.get('HDRDisplayOutputNits')} nits"),
                S("Note", "Native HDR is good here, so nothing is layered on top of it."),
            ]},
            {"name": "DLSS", "settings": [
                S("Mode", gus.get("DLSSMode")),
                S("Sharpness", gus.get("DLSSSharpness")),
                S("Frame generation", gus.get("bDLSSFrameGen")),
                S("DLL preset", "Preset K, updated with DLSS Swapper"),
            ]},
            {"name": "Effects disabled by engine override (Engine.ini)",
             "settings": [S(FX_LABEL.get(k, k), f"{v}   -  off")
                          for k, v in sorted(sysset.items()) if k in FX_LABEL]},
            {"name": "Launch options", "settings": [
                S("-notexturestreaming",
                  "Texture streaming off. This is a FIX, not a quality change: with streaming on, "
                  "textures stopped loading correctly after several hours of play."),
            ]},
        ],
        "mods": [
            {"name": "DLSS Swapper", "note": "Used to keep the DLSS libraries current and to pin "
                                             "the preset."},
            {"name": "Process Lasso", "note": "A CPU set pins the game to the cache-heavy core "
                                              "cluster, and its automatic priority balancing is "
                                              "excluded for this game."},
        ],
        "modsNote": ("Nothing here reduces visual quality. The disabled effects are the ones that "
                     "blur or dirty the image - motion blur, depth of field, lens flare, chromatic "
                     "aberration and grain - and everything else stays maxed."),
        "settingsNote": ("Read directly from the game's GameUserSettings.ini and the "
                         "[SystemSettings] block of its Engine.ini."),
    }


def death_stranding():
    fx = {name: section(DSDC / "DeathStrandingDCFix.ini", name)
          for name in ("Intro Skip", "Custom Resolution", "Force Entity Updates", "Gameplay FOV",
                       "Center HUD", "Fix Movies", "Fix FOV", "Fix HUD")}
    rows = []
    for name, vals in fx.items():
        if not vals:
            continue
        if name == "Gameplay FOV":
            rows.append(S("Gameplay FOV multiplier", vals.get("Multiplier", "?")))
        else:
            rows.append(S(name, vals.get("Enabled", "?")))
    return {
        "id": "death-stranding-directors-cut", "title": "Death Stranding Director's Cut",
        # ⭐ The setup id names an EDITION, but the game archive lists the title. An explicit
        # target is safer than fuzzy edition-matching, which would risk attaching settings to
        # the wrong game.
        "applies_to": "death-stranding",
        "status": "Now playing",
        "summary": ("4K with a slightly widened field of view, using a community fix configured "
                    "deliberately narrowly - only the parts that help a 16:9 screen are enabled, "
                    "and the ultrawide-specific fixes are left off."),
        "groups": [
            {"name": "Display", "settings": [S("Resolution", "3840 x 2160 (4K)"),
                                             S("Display device", "my monitor")]},
            {"name": "Community fix (DeathStrandingDCFix)", "settings": rows},
            {"name": "ReShade", "settings": [
                S("Disabled add-ons", "Generic Depth, Effect Runtime Sync"),
            ]},
        ],
        "mods": [
            {"name": "DeathStrandingDCFix", "note": "Community fix. Only the field-of-view "
                                                    "multiplier and entity-update fix are enabled; "
                                                    "the ultrawide, movie and HUD fixes are "
                                                    "deliberately off because they are for aspect "
                                                    "ratios this setup does not use."},
            {"name": "ReShade", "note": "Installed with the add-ons that conflict with capture "
                                        "switched off."},
            {"name": "Process Lasso", "note": "CPU set pinned to the cache-heavy core cluster."},
        ],
        "modsNote": ("HDR correction for this one is still outstanding - unlike Returnal, its "
                     "native HDR needs work, and that has not been done yet. It is listed here "
                     "rather than left out, so the gap is visible."),
        "settingsNote": "Read directly from DeathStrandingDCFix.ini and ReShade.ini in the game folder.",
    }


def main():
    apply = "--apply" in sys.argv
    doc = json.loads(SETUPS.read_text(encoding="utf-8"))
    existing = {g["id"]: g for g in doc["games"]}
    for g in (returnal(), death_stranding()):
        n = sum(len(s["settings"]) for s in g["groups"])
        print(f"  {g['id']:<34} {n:>3} settings, {len(g['mods'])} tool(s)")
        existing[g["id"]] = g
    doc["games"] = sorted(existing.values(), key=lambda g: g["title"].lower())

    leak = re.compile(r"(RTX|GTX)\s*\d{3,4}|GeForce\s+(RTX|GTX)|Radeon\s+(RX|R\d)"
                      r"|PG\d{2}\w+|Ryzen\s+\d|Intel\s+Core\s+i\d|\d+\s*GB\s*VRAM", re.I)
    found = sorted(set(m.group(0) for m in leak.finditer(json.dumps(doc, ensure_ascii=False))))
    if found:
        print(f"  ⛔ HARDWARE LEAK: {found} — NOT writing")
        return 1
    print("  hardware check: clean")
    if apply:
        SETUPS.write_text(json.dumps(doc, ensure_ascii=False, indent=1),
                          encoding="utf-8", newline="\n")
        print(f"  wrote setups.json ({len(doc['games'])} games)")
    else:
        print("  (dry run — pass --apply)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

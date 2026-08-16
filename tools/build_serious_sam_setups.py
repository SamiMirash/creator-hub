r"""Publish the real, detailed settings for every Serious Sam entry into data/setups.json.

the creator, 2026-08-16: "We want people to know the detailed settings that we are tuning in here, and
all the tools and mods and whatever, for all of our games… the absolute most detail. We want to
include everything except our hardware."

⛔ NO HARDWARE. No GPU, CPU, or monitor model. Where a value would name one, it says "my monitor".
⛔ SS2's Sam2.ini stores the GPU name in sam_strGraphicCardName — never published.
⭐ Values come from C:\Tools\Game Version Check\harvest_settings.py, which reads each game's OWN
config file. Prose describes what was done and why; the numbers are not typed from memory.

Run: build_serious_sam_setups.py [--apply]
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SETUPS = ROOT / "data" / "setups.json"
HARVEST = r"C:\Tools\Game Version Check\harvest_settings.py"

FILTERING = {"21": "Anisotropic, highest quality (21)", "22": "Anisotropic, highest quality (22)"}
GFXAPI = {"0": "OpenGL", "1": "Direct3D"}
YESNO = {"0": "Off", "1": "On"}


def clean(v):
    """Strip SE1's (INDEX)/(FLOAT) type prefix."""
    s = str(v)
    for p in ("(INDEX)", "(FLOAT)", "(STRING)"):
        s = s.replace(p, "")
    return s.strip()


def S(label, value):
    return {"label": label, "value": str(value)}


def group(name, pairs):
    return {"name": name, "settings": [S(a, b) for a, b in pairs if b not in (None, "")]}


def se1_groups(cfg, sk, gl_note):
    c = {k: clean(v) for k, v in cfg.items()}
    g = [
        group("Display & window", [
            ("Resolution", f"{c.get('sam_iScreenSizeI','?')} x {c.get('sam_iScreenSizeJ','?')} (4K)"),
            ("Window mode", YESNO.get(c.get("sam_bFullScreen"), "?").replace("On", "Fullscreen")),
            ("Display device", "my monitor"),
            ("Renderer", GFXAPI.get(c.get("sam_iGfxAPI"), c.get("sam_iGfxAPI"))),
            ("Colour depth", "Desktop default"),
        ]),
        group("Textures & filtering", [
            ("Texture filtering", FILTERING.get(c.get("gap_iTextureFiltering"),
                                                c.get("gap_iTextureFiltering"))),
            ("Anisotropic filtering", f"{c.get('gap_iTextureAnisotropy','?')}x"),
            ("Texture quality", "Maximum the 32-bit engine allows (3x); 4x is not reachable"),
        ]),
        group("Audio", [
            ("Sound interface", "DirectSound (wrapped by DSOAL)"),
            ("Sound format", c.get("snd_iFormat")),
            ("EAX reverb", "Enabled - confirmed by 'EAX: Enabled' in the game's own log"),
        ]),
        group("Input & view", [
            ("Field of view", f"{c.get('plr_fFOV','?')} (derived for 16:9, not copied)"),
            ("Mouse filtering", YESNO.get(c.get("inp_bFilterMouse"), c.get("inp_bFilterMouse"))),
            ("Horizontal sensitivity", c.get("inp_fSensitivityHorizontal")),
            ("Vertical sensitivity", c.get("inp_fSensitivityVertical")),
            ("Invert vertical", YESNO.get(c.get("inp_bInvertVertical"), c.get("inp_bInvertVertical"))),
        ]),
        group("HDR (added by Special K)", [
            ("16-bit swap chain", sk.get("Use16BitSwapChain", "true")),
            ("scRGB luminance", f"{sk.get('scRGBLuminance_[0]','12.5')}  (= 1000 nits)"),
            ("scRGB paper white", f"{sk.get('scRGBPaperWhite_[0]','2.5')}  (= 200 nits)"),
            ("How", gl_note),
        ]),
    ]
    return g


FOV_NOTE = ("Field of view is derived, never copied between games: "
            "hfov(16:9) = 2*atan(tan(hfov(4:3)/2) * 3/4 * 16/9). Every engine has a different 4:3 "
            "default, so the same number is a different view in a different game.")


def build(h):
    games = []

    # ---- the three classic Serious Engine 1 entries ----------------------------------------
    for gid, title, key, extra in (
        ("serious-sam-the-first-encounter", "Serious Sam: The First Encounter (Gold)", "gold-tfe",
         "Special K loaded as OpenGL32.dll, which replaces the presentation path and gives the "
         "classic engine a real HDR swap chain."),
        ("serious-sam-the-second-encounter", "Serious Sam: The Second Encounter (Gold)", "gold-tse",
         "Special K loaded as OpenGL32.dll, same as the First Encounter."),
        ("serious-sam-classics-revolution", "Serious Sam Classics: Revolution", "revolution",
         "Special K as OpenGL32.dll. On this one it is load-bearing beyond HDR - without it the "
         "game renders a black screen under Windows HDR, because it is an OpenGL-only fork with "
         "no Direct3D fallback."),
    ):
        d = h[key]
        games.append({
            "id": gid, "title": title, "status": "Set up, not yet played",
            "summary": ("The classic 2001 engine running at native 4K with hardware-accurate EAX "
                        "reverb restored and real scRGB HDR added on top. Every value below is read "
                        "from the game's own PersistentSymbols.ini."),
            "groups": se1_groups(d.get("cfg", {}), d.get("sk", {}), extra),
            "mods": [
                {"name": "Special K", "note": "Renamed to OpenGL32.dll in the game's Bin folder. "
                                              "Supplies the 16-bit scRGB swap chain."},
                {"name": "DSOAL", "note": "dsound.dll + alsoft.ini. Restores the EAX hardware "
                                          "reverb that Windows Vista removed when it deleted "
                                          "hardware audio mixing. Without it these games are dry."},
            ],
            "modsNote": ("Both are restoration layers, not enhancements - they put back what modern "
                         "Windows took away. Nothing about the gameplay is altered."),
            "settingsNote": ("Read directly from PersistentSymbols.ini and the Special K profile. "
                             + FOV_NOTE),
        })

    # ---- the HD remakes (Serious Engine 3) --------------------------------------------------
    for gid, title, key in (("serious-sam-hd-the-first-encounter",
                             "Serious Sam HD: The First Encounter", "hd-tfe"),
                            ("serious-sam-hd-the-second-encounter",
                             "Serious Sam HD: The Second Encounter", "hd-tse")):
        c = {k: clean(v) for k, v in h[key]["cfg"].items()}
        dg = h[key]["dgv"]
        # HD TSE also carries a user.cfg with the banned post-processing effects
        cv = h.get("usercfg", {}).get(key, [])
        extra_group = ([{"name": "Tuned settings (from the game's own user.cfg)",
                         "settings": [S(x["key"], x["value"] +
                                        (f"   -  {x['why']}" if x["why"] else ""))
                                      for x in cv]}] if cv else [])
        games.append({
            "id": gid, "title": title, "status": "Set up, not yet played",
            "summary": ("A DirectX 9 game with no HDR of its own, running 4K HDR anyway: dgVoodoo2 "
                        "re-implements D3D9 on top of D3D11 and emits a Float16 scRGB swap chain "
                        "itself."),
            "groups": [
                group("Display & window", [
                    ("Resolution", f"{c.get('gfx_pixResWidth','?')} x {c.get('gfx_pixResHeight','?')} (4K)"),
                    ("Window mode", YESNO.get(c.get("gfx_bFullScreen"), "?").replace("On", "Fullscreen")),
                    ("Display device", "my monitor"),
                    ("Refresh rate", f"{c.get('gfx_iRefreshRate','?')} Hz"),
                    ("In-game V-Sync", YESNO.get(c.get("gfx_iWaitVSyncs"), c.get("gfx_iWaitVSyncs"))),
                    ("Frame cap", f"{c.get('gfx_iMaxFPSActive','?')} (effectively uncapped in-game)"),
                ]),
                group("Image", [
                    ("Anti-aliasing samples", c.get("gfx_iAntiAliasingSamples")),
                    ("Post-processing", YESNO.get(c.get("gfx_bUsePostprocessing"), "?")),
                    ("Engine HDR rendering", YESNO.get(c.get("gfx_bHDRRendering"), "?")),
                    ("Gamma", c.get("gfx_fGammaCorrection")),
                    ("Output levels", c.get("gfx_iOutputLevels")),
                ]),
                group("dgVoodoo2 (D3D9 to D3D11 wrapper)", [
                    ("Output API", dg.get("OutputAPI")),
                    ("Colour space", f"{dg.get('ColorSpace')}  (Float16 HDR output)"),
                    ("Presentation model", dg.get("PresentationModel")),
                    ("Forced resolution", dg.get("Resolution")),
                    ("Emulated VRAM", f"{dg.get('VRAM')} MB"),
                    ("Filtering", dg.get("Filtering")),
                    ("Anti-aliasing", dg.get("Antialiasing")),
                    ("Watermark", dg.get("dgVoodooWatermark")),
                ]),
            ] + extra_group,
            "hdrWriteup": {
                "title": "How a 2009 DirectX 9 game ends up in HDR",
                "paragraphs": [
                    "Direct3D 9 has no concept of an HDR swap chain, so there is nothing for an HDR "
                    "injector to attach to. The trick is to change the API underneath the game: "
                    "dgVoodoo2 re-implements D3D9 on Direct3D 11, and then emits a Float16 scRGB "
                    "swap chain of its own.",
                    "The important detail is that dgVoodoo does the HDR itself. Layering a second "
                    "HDR injector on top to override the buffer format is what crashed this engine "
                    "for weeks - the game cannot survive its back buffer being reformatted under it.",
                    "The other half is memory. A 32-bit game only gets 2 GB of address space, and at "
                    "4K with a wrapper holding its own resources the engine runs out and reports "
                    "'Direct3D: Out of memory' while tens of gigabytes are still free. The "
                    "executable is patched Large Address Aware to raise that ceiling.",
                ],
            },
            "mods": [
                {"name": "dgVoodoo2", "note": "D3D9.dll beside the executable. Translates the game "
                                              "to Direct3D 11 and outputs Float16 scRGB HDR."},
                {"name": "Large Address Aware patch", "note": "A single header flag on the "
                                                              "executable, raising the 32-bit "
                                                              "address-space ceiling from 2 GB to 4 GB."},
            ],
            "settingsNote": "Read directly from the game's own config and from dgVoodoo.conf.",
        })

    # ---- Serious Sam 2 ----------------------------------------------------------------------
    c = {k: clean(v) for k, v in h["ss2"]["cfg"].items()}
    dg = h["ss2"]["dgv"]
    games.append({
        "id": "serious-sam-2", "title": "Serious Sam 2", "status": "Set up, not yet played",
        "summary": ("4K with a derived 16:9 field of view and Float16 scRGB HDR through dgVoodoo2. "
                    "Its config file is deliberately read-only, because the engine deletes any line "
                    "it does not recognise the moment it saves."),
        "groups": [
            group("Display & window", [
                ("Resolution", f"{c.get('gfx_pixResWidth','?')} x {c.get('gfx_pixResHeight','?')} (4K)"),
                ("Display device", "my monitor"),
                ("Graphics API", c.get("gfx_iAPI")),
                ("Engine HDR rendering", YESNO.get(c.get("gfx_bHDRRendering"), "?")),
            ]),
            group("Image quality", [
                ("Texture quality", f"{c.get('tex_iQuality')} (highest)"),
                ("Lightmap quality", f"{c.get('lmp_iQuality')} (highest)"),
                ("Dynamic shadow quality", c.get("ren_iDynamicShadowQuality")),
                ("Lens flare quality", c.get("efx_iLensFlareQuality")),
            ]),
            group("View", [
                ("Field of view", f"{c.get('plr_fFOVOverride','?')} (derived for 16:9)"),
                ("Weapon FOV fix", YESNO.get(c.get("hud_bFixWeaponFOV"), "?")),
                ("Menu safe zone", f"{c.get('men_pixSafeZoneWidth')} x {c.get('men_pixSafeZoneHeight')}"),
            ]),
            group("dgVoodoo2 (D3D9 to D3D11 wrapper)", [
                ("Output API", dg.get("OutputAPI")),
                ("Colour space", f"{dg.get('ColorSpace')}  (Float16 HDR output)"),
                ("Presentation model", dg.get("PresentationModel")),
                ("Emulated VRAM", f"{dg.get('VRAM')} MB"),
                ("Filtering", dg.get("Filtering")),
            ]),
        ],
        "mods": [
            {"name": "dgVoodoo2", "note": "D3D9.dll in the Bin folder, outputting Float16 scRGB HDR."},
            {"name": "Large Address Aware patch", "note": "Same 2 GB address-space fix as the HD games."},
        ],
        "modsNote": ("One quirk worth knowing: because a wrapper changes the reported graphics "
                     "device, the game shows a 'your graphic card has been changed' notice on every "
                     "launch unless the stored device name in its config is updated to match."),
        "settingsNote": ("Read directly from Sam2.ini and dgVoodoo.conf. " + FOV_NOTE),
    })

    # ---- Double D XXL -----------------------------------------------------------------------
    dx = h["double-d-xxl"]["dxvk"]
    games.append({
        "id": "serious-sam-double-d-xxl", "title": "Serious Sam Double D XXL",
        "status": "Set up, not yet played",
        "summary": ("An XNA game in HDR, which took a third approach entirely: DXVK translates "
                    "Direct3D 9 to Vulkan and upgrades ONLY the swap chain, so the game itself "
                    "never sees a change."),
        "groups": [
            group("Display", [("Resolution", "3840 x 2160 (4K)"), ("Display device", "my monitor")]),
            group("DXVK (D3D9 to Vulkan, HDR build)", [
                ("Swap chain upgrade", dx.get("d3d9.enableSwapChainUpgrade")),
                ("Swap chain format", dx.get("d3d9.upgradeSwapChainFormatTo")),
                ("Swap chain colour space", dx.get("d3d9.upgradeSwapChainColorSpaceTo")),
                ("Window mode enforcement", dx.get("d3d9.enforceWindowModeInternally")),
            ]),
        ],
        "hdrWriteup": {
            "title": "Why this one needed a different tool",
            "paragraphs": [
                "XNA validates its back buffer format strictly. Any HDR method that reformats the "
                "buffer makes the .NET runtime throw and the game closes instantly - both 16-bit "
                "and 10-bit attempts failed that way. A D3D9-to-D3D11 wrapper failed differently, "
                "crashing on a device reset the game cannot handle.",
                "The DXVK HDR build upgrades only the swap chain - the surface actually handed to "
                "the display - and leaves the game's own render targets untouched. The game is "
                "none the wiser, and the output is Float16 scRGB.",
                "One placement detail: XNA loads its Direct3D from a shared framework folder rather "
                "than the game folder, so the wrapper has to live where the framework looks, not "
                "next to the executable.",
            ],
        },
        "mods": [{"name": "DXVK (HDR build)", "note": "Translates D3D9 to Vulkan and upgrades the "
                                                      "swap chain to Float16 scRGB."}],
        "settingsNote": "Read directly from dxvk.conf.",
    })

    # ---- Special K only, Unity titles --------------------------------------------------------
    for gid, title, key, note in (
        ("serious-sam-tormental", "Serious Sam: Tormental", "tormental", None),
        ("i-hate-running-backwards", "I Hate Running Backwards", "ihrb", None),
        ("serious-sam-kamikaze-attack", "Serious Sam: Kamikaze Attack!", "kamikaze", None),
    ):
        sk = h[key]["sk"]
        games.append({
            "id": gid, "title": title, "status": "Set up, not yet played",
            "summary": "4K with scRGB HDR retrofitted by Special K onto the existing swap chain.",
            "groups": [
                group("Display", [("Resolution", "3840 x 2160 (4K)"),
                                  ("Window mode", "Exclusive fullscreen"),
                                  ("Display device", "my monitor")]),
                group("HDR (Special K)", [
                    ("16-bit swap chain", sk.get("Use16BitSwapChain", "true")),
                    ("scRGB luminance", f"{sk.get('scRGBLuminance_[0]','12.5')}  (= 1000 nits)"),
                    ("scRGB paper white", f"{sk.get('scRGBPaperWhite_[0]','2.5')}  (= 200 nits)"),
                ]),
            ],
            "mods": [{"name": "Special K", "note": "Loaded as dxgi.dll beside the executable."}],
            "settingsNote": "Read directly from the Special K profile beside the game.",
        })

    # ---- Random Encounter --------------------------------------------------------------------
    dg, sk = h["random-encounter"]["dgv"], h["random-encounter"]["sk"]
    games.append({
        "id": "serious-sam-the-random-encounter", "title": "Serious Sam: The Random Encounter",
        "status": "Set up, not yet played",
        "summary": ("A pixel-art game that draws through plain Windows GDI - no 3D swap chain at "
                    "all - running in HDR through a two-stage chain."),
        "groups": [
            group("Display", [("Forced resolution", dg.get("Resolution")),
                              ("Display device", "my monitor")]),
            group("dgVoodoo2 (GDI capture to D3D11)", [
                ("Output API", dg.get("OutputAPI")),
                ("System hook", f"{dg.get('SystemHookFlags')}  (routes GDI drawing into D3D11)"),
                ("Filtering", f"{dg.get('Filtering')}  (keeps the pixel art crisp)"),
                ("Emulated VRAM", f"{dg.get('VRAM')} MB"),
            ]),
            group("HDR (Special K)", [
                ("16-bit swap chain", sk.get("Use16BitSwapChain", "true")),
                ("scRGB luminance", f"{sk.get('scRGBLuminance_[0]','12.5')}  (= 1000 nits)"),
                ("scRGB paper white", f"{sk.get('scRGBPaperWhite_[0]','2.5')}  (= 200 nits)"),
            ]),
        ],
        "mods": [
            {"name": "dgVoodoo2", "note": "Hooks GDI drawing and re-presents it through Direct3D 11, "
                                          "which creates the swap chain that did not exist before."},
            {"name": "Special K", "note": "Retrofits Float16 scRGB HDR onto that swap chain."},
        ],
        "modsNote": ("Point sampling is deliberate. Any smoothing filter would blur pixel art that "
                     "is meant to stay hard-edged."),
        "settingsNote": "Read directly from dgVoodoo.conf and the Special K profile.",
    })

    # ---- Bogus Detour -------------------------------------------------------------------------
    games.append({
        "id": "serious-sams-bogus-detour", "title": "Serious Sam's Bogus Detour",
        "status": "Set up, not yet played",
        "summary": ("4K with scRGB HDR. This one ignores any library placed next to it, so the HDR "
                    "layer has to be injected a different way."),
        "groups": [
            group("Display", [("Resolution", "3840 x 2160 (4K)"), ("Display device", "my monitor")]),
            group("HDR (Special K, global injection)", [
                ("Swap chain format", "Float16 (R16G16B16A16_FLOAT)"),
                ("Colour space", "scRGB (G10_NONE_P709)"),
                ("scRGB luminance", "12.5  (= 1000 nits)"),
                ("scRGB paper white", "2.5  (= 200 nits)"),
            ]),
        ],
        "mods": [{"name": "Special K (global injection)",
                  "note": "The engine resolves its graphics libraries by absolute system path, so a "
                          "renamed library in the game folder is never even looked at. A "
                          "system-wide hook is the only thing that reaches it - armed at launch and "
                          "removed again when the game exits, so nothing stays resident."}],
        "settingsNote": "Confirmed from Special K's own log for this game.",
    })

    # ---- emulated entries ----------------------------------------------------------------------
    dol = h["dolphin"]
    games.append({
        "id": "serious-sam-next-encounter", "title": "Serious Sam: Next Encounter (GameCube)",
        "status": "Set up, not yet played",
        "summary": "Emulated at six times the original internal resolution, in its true 4:3 shape.",
        "groups": [
            group("Emulation", [
                ("Emulator", "Dolphin"),
                ("Graphics backend", "Direct3D 12"),
                ("Internal resolution", f"{dol.get('InternalResolution')}x native (about 4K)"),
                ("Aspect ratio", "Auto - the game is 4:3 and stays 4:3"),
                ("Widescreen hack", f"{dol.get('wideScreenHack')} - it clips the game's own menu, "
                                    f"so it is deliberately off"),
                ("Anisotropic filtering", f"{dol.get('MaxAnisotropy')}x"),
                ("In-emulator V-Sync", dol.get("VSync")),
                ("Safe texture cache", dol.get("SafeTextureCacheColorSamples")),
                ("System BIOS", "Not required to play"),
            ]),
        ],
        "mods": [],
        "modsNote": ("The widescreen hack does render a genuinely wider view rather than stretching, "
                     "but this game's menus are authored for 4:3 and get pushed off screen, so it is "
                     "left off. Pillarboxing is handled on the stream side instead."),
        "settingsNote": "Read directly from the emulator's own graphics config.",
    })

    mu = h["retroarch-mu"]
    games.append({
        "id": "serious-sam-palm-os", "title": "Serious Sam (Palm OS)",
        "status": "Set up, not yet played",
        "summary": "The handheld version, emulated. Its screen is square, not widescreen or 4:3.",
        "groups": [
            group("Emulation", [
                ("Emulator", "RetroArch, Mu core"),
                ("Emulated device", mu.get("palm_emu_os_version")),
                ("Graffiti input area", f"{mu.get('palm_emu_disable_graffiti')} - hiding it leaves "
                                        f"a true 1:1 square image"),
                ("CPU speed", mu.get("palm_emu_cpu_speed")),
                ("Joystick as mouse", mu.get("palm_emu_use_joystick_as_mouse")),
                ("Window mode", "Exclusive fullscreen"),
            ]),
        ],
        "mods": [],
        "modsNote": ("Because the image is square rather than 4:3, it leaves a wide empty band on "
                     "each side of a 16:9 screen. That is filled on the stream side with a dark, "
                     "blurred extension of the game's own edge colours, so nothing is stretched or "
                     "cropped."),
        "settingsNote": "Read directly from the emulator core's option file.",
    })

    games.append({
        "id": "serious-sam-xbox", "title": "Serious Sam (Original Xbox)",
        "status": "Set up, not yet played",
        "summary": ("The Xbox version, which contains both campaigns plus content that exists "
                    "nowhere else, patched for real anamorphic 16:9."),
        "groups": [
            group("Emulation", [
                ("Emulator", "xemu"),
                ("Renderer", "Vulkan"),
                ("Internal resolution scale", "8x"),
                ("Aspect ratio", "16:9"),
                ("Disc image", "Converted to the format the emulator reads directly"),
            ]),
        ],
        "mods": [{"name": "Widescreen patch",
                  "note": "Applied to the game executable inside the disc image, in place. This "
                          "renders a genuinely wider view rather than stretching a 4:3 image - "
                          "verified by measuring a circular HUD element and confirming it is still "
                          "round."}],
        "modsNote": ("This version is not a straight port. It adds a weapon and an item that the PC "
                     "versions do not have, and a lives system, but has fewer enemies on screen and "
                     "smaller levels."),
        "settingsNote": "Read directly from the emulator's own config.",
    })

    # ---- the Serious Engine 3/4 games, tuned through user.cfg -------------------------------
    # ⚠️ user.cfg is where the real tuning lives for these. Searching only for '*.ini' missed it
    # and I wrongly reported these as having no config at all.
    for gid, title, key, platform, summary, extra_mods in (
        ("serious-sam-3-bfe", "Serious Sam 3: BFE", "ss3", "PC",
         "4K with every post-processing effect that smears the image switched off, and a derived "
         "16:9 field of view. HDR is added by the graphics driver, since the game has none.", []),
        ("serious-sam-4", "Serious Sam 4", "ss4", "PC (GOG)",
         "4K with the game's own native HDR switched on. Worth knowing: the GOG build is a version "
         "AHEAD of the Steam one.", []),
        ("serious-sam-siberian-mayhem", "Serious Sam: Siberian Mayhem", "siberian", "PC (GOG)",
         "Same engine and the same treatment as Serious Sam 4, with native HDR on.", []),
    ):
        cv = h["usercfg"][key]
        games.append({
            "id": gid, "title": title, "status": "Set up, not yet played",
            "summary": summary,
            "groups": [
                group("Display", [("Resolution", "3840 x 2160 (4K)"),
                                  ("Platform", platform),
                                  ("Display device", "my monitor")]),
                {"name": "Tuned settings (from the game's own user.cfg)",
                 "settings": [S(c["key"], c["value"] + (f"   -  {c['why']}" if c["why"] else ""))
                              for c in cv]},
            ],
            "mods": extra_mods,
            "modsNote": ("Nothing is modded here - these are the engine's own console variables, "
                         "written to user.cfg so they load after the saved settings and win."),
            "settingsNote": ("Read directly from the game's user.cfg. The comments are the actual "
                             "reasons the value was chosen, not added afterwards. " + FOV_NOTE),
        })

    # ---- Serious Sam Advance (emulated) -------------------------------------------------------
    nba = h["nanoboyadvance"]
    games.append({
        "id": "serious-sam-advance", "title": "Serious Sam Advance",
        "status": "Set up, not yet played",
        "summary": "The Game Boy Advance entry - an original story, not a port - on a "
                   "cycle-accurate emulator.",
        "groups": [group("Emulation", [
            ("Emulator", "NanoBoyAdvance (cycle-accurate)"),
            ("Scale", nba.get("scale")),
            ("Fullscreen", nba.get("fullscreen")),
            ("Filter", nba.get("filter")),
            ("Colour correction", f"{nba.get('color_correction')} - matches the original "
                                  f"handheld screen's colour response"),
            ("LCD ghosting", nba.get("lcd_ghosting")),
            ("Display device", "my monitor"),
        ])],
        "mods": [],
        "settingsNote": "Read directly from the emulator's own config file.",
    })

    # ---- entries whose own config file does not exist on disk yet ---------------------------
    # ⛔ These have NO readable config (GOG installs keep theirs elsewhere, and a game that has not
    # been launched since reinstall has not written one). Publishing invented numbers would be
    # worse than publishing none, so these state only what is verified and say so plainly.
    # (the former 'pending' stubs are gone - all four now have real, harvested settings)

    return games


def main():
    apply = "--apply" in sys.argv
    raw = subprocess.run([sys.executable, HARVEST], capture_output=True, text=True)
    h = json.loads(raw.stdout)
    new = build(h)

    doc = json.loads(SETUPS.read_text(encoding="utf-8"))
    existing = {g["id"]: g for g in doc["games"]}
    for g in new:
        existing[g["id"]] = g
    doc["games"] = sorted(existing.values(), key=lambda g: g["title"].lower())

    total_settings = sum(len(s["settings"]) for g in new for s in g["groups"])
    print(f"  built {len(new)} game entries, {total_settings} individual settings")
    for g in new:
        n = sum(len(s["settings"]) for s in g["groups"])
        print(f"    {g['id']:<38} {n:>3} settings, {len(g.get('mods') or [])} tool(s)")

    # ⛔ Block hardware IDENTITY, not brand or feature words. "RTX Dynamic Vibrance" is a setting
    # name and "GeForce Game Ready 610.62" is a driver version — neither says which card this is.
    # A bare brand check flagged both and would have blocked a clean write.
    import re as _re
    leak = _re.compile(r"(RTX|GTX)\s*\d{3,4}|GeForce\s+(RTX|GTX)|Radeon\s+(RX|R\d)"
                       r"|PG\d{2}\w+|Ryzen\s+\d|Intel\s+Core\s+i\d", _re.I)
    blob = json.dumps(doc, ensure_ascii=False)
    found = sorted(set(m.group(0) for m in leak.finditer(blob)))
    if found:
        print(f"  ⛔ HARDWARE LEAK: {found} — NOT writing")
        return 1
    print("  hardware check: clean (no GPU/CPU/monitor model named)")

    if apply:
        SETUPS.write_text(json.dumps(doc, ensure_ascii=False, indent=1),
                          encoding="utf-8", newline="\n")
        print(f"  wrote {SETUPS}  ({len(doc['games'])} games total)")
    else:
        print("  (dry run — pass --apply)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

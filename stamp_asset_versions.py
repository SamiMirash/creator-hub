r"""Stamp every asset URL in the site's HTML with its file's content hash.

⛔⛔ RUN THIS AFTER EDITING ANYTHING IN assets/. 2026-08-27.

WHY. The YouTube grid was fixed, deployed and verified — and the creator still saw the broken message.
The heading had changed but the box under it had not, because `index.html` revalidates while
`assets/content.js` was served with `Cache-Control: max-age=14400` and NO version in its URL.
A visitor got the NEW html and the OLD javascript for up to four hours.

⭐ THE POINT: a version marker makes a stale asset IMPOSSIBLE rather than unlikely. When the file
changes, its hash changes, so its URL changes, so no cache anywhere can answer with the old bytes.
Paired with `_headers`, which lets HTML revalidate and lets the now-immutable assets cache for a
year.

⚠️ IF YOU EDIT AN ASSET AND DO NOT RUN THIS, the HTML keeps pointing at the OLD hash and every
visitor keeps the OLD file. The deploy will look like it did nothing — exactly the failure this
exists to prevent. It is idempotent, so running it when nothing changed is free.
"""
import hashlib
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent


def main():
    assets = {}
    for pattern in ("assets/*.js", "assets/*.css"):
        for p in sorted(ROOT.glob(pattern)):
            assets[p.relative_to(ROOT).as_posix()] = hashlib.sha256(p.read_bytes()).hexdigest()[:10]

    if not assets:
        print("  ⛔ no assets found — refusing to rewrite any HTML")
        return 1

    print("  assets:")
    for a, h in assets.items():
        print("    %-28s v=%s" % (a, h))

    changed, checked = [], 0
    for html in sorted(ROOT.glob("*.html")):
        s = html.read_text(encoding="utf-8")
        orig = s
        checked += 1
        for a, h in assets.items():
            s = re.sub(r'(["\'])' + re.escape(a) + r'(?:\?v=[0-9a-f]+)?(["\'])',
                       lambda m, a=a, h=h: m.group(1) + a + "?v=" + h + m.group(2), s)
        if s != orig:
            html.write_text(s, encoding="utf-8")
            changed.append(html.name)

    print("\n  %d html files checked, %d updated" % (checked, len(changed)))
    for n in changed:
        print("    %s" % n)

    # ⛔ verify off disk. a stamp that did not land is the whole bug this script prevents.
    stale = []
    for html in sorted(ROOT.glob("*.html")):
        s = html.read_text(encoding="utf-8")
        for a, h in assets.items():
            for found in re.findall(re.escape(a) + r'\?v=([0-9a-f]+)', s):
                if found != h:
                    stale.append("%s -> %s (has %s, want %s)" % (html.name, a, found, h))
            # an unversioned reference is equally a failure
            if re.search(r'(["\'])' + re.escape(a) + r'(["\'])', s):
                stale.append("%s -> %s (UNVERSIONED)" % (html.name, a))
    print("\n  verification: %s" % ("✅ every reference carries the current hash"
                                    if not stale else "⛔ STALE REFERENCES:"))
    for s_ in stale:
        print("    %s" % s_)
    return 1 if stale else 0


if __name__ == "__main__":
    sys.exit(main())

# Sami Mirash creator hub

This folder is the source of truth for the public creator website. The older
export folders are archival build artifacts; edit this folder, validate it, then
let the approved deploy step publish it.

The stack is intentionally free:

- GitHub Pages static hosting
- Supabase free tier for browser auth, profiles, and newsletter signup
- Plain HTML, CSS, and vanilla JavaScript
- Data-driven pages from `data/*.json`
- No payments, no tracking scripts, no platform automation

## Public pages

- Home, Live, Chat, Schedule, Clips, Community
- Join, Login, Members, Profile, Newsletter
- About, Support, Merch, Sponsors, Opinions, Articles, Contact
- Privacy, Terms, 404

## Content workflow

Edit the JSON files under `data/`:

- `site.json`: site identity, live status, active public channels
- `platforms.json`: public channels and pending channel notes
- `schedule.json`: upcoming streams and recurring blocks
- `clips.json`: approved public clips and VOD entries
- `articles.json`: approved public recaps and notes
- `community.json`: rules and public community channels
- `support.json`: free support and member value
- `sponsors.json`: sponsor policy and media-kit status
- `media_kit.json`: audience-fit structure and owner-reviewed metrics status
- `opinions.json`: Sami's personal takes / opinion posts
- `merch.json`: reviewed merch or support items
- `member_posts.json`: members-only prompts, topics, and bonus notes

Use honest empty states when content is not posted yet. Do not invent cards just
to fill a layout.

## First-stream announcement (remove after going live)

A "Going live for the very first time tomorrow" announcement is live in two
places, both easy to change:

1. **Sitewide amber banner** (top of every page) and the home live-status card:
   controlled by `data/site.json`.
   - To take it down once the first stream is over, open `data/site.json` and:
     - set `"announcement"` -> `"enabled": false` (hides the banner), and
     - edit `"status".title` / `"status".message` back to everyday copy, and
     - edit `"bio".en` back to everyday copy.
   - To change the wording, just edit `"announcement".message` /
     `"announcement".label` (and `"status"` / `"bio"`) in the same file. No code
     or redeploy of JS is needed; the pages read the JSON live.
2. **Home hero headline**: a clearly commented block in `index.html` (search for
   `FIRST-STREAM ANNOUNCEMENT`). Edit the `eyebrow`, `h1`, and live-badge fallback
   text there back to the everyday copy after going live.

## Draft workflow

Run this off-stream to gather draft website items from companion outputs:

```powershell
python website\tools\draft_from_companion.py
```

The script writes draft-only JSON into `data/_drafts/`. It never publishes,
deploys, uploads, posts, or edits live data. A human reviews the draft, adds real
public URLs, and manually moves approved items into the live `data/*.json` files.

## Supabase setup

Create a free Supabase project, apply `supabase/schema.sql`, then put only the
public project URL and public anon or publishable browser key in `js/config.js`.
Never commit privileged backend keys, admin tokens, passwords, cookies, or
private credentials.

Required Supabase settings:

- Enable email auth.
- Add the public site domain to allowed auth redirects.
- Keep Row-Level Security enabled.
- Keep the policies in `supabase/schema.sql`.

## Local preview

```powershell
python -m http.server 8090 --directory website
```

Open the local preview URL in a browser. Supabase auth requires the public URL,
browser key, and redirect settings before real login flows work.

## Local validation

```powershell
python website\deploy.py --check
python website\deploy.py --check --package
```

The helper checks required files, unresolved editable markers, local links, JSON,
public-safety patterns, and site content markers. It does not deploy, push, open a
browser, or make network calls.

## Publishing rule

Do not publish automatically. The owner should review the validated site
and run the approved GitHub Pages deploy flow separately.

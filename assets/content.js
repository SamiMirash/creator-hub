(function () {
  const cache = new Map();
  const configFallback = {
    channels: { kick: "", x: "", telegram: "", youtube_handle: "", youtube_channel_id: "", twitch: "", tiktok: "", rumble: "", rumble_embed_id: "", instagram: "", discord_invite: "", discord_server_id: "" },
    monetization: { kofi: "", fourthwall_url: "", throne: "", streamloots: "", amazon_affiliate_tag: "", paypal_me: "", buymeacoffee_url: "", rumble_tip_url: "", stripe_url: "", crypto: [] },
    analytics: { plausible_domain: "" },
    features: {}
  };

  const esc = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  async function data(name) {
    if (!cache.has(name)) {
      cache.set(name, fetch(`data/${name}.json`, { cache: "no-store" }).then((res) => {
        if (!res.ok) throw new Error(`Could not load ${name}.json`);
        return res.json();
      }));
    }
    return cache.get(name);
  }

  async function config() {
    try {
      return Object.assign({}, configFallback, await data("config"));
    } catch (_) {
      return configFallback;
    }
  }

  function text(en) {
    return en;
  }

  function mount(selector, html) {
    document.querySelectorAll(selector).forEach((node) => {
      node.innerHTML = html;
    });
  }

  function hide(selector) {
    document.querySelectorAll(selector).forEach((node) => {
      node.hidden = true;
    });
  }

  async function fetchWithTimeout(url, options = {}, timeoutMs = 2500) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      window.clearTimeout(timer);
    }
  }

  function button(href, label, extra = "") {
    if (!href) return "";
    const external = /^https?:\/\//i.test(String(href || ""));
    const rel = external ? ' rel="noopener noreferrer"' : "";
    return `<a class="button ${extra}" href="${esc(href)}"${rel}>${esc(label)}</a>`;
  }

  function externalUrl(kind, value) {
    if (!value) return "";
    const clean = String(value).replace(/^@/, "");
    const map = {
      kick: `https://kick.com/${clean}`,
      x: `https://x.com/${clean}`,
      telegram: `https://t.me/${clean}`,
      youtube: String(value).startsWith("http") ? String(value) : `https://www.youtube.com/@${clean}`,
      twitch: `https://www.twitch.tv/${clean}`,
      tiktok: `https://www.tiktok.com/@${clean}`,
      rumble: `https://rumble.com/user/${clean}`,
      instagram: `https://instagram.com/${clean}`
    };
    return map[kind] || "";
  }

  function officialChannels(cfg) {
    const channels = [];
    // Order: YouTube first, Rumble second, then the rest.
    if (cfg.channels.youtube_handle || cfg.channels.youtube_channel_id) {
      const ytUrl = cfg.channels.youtube_handle
        ? externalUrl("youtube", cfg.channels.youtube_handle)
        : `https://www.youtube.com/channel/${cfg.channels.youtube_channel_id}`;
      channels.push({ name: "YouTube", url: ytUrl, kind: "Video" });
    }
    if (cfg.channels.rumble) channels.push({ name: "Rumble", url: externalUrl("rumble", cfg.channels.rumble), kind: "Video" });
    if (cfg.channels.kick) channels.push({ name: "Kick", url: externalUrl("kick", cfg.channels.kick), kind: "Live" });
    if (cfg.channels.twitch) channels.push({ name: "Twitch", url: externalUrl("twitch", cfg.channels.twitch), kind: "Live" });
    if (cfg.channels.x) channels.push({ name: "X", url: externalUrl("x", cfg.channels.x), kind: "Updates" });
    if (cfg.channels.tiktok) channels.push({ name: "TikTok", url: externalUrl("tiktok", cfg.channels.tiktok), kind: "Clips" });
    if (cfg.channels.instagram) channels.push({ name: "Instagram", url: externalUrl("instagram", cfg.channels.instagram), kind: "Photos" });
    if (cfg.channels.telegram) channels.push({ name: "Telegram", url: externalUrl("telegram", cfg.channels.telegram), kind: "Announcements" });
    return channels;
  }

  function channelCards(cfg) {
    return officialChannels(cfg).map((item, index) => `
      <article class="feature-card official-card">
        <span class="pill">${esc(item.kind)}</span>
        <h2>${esc(item.name)}</h2>
        <p>${item.url ? esc(text("Official public destination.")) : esc(text("Coming soon. No public URL is posted yet."))}</p>
        ${item.url ? button(item.url, text(`Open ${item.name}`), index === 0 ? "primary" : "") : `<span class="pill">${esc(text("Coming soon"))}</span>`}
      </article>
    `).join("");
  }

  function platformCards(platforms, cfg) {
    const items = Array.isArray(platforms.items) ? platforms.items : [];
    if (!items.length) return channelCards(cfg);
    return items.map((item, index) => `
      <article class="feature-card official-card">
        <span class="pill">${esc(item.kind || item.status || text("Platform"))}</span>
        <h2>${esc(item.name)}</h2>
        <p>${esc(item.notes || item.status || text("Official public destination."))}</p>
        ${item.url ? button(item.url, text(`Open ${item.name}`), index === 0 ? "primary" : "") : `<span class="pill">${esc(text("Pending"))}</span>`}
      </article>
    `).join("");
  }

  async function supabaseLiveOverride() {
    const authCfg = window.CREATOR_HUB_CONFIG || {};
    if (!window.supabase || !authCfg.SUPABASE_URL || !authCfg.SUPABASE_ANON_KEY) return null;
    try {
      const client = window.supabase.createClient(authCfg.SUPABASE_URL, authCfg.SUPABASE_ANON_KEY);
      const { data: row, error } = await client.from("public_live_status").select("is_live,title,url,updated_at").eq("id", "main").maybeSingle();
      if (error || !row) return null;
      return row;
    } catch (_) {
      return null;
    }
  }

  async function kickLiveStatus(channel) {
    if (!channel) return null;
    try {
      const res = await fetchWithTimeout(`https://kick.com/api/v2/channels/${encodeURIComponent(channel)}/livestream`, { cache: "no-store" });
      if (!res.ok) return null;
      const payload = await res.json();
      return payload && payload.id ? payload : null;
    } catch (_) {
      return null;
    }
  }

  async function youtubeLatest(channelId) {
      // ⛔ 2026-08-27 , THIS USED TO FETCH YOUTUBE DIRECTLY AND COULD NEVER WORK.
      //   YouTube serves /feeds/videos.xml with NO Access-Control-Allow-Origin header, so the
      //   browser blocked every request on CORS, the catch swallowed it, and the page rendered
      //   "No YouTube videos found" while the channel had public videos the whole time.
      //   MEASURED: the feed returns HTTP 200 and both videos to curl, and no CORS header at all.
      //   ⇒ It now goes through /api/youtube, a Cloudflare Pages Function that reads the feed
      //   server-side (functions/api/youtube.js). Same origin, so CORS never applies.
      if (!channelId) return [];
      try {
        const res = await fetchWithTimeout(`/api/youtube?channel_id=${encodeURIComponent(channelId)}&limit=6`, { cache: "no-store" });
        if (!res.ok) return [];
        const payload = await res.json();
        if (!payload || !payload.ok || !Array.isArray(payload.videos)) return [];
        return payload.videos;
      } catch (_) {
        return [];
      }
    }

  async function renderLiveBadge(cfg, site) {
    if (!cfg.features.live_badge) {
      hide("[data-live-badge]");
      return;
    }
    const offlineLabel = text("Offline");
    const offlineUrl = "newsletter.html";
    mount("[data-live-badge]", `
      <article class="live-badge">
        <span class="status-dot">${esc(offlineLabel)}</span>
        <h2>${esc(site.status.title)}</h2>
        <p>${esc(site.status.message)}</p>
        ${button(offlineUrl, text("Notify me"), "primary")}
      </article>
    `);
    const override = await supabaseLiveOverride();
    const kick = await kickLiveStatus(cfg.channels.kick);
    const isLive = Boolean((override && override.is_live) || kick);
    if (!isLive) return;
    const title = override?.title || kick?.session_title || site.status.title;
    const url = override?.url || externalUrl("kick", cfg.channels.kick) || "live.html";
    const label = text("Live now");
    mount("[data-live-badge]", `
      <article class="live-badge is-live">
        <span class="status-dot">${esc(label)}</span>
        <h2>${esc(title)}</h2>
        <p>${esc(text("The stream appears to be live from the public status check."))}</p>
        ${button(url, text("Watch now"), "primary")}
      </article>
    `);
  }

  // Rumble live player removed: Sami cannot stream live on Rumble (requires
  // monetization/partner status he does not have), so the live-WATCH UI never
  // offers Rumble. (rumbleEmbedSrc() and its channels.rumble_embed_id reader were
  // removed with that card.)

  function renderFacades(cfg) {
    if (!cfg.features.live_player) {
      hide("[data-live-players]");
      return;
    }
    const facades = [];
    // Live-WATCH players. YouTube only. Rumble removed: Sami cannot stream live
    // on Rumble (requires monetization/partner status he does not have), so it
    // must never appear as a place to watch live.
    if (cfg.channels.youtube_channel_id) {
      facades.push({
        name: "YouTube",
        body: text("Loads the YouTube live player after you click."),
        src: `https://www.youtube-nocookie.com/embed/live_stream?channel=${encodeURIComponent(cfg.channels.youtube_channel_id)}`
      });
    }
    mount("[data-live-players]", facades.map((item) => {
      const action = item.src
        ? `<button class="button primary" type="button" data-load-embed>${esc(text("Load player"))}</button>`
        : "";
      const heading = item.src ? text("Click to load player") : text("Coming soon");
      return `
      <article class="embed-facade" data-embed-src="${esc(item.src || "")}" data-embed-title="${esc(item.name)}">
        <span class="pill">${esc(item.name)}</span>
        <h2>${esc(heading)}</h2>
        <p>${esc(item.body)}</p>
        ${action}
      </article>
    `;
    }).join(""));
  }

  function wireFacades() {
    document.querySelectorAll("[data-load-embed]").forEach((buttonNode) => {
      buttonNode.addEventListener("click", () => {
        const card = buttonNode.closest("[data-embed-src]");
        const src = card.getAttribute("data-embed-src");
        const title = card.getAttribute("data-embed-title") || "Embed";
        if (!src) return;
        card.innerHTML = `<iframe class="embed-frame" src="${esc(src)}" title="${esc(title)}" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
      });
    });
  }

  async function renderLatestVideos(cfg) {
    if (!cfg.features.latest_videos) {
      hide("[data-latest-videos]");
      return;
    }
    if (!cfg.channels.youtube_channel_id) {
      mount("[data-latest-videos]", `<article class="card empty-state"><h2>${esc(text("Videos are on the way."))}</h2><p>${esc(text("This grid fills automatically from the channel."))}</p></article>`);
      return;
    }
    const videos = await youtubeLatest(cfg.channels.youtube_channel_id);
    mount("[data-latest-videos]", videos.length ? videos.map((video) => `
      <article class="feature-card">
        <img class="video-thumb" loading="lazy" alt="" src="${esc(video.thumb || ("https://i.ytimg.com/vi/" + video.videoId + "/hqdefault.jpg"))}">
        <h2>${esc(video.title)}</h2>
        ${button(video.url, text("Watch on YouTube"), "primary")}
      </article>
    `).join("") : `<article class="card empty-state"><h2>${esc(text("Videos couldn’t be loaded right now."))}</h2><p>${esc(text("The channel is live , this grid just couldn’t reach it. Try again shortly."))}</p>${button("https://www.youtube.com/channel/" + cfg.channels.youtube_channel_id, text("Open the channel"), "primary")}</article>`);
  }

  async function renderHome() {
    // ⛔ The home grid used to build itself from config.channels, a hand-kept list that
    //   was never filled in: it showed 9 destinations while the links page showed 13, and the
    //   two disagreed about which. Both now read data/platforms.json, so they cannot drift.
    const [cfg, site, platforms] = await Promise.all([config(), data("site"), data("platforms")]);
    mount("[data-home-bio]", esc(text(site.bio.en, site.bio.fa)));
    mount("[data-home-topics]", (site.topics || []).map((topic) => `<span class="pill">${esc(topic)}</span>`).join(""));
    mount("[data-home-channels]", platformCards(platforms, cfg) + podcastCards(platforms));
    await Promise.allSettled([
      renderLiveBadge(cfg, site),
      renderLatestVideos(cfg)
    ]);
  }

  async function renderLive() {
    const [cfg, site, platforms] = await Promise.all([config(), data("site"), data("platforms")]);
    mount("[data-live-channels]", platformCards(platforms, cfg));
    mount("[data-live-rules]", (platforms.rules || []).map((item) => `<li>${esc(item)}</li>`).join(""));
    renderFacades(cfg);
    wireFacades();
    await Promise.allSettled([
      renderLiveBadge(cfg, site),
      renderLatestVideos(cfg),
      renderDiscord(cfg)
    ]);
  }

  async function renderDiscord(cfg) {
    if (!document.querySelector("[data-discord-widget]")) return;
    if (!cfg.features.discord || !cfg.channels.discord_invite) {
      mount("[data-discord-widget]", `<article class="card empty-state"><h2>${esc(text("Discord coming soon."))}</h2><p>${esc(text("A community invite will appear here."))}</p></article>`);
      return;
    }
    let online = "";
    if (cfg.channels.discord_server_id) {
      try {
        const res = await fetchWithTimeout(`https://discord.com/api/guilds/${encodeURIComponent(cfg.channels.discord_server_id)}/widget.json`, { cache: "no-store" });
        if (res.ok) {
          const payload = await res.json();
          if (typeof payload.presence_count === "number") online = `<p>${esc(payload.presence_count)} ${esc(text("online now"))}</p>`;
        }
      } catch (_) {}
    }
    mount("[data-discord-widget]", `<article class="card"><span class="pill">Discord</span><h2>${esc(text("Join the Discord"))}</h2>${online}${button(cfg.channels.discord_invite, text("Join Discord"), "primary")}</article>`);
  }

  // A real newline, built from its code point. Written this way on purpose: the previous
  // version used a backslash-n inside a generated string and the escape collapsed into an
  // ACTUAL line break, splitting the JS literal in half and breaking the file.
  const NL = String.fromCharCode(10);

  async function renderSchedule() {
    const [cfg, schedule] = await Promise.all([config(), data("schedule")]);
    if (!cfg.features.schedule) {
      hide("[data-schedule-list], [data-ics-link]");
      return;
    }
    const items = schedule.upcoming || [];

    // ⭐ A STANDING WEEKLY WINDOW IS NOT A LIST OF EVENTS. the creator streams daily in a fixed slot,
    //   so rendering seven identical one-off rows would be both noisy and wrong the moment a week
    //   passes. It renders as one band, and exports as ONE VEVENT with RRULE:FREQ=DAILY.
    //   ⛔ The old .ics path emitted DTSTART:${item.utc || ""} , an EMPTY DTSTART, which is an
    //   invalid calendar entry. Seven dateless rows would have shipped a broken download.
    const rec = schedule.recurring;
    if (rec && rec.enabled) {
      mount("[data-schedule-list]",
        `<article class="schedule-card"><div class="time-block"><strong>${esc(rec.days)}</strong>` +
        `<span>${esc(rec.label)}</span><span>${esc(schedule.timezone)}</span></div>` +
        `<div><h2>${esc(rec.title)}</h2><p>${esc(rec.description || "")}</p></div></article>` +
        items.map((item) => `<article class="schedule-card"><div class="time-block"><strong>${esc(item.date)}</strong><span>${esc(item.time || schedule.timezone)}</span></div><div><h2>${esc(item.title)}</h2><p>${esc(item.description || "")}</p></div></article>`).join(""));
      const dtstart = rec.start_local.replace(":", "") + "00";
      const dtend = rec.end_local.replace(":", "") + "00";
      const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Sami Mirash//Schedule//EN",
        "BEGIN:VEVENT", `SUMMARY:${rec.title}`, `DESCRIPTION:${rec.description || ""}`,
        `DTSTART;TZID=${schedule.timezone}:20260101T${dtstart}`,
        `DTEND;TZID=${schedule.timezone}:20260101T${dtend}`,
        "RRULE:FREQ=DAILY", "END:VEVENT", "END:VCALENDAR"].join(NL);
      mount("[data-ics-link]", `<a class="button" download="SamiMirash-schedule.ics" href="data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}">${esc(text("Download .ics"))}</a>`);
      return;
    }

    if (!items.length) {
      mount("[data-schedule-list]", `<article class="schedule-standby"><span class="pill">${esc(schedule.timezone)}</span><h2>${esc(schedule.empty.title)}</h2><p>${esc(schedule.empty.body)}</p>${button("newsletter.html", text("Notify me"), "primary")}</article>`);
      mount("[data-ics-link]", "");
      return;
    }
    mount("[data-schedule-list]", items.map((item) => `<article class="schedule-card"><div class="time-block"><strong>${esc(item.date)}</strong><span>${esc(item.time || schedule.timezone)}</span></div><div><h2>${esc(item.title)}</h2><p>${esc(item.description || "")}</p></div></article>`).join(""));
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Sami Mirash//Schedule//EN"].concat(items.map((item) => `BEGIN:VEVENT\nSUMMARY:${item.title}\nDESCRIPTION:${item.description || ""}\nDTSTART:${item.utc || ""}\nEND:VEVENT`)).concat(["END:VCALENDAR"]).join("\n");
    mount("[data-ics-link]", `<a class="button" download="SamiMirash-schedule.ics" href="data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}">${esc(text("Download .ics"))}</a>`);
  }

  // ---- Per-stream archive hub (idea: each day's stream = one entry) ----------
  // Renders, per stream: the full ARTICLE inline (in site style) + ALL links to
  // everything posted that day (every video on every platform, every post, every
  // article). A link renders as a live button ONLY when url is set AND pending is
  // not true; anything still pending (even with a stored private url) shows a
  // "Coming soon" pill so public visitors never hit a dead/private link. Set
  // pending:false to activate instantly. NOTE: the
  // no-cross-platform-links rule is about VIDEO DESCRIPTIONS on each platform --
  // Sami's OWN website archive is meant to link every platform he is on.
  function streamLinkChip(item, kindLabel) {
    const label = [item.platform, item.role || item.type || kindLabel].filter(Boolean).join(" - ");
    // Active button ONLY when there is a url AND it is no longer pending. A url
    // may be stored while pending:true (e.g. a private/unlisted YouTube video) --
    // in that case we keep the url but render a non-clickable "Coming soon" pill
    // so public visitors never hit a dead/private link. Flip pending:false to
    // instantly activate the stored url; no other change needed.
    if (item.url && item.pending !== true) {
      return `<a class="button" href="${esc(item.url)}"${/^https?:\/\//i.test(item.url) ? ' rel="noopener noreferrer"' : ""}>${esc(label)}</a>`;
    }
    // ⛔ Nothing renders for a link that does not exist (2026-08-23). This used to emit a
    //   "Coming soon" / "Not posted" pill, so a stream published two months earlier showed a
    //   wall of ~25 of them and read as though nothing had ever shipped.
    return "";
  }

  function streamLinkGroup(title, items, kindLabel) {
    if (!Array.isArray(items) || !items.length) return "";
    const chips = items.map((item) => streamLinkChip(item, kindLabel)).join("");
    return `<div class="stream-links-group"><p class="eyebrow">${esc(text(title))}</p><div class="pill-row">${chips}</div></div>`;
  }

  function streamCard(stream) {
    const art = stream.article || {};
    const bodyParas = Array.isArray(art.paragraphs) ? art.paragraphs : [];
    const meta = [
      stream.date_label || stream.date ? `<span class="pill">${esc(stream.date_label || stream.date)}</span>` : "",
      stream.game ? `<span class="pill">${esc(stream.game)}</span>` : ""
    ].filter(Boolean).join("");
    const articleBlock = bodyParas.length
      ? `<article class="article-card">`
        + `<div class="pill-row">${meta}</div>`
        + (art.title ? `<h3>${esc(art.title)}</h3>` : "")
        + `<div class="article-body">${bodyParas.map((p) => `<p>${esc(p)}</p>`).join("")}</div>`
        + `</article>`
      : "";
    const links = [
      streamLinkGroup("Videos", stream.videos, text("Video")),
      streamLinkGroup("Posts & announcements", stream.posts, text("Post")),
      streamLinkGroup("Articles", stream.articles, text("Article"))
    ].filter(Boolean).join("");
    const linksBlock = links ? `<div class="stream-links">${links}</div>` : "";
    const anchor = stream.date ? ` id="stream-${esc(stream.date)}"` : "";
    return `<section class="stream-entry"${anchor}>`
      + `<div class="section-head"><div><p class="eyebrow">${esc(stream.date_label || stream.date || text("Stream"))}</p>`
      + `<h2>${esc(stream.title || stream.game || text("Stream"))}</h2>`
      + (stream.summary ? `<p class="lede">${esc(stream.summary)}</p>` : "")
      + `</div></div>`
      + articleBlock
      + linksBlock
      + `</section>`;
  }

  async function renderArchive() {
    const [cfg, archive, clips] = await Promise.all([config(), data("archive"), data("clips")]);
    mount("[data-topic-filter]", (archive.topics || []).map((topic) => `<button class="pill filter-button" type="button" data-topic="${esc(topic)}">${esc(topic)}</button>`).join(""));
    const streams = Array.isArray(archive.streams) ? archive.streams : [];
    mount("[data-stream-archive]", streams.length
      ? streams.map(streamCard).join("")
      : `<article class="card empty-state"><h2>${esc(text("No streams archived yet."))}</h2><p>${esc(text("Each stream's recap and links will appear here."))}</p></article>`);
    const episodes = cfg.features.vod_archive ? (archive.episodes || []) : [];
    mount("[data-vod-archive]", episodes.length ? episodes.map((item) => `<article class="feature-card"><span class="pill">${esc(item.platform)}</span><h2>${esc(item.title)}</h2><p>${esc(item.date || "")}</p></article>`).join("") : `<article class="card empty-state"><h2>${esc(text("No VODs yet."))}</h2><p>${esc(text("The archive is ready for the first real stream."))}</p></article>`);
    if (clips.intro) mount("[data-clips-intro]", esc(clips.intro));

    // ---- Per-VIDEO archive (2026-08-23) --------------------------------------
    // ⭐ ONE ENTRY PER VIDEO, NOT PER PLATFORM. The creator: "since every video is uploaded
    //   everywhere you just [need] one entry per video ... you provide the links to all of
    //   the platforms that it has been uploaded to, the exact link to that exact video."
    //   The Clips gallery it replaces is gone from the nav too - he does not make clips.
    // ⛔ A platform with no url renders as a NON-CLICKABLE pill, never a dead button. The
    //   same rule as streamLinkChip: a visitor must never land on a missing page, and a
    //   platform we have not published to yet should be visibly absent rather than silently
    //   missing from the row.
    // ⚠️ NOTE ON THE LINKS RULE: no-cross-platform-links governs VIDEO DESCRIPTIONS on each
    //   platform. Sami's OWN site is the hub that is meant to list every platform he is on.
    const videos = archive.videos || [];
    mount("[data-video-archive]", videos.length ? videos.map((v) => {
      // ⛔ NO PLACEHOLDERS ANYWHERE. the creator, 2026-08-23: "we don't want any placeholders,
      //   remove all placeholder things." A platform we have not published to simply does not
      //   appear - an absent row is honest, a "Coming soon" row is a promise.
      const live = (v.links || []).filter((l) => l.url && l.pending !== true);
      const chips = live.map((l) =>
        `<a class="button" href="${esc(l.url)}" rel="noopener noreferrer">${esc(l.platform)}</a>`).join("");
      const meta = [v.kind, v.duration, v.date_label].filter(Boolean).join(" \u00b7 ");
      return `<article class="feature-card">`
        + `<p class="eyebrow">${esc(meta)}</p>`
        + `<h2>${esc(v.title)}</h2>`
        + (v.description ? `<p>${esc(v.description)}</p>` : "")
        + `<div class="hero-actions">${chips}</div>`
        + `</article>`;
    }).join("") : `<article class="card empty-state"><h2>${esc(text("No videos published yet."))}</h2><p>${esc(text("Every video will appear here once, with links to every platform it went to."))}</p></article>`);
  }

  // Gaming News & Rumors (combines the old News idea #252 + Rumors idea #251 into
  // ONE feed). Every entry is paraphrased in Sami's own words -- no quotes, no copied
  // source text, no source links. Primary data file is data/gaming_news.json; for
  // backward compatibility this also merges any legacy data/news.json + data/rumors.json
  // so older hand-written items are never lost. Unified schema per item:
  //   { title, summary, type:"news"|"rumor", date, source?, game?, probability? }
  // News entries render as a paraphrased rundown; rumor entries add a 0-100
  // probability bar (how likely the rumor is true). Reuses the existing
  // .article-card style + the rumor odds-bar pattern so no new CSS is needed.

  // Probability bar built from existing theme variables (no extra CSS needed). 0..100.
  function rumorOddsBar(probability) {
    const pct = Math.max(0, Math.min(100, Math.round(Number(probability) || 0)));
    return `<div class="rumor-odds" role="img" aria-label="${pct}% likely to be true">`
      + `<div class="pill-row"><span class="pill">${pct}% likely true</span></div>`
      + `<div style="position:relative;height:10px;border-radius:999px;overflow:hidden;border:1px solid var(--line);background:color-mix(in srgb, var(--surface-2) 72%, transparent);margin-top:8px">`
      + `<span style="position:absolute;inset:0 ${100 - pct}% 0 0;background:linear-gradient(90deg, var(--accent), var(--accent-2));border-radius:999px"></span>`
      + `</div></div>`;
  }

  function gamingNewsCard(item) {
    const isRumor = String(item.type || "").toLowerCase() === "rumor";
    const kindPill = `<span class="pill">${esc(isRumor ? text("Rumor") : text("News"))}</span>`;
    const meta = [
      kindPill,
      item.game ? `<span class="pill">${esc(item.game)}</span>` : "",
      item.source ? `<span class="pill">${esc(item.source)}</span>` : "",
      item.date ? `<span class="pill">${esc(item.date)}</span>` : ""
    ].filter(Boolean).join("");
    const bar = isRumor ? rumorOddsBar(item.probability) : "";
    return `<article class="article-card">`
      + `<div class="pill-row">${meta}</div>`
      + `<h2>${esc(item.title)}</h2>`
      + `<div class="article-body"><p>${esc(item.summary)}</p></div>`
      + bar
      + `</article>`;
  }

  // Normalize the legacy schemas into the unified one so old data still shows.
  function normalizeLegacyNews(items) {
    return (Array.isArray(items) ? items : [])
      .filter((it) => it && it.title)
      .map((it) => ({ title: it.title, summary: it.summary || it.body || "", type: "news", date: it.date, source: it.source, game: it.game }));
  }
  function normalizeLegacyRumors(items) {
    return (Array.isArray(items) ? items : [])
      .filter((it) => it && (it.rumor || it.title))
      .map((it) => ({ title: it.title || it.rumor, summary: it.summary || it.rumor || "", type: "rumor", probability: it.probability, date: it.date, source: it.source, game: it.game }));
  }

  async function renderGamingNews() {
    const cfg = await config();
    // Hidden only if BOTH news and rumors are explicitly turned off.
    if (cfg.features.news === false && cfg.features.rumors === false) {
      hide("[data-news-list], [data-rumor-list], [data-gaming-news-list]");
      return;
    }
    // Primary source first; fall back to merging the legacy split files.
    let items = [];
    try {
      const gn = await data("gaming_news");
      items = (gn.items || []).filter((it) => it && it.title);
    } catch (_) { /* fall through to legacy merge */ }
    if (!items.length) {
      const [news, rumors] = await Promise.all([
        data("news").catch(() => ({})),
        data("rumors").catch(() => ({}))
      ]);
      items = normalizeLegacyNews(news.items).concat(normalizeLegacyRumors(rumors.items));
    }
    // Respect per-type feature flags within the combined feed.
    if (cfg.features.news === false) items = items.filter((it) => String(it.type).toLowerCase() === "rumor");
    if (cfg.features.rumors === false) items = items.filter((it) => String(it.type).toLowerCase() !== "rumor");

    const target = "[data-gaming-news-list], [data-news-list], [data-rumor-list]";
    if (!items.length) {
      mount(target, `<article class="card empty-state"><h2>${esc(text("No gaming news or rumors yet."))}</h2><p>${esc(text("Short, paraphrased game-news rundowns and rumors (each rumor with an honest probability of being true) will appear here once there is real material to write up."))}</p></article>`);
      return;
    }
    mount(target, items.map(gamingNewsCard).join(""));
  }

  // Opinions / "My Take" page. Sami's personal opinion posts, written by hand in
  // data/opinions.json. Schema per item: { slug, title, date?, topic?, body }.
  // `body` is a string OR an array of strings (one <p> per item). Reuses the
  // existing .article-card style. Gated by features.opinions (default on; an
  // explicit false hides it). All text is esc()'d -- no raw HTML from data.
  async function renderOpinions() {
    const [cfg, opinions] = await Promise.all([config(), data("opinions")]);
    if (cfg.features.opinions === false) {
      hide("[data-opinion-list]");
      return;
    }
    if (opinions.intro) mount("[data-opinions-intro]", esc(opinions.intro));
    const items = (opinions.items || []).filter((item) => item && item.title);
    if (!items.length) {
      mount("[data-opinion-list]", `<article class="card empty-state"><h2>${esc(text("No opinions posted yet."))}</h2><p>${esc(text("Sami's personal takes will show up here."))}</p></article>`);
      return;
    }
    mount("[data-opinion-list]", items.map((item) => {
      const bodyText = item.body;
      const paras = Array.isArray(bodyText) ? bodyText : [bodyText];
      const paraHtml = paras
        .filter((p) => String(p ?? "").trim().length)
        .map((p) => `<p>${esc(p)}</p>`)
        .join("");
      const meta = [
        item.topic ? `<span class="pill">${esc(item.topic)}</span>` : "",
        item.date ? `<span class="pill">${esc(item.date)}</span>` : ""
      ].join("");
      // Optional lead image. `item.image` is a path under the site root
      // (e.g. "assets/articles/foo.jpg"). `item.imageAlt`/`item.caption` optional.
      const imgSrc = String(item.image ?? "").trim();
      const figureHtml = imgSrc
        ? `<figure class="article-figure">`
          + `<img class="article-image" loading="lazy" alt="${esc(item.imageAlt || item.title || "")}" src="${esc(imgSrc)}">`
          + (item.caption ? `<figcaption>${esc(item.caption)}</figcaption>` : "")
          + `</figure>`
        : "";
      return `<article class="article-card" id="${esc(item.slug || "")}">`
        + (meta ? `<div class="pill-row">${meta}</div>` : "")
        + `<h2>${esc(item.title)}</h2>`
        + figureHtml
        + `<div class="article-body">${paraHtml}</div>`
        // Optional link out to a full write-up living at its own URL. Long pieces with
        // tables and figures cannot live in `body`, which is escaped plain text.
        + (item.link
            ? `<p class="article-more"><a class="button primary" href="${esc(item.link)}">`
              + `${esc(item.linkLabel || "Read the full write-up")}</a></p>`
            : "")
        + `</article>`;
    }).join(""));
  }

  // Leaderboard page (go-live req #7). Two boards, both data-driven from
  // data/leaderboard.json (written by leaderboard_publish.py in the main repo --
  // NOT hand-edited). Board 1 ranks Sami's PLATFORMS by follower count ("followers
  // across all platforms"); board 2 is a thank-you board for top supporters plus a
  // running total raised. Privacy: an individual supporter is shown only when a
  // public-safe display name was captured; anonymous tips still add to the total but
  // are never named. Empty arrays render honest "coming soon" states -- nothing fake.
  // Reuses existing theme classes (.metric-card, .feature-card, .pill, the rumor
  // odds-bar pattern), so no new CSS is needed.
  function fmtCount(n) {
    const v = Number(n);
    if (!Number.isFinite(v) || v < 0) return ", ";
    if (v >= 1000000) return (v / 1000000).toFixed(v % 1000000 === 0 ? 0 : 1) + "M";
    if (v >= 1000) return (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + "K";
    return String(Math.round(v));
  }

  function fmtMoney(n, currency) {
    const v = Number(n);
    if (!Number.isFinite(v) || v <= 0) return "";
    const cur = String(currency || "CAD").toUpperCase();
    return `$${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${cur}`;
  }

  // Horizontal proportion bar, same construction as the rumors odds-bar so it
  // inherits the theme accent gradient with zero extra CSS. `pct` is 0..100.
  function proportionBar(pct, ariaLabel) {
    const p = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
    return `<div role="img" aria-label="${esc(ariaLabel || (p + "%"))}" `
      + `style="position:relative;height:10px;border-radius:999px;overflow:hidden;border:1px solid var(--line);`
      + `background:color-mix(in srgb, var(--surface-2) 72%, transparent);margin-top:10px">`
      + `<span style="position:absolute;inset:0 ${100 - p}% 0 0;background:linear-gradient(90deg, var(--accent), var(--accent-2));border-radius:999px"></span>`
      + `</div>`;
  }

  async function renderLeaderboard() {
    const cfg = await config();
    if (cfg.features.leaderboard === false) {
      hide("[data-leaderboard-followers], [data-leaderboard-totals], [data-leaderboard-supporters]");
      return;
    }
    let board;
    try {
      board = await data("leaderboard");
    } catch (_) {
      board = {};
    }
    const currency = board.currency || "CAD";

    // --- Board 1: followers by platform ----------------------------------
    const platforms = (Array.isArray(board.platform_followers) ? board.platform_followers : [])
      .filter((p) => p && p.name && Number.isFinite(Number(p.followers)) && Number(p.followers) >= 0)
      .sort((a, b) => Number(b.followers) - Number(a.followers));
    if (!platforms.length) {
      mount("[data-leaderboard-followers]", `<article class="card empty-state"><h2>${esc(text("Follower counts coming soon."))}</h2><p>${esc(text("Once the channels are public and the numbers are pulled in, each platform will rank here by follower count."))}</p></article>`);
    } else {
      const max = Math.max(...platforms.map((p) => Number(p.followers)), 1);
      mount("[data-leaderboard-followers]", platforms.map((p, i) => {
        const count = Number(p.followers);
        const pct = (count / max) * 100;
        const url = p.url ? esc(p.url) : "";
        const rank = `<span class="pill">#${i + 1}</span>`;
        const kind = p.kind ? `<span class="pill">${esc(p.kind)}</span>` : "";
        const open = url ? button(p.url, text(`Open ${p.name}`), i === 0 ? "primary" : "") : "";
        return `<article class="metric-card">`
          + `<div class="pill-row">${rank}${kind}</div>`
          + `<h2>${esc(p.name)}</h2>`
          + `<strong>${esc(fmtCount(count))} ${esc(text("followers"))}</strong>`
          + proportionBar(pct, `${p.name}: ${count} followers`)
          + (open ? `<div style="margin-top:14px">${open}</div>` : "")
          + `</article>`;
      }).join(""));
    }

    // --- Board 2: follower roll (every follower gets a permanent number) ---
    // follower_roll.total = how many ever; follower_roll.recent = the most-recent
    // followers, each with its forever number (#1 = the very first follower).
    const roll = board.follower_roll || {};
    const rollTotal = Number(roll.total) || 0;
    const rollRecent = (Array.isArray(roll.recent) ? roll.recent : [])
      .filter((f) => f && f.name && Number.isFinite(Number(f.number)))
      .sort((a, b) => Number(b.number) - Number(a.number));   // newest number first
    if (rollTotal > 0) {
      mount("[data-leaderboard-followerroll-total]",
        `<div class="grid two" style="margin-bottom:18px"><article class="metric-card">`
        + `<span class="pill">${esc(text("Followers, all time"))}</span>`
        + `<strong>${esc(fmtCount(rollTotal))}</strong>`
        + `<p>${esc(roll.note || text("Every follower gets a permanent number , #1 is the very first follower, ever."))}</p>`
        + `</article></div>`);
    } else {
      mount("[data-leaderboard-followerroll-total]", "");
    }
    if (!rollRecent.length) {
      mount("[data-leaderboard-followerroll]", `<article class="card empty-state"><h2>${esc(text("The follower roll starts soon."))}</h2><p>${esc(text("Once the channel is live, every new follower gets a permanent number here , the very first follower is #1."))}</p></article>`);
    } else {
      mount("[data-leaderboard-followerroll]", rollRecent.map((f) => {
        const when = [f.date, f.time].filter(Boolean).join(" ");
        const meta = [
          `<span class="pill">#${esc(String(f.number))}</span>`,
          f.platform ? `<span class="pill">${esc(f.platform)}</span>` : "",
          when ? `<span class="pill">${esc(when)}</span>` : ""
        ].filter(Boolean).join("");
        return `<article class="article-card"><div class="pill-row">${meta}</div><h2>${esc(f.name)}</h2></article>`;
      }).join(""));
    }

    // --- Board 3: total raised + top supporters --------------------------
    const totals = board.totals || {};
    const totalRaised = fmtMoney(totals.total_raised, currency);
    const supporterCount = Number(totals.supporter_count) || 0;
    if (totalRaised || supporterCount) {
      const bits = [];
      if (totalRaised) bits.push(`<article class="metric-card"><span class="pill">${esc(text("Raised"))}</span><strong>${esc(totalRaised)}</strong><p>${esc(totals.note || text("From confirmed donations."))}</p></article>`);
      if (supporterCount) bits.push(`<article class="metric-card"><span class="pill">${esc(text("Supporters"))}</span><strong>${esc(String(supporterCount))}</strong><p>${esc(text("People who have chipped in. Thank you."))}</p></article>`);
      mount("[data-leaderboard-totals]", `<div class="grid two" style="margin-bottom:18px">${bits.join("")}</div>`);
    } else {
      mount("[data-leaderboard-totals]", "");
    }

    const supporters = (Array.isArray(board.top_supporters) ? board.top_supporters : [])
      .filter((s) => s && s.name)
      .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0));
    if (!supporters.length) {
      mount("[data-leaderboard-supporters]", `<article class="card empty-state"><h2>${esc(text("No supporters listed yet."))}</h2><p>${esc(text("Tips are always welcome but never required. Anyone who chips in (and is happy to be named) will get a thank-you here , and every tip, named or not, means a lot."))}</p></article>`);
      return;
    }
    mount("[data-leaderboard-supporters]", supporters.map((s, i) => {
      const amount = fmtMoney(s.amount, s.currency || currency);
      const meta = [
        `<span class="pill">#${i + 1}</span>`,
        s.platform ? `<span class="pill">${esc(s.platform)}</span>` : "",
        amount ? `<span class="pill">${esc(amount)}</span>` : ""
      ].filter(Boolean).join("");
      const note = s.note ? `<div class="article-body"><p>${esc(s.note)}</p></div>` : "";
      return `<article class="article-card"><div class="pill-row">${meta}</div><h2>${esc(s.name)}</h2>${note}</article>`;
    }).join(""));
  }

  // Support page (idea: real off-platform donation routes). Three method groups:
  //  1. PayPal  -> monetization.paypal_me (handle or full paypal.me URL)
  //  2. Crypto  -> monetization.crypto[] (verbatim wallet addresses; copy + QR)
  //  3. Buy Me a Coffee -> monetization.buymeacoffee_url (HIDDEN until a real URL is set)
  //  4. Rumble Tip -> monetization.rumble_tip_url (HIDDEN until a real URL is set)
  // Everything is config-gated: a method renders only when its destination exists,
  // so visitors never see a broken/empty button.
  function paypalUrl(value) {
    if (!value) return "";
    const raw = String(value).trim();
    if (/^https?:\/\//i.test(raw)) return raw;
    return `https://paypal.me/${raw.replace(/^@/, "")}`;
  }

  // Ko-fi page URL from either a full ko-fi.com link or a bare handle.
  function kofiPage(value) {
    if (!value) return "";
    const raw = String(value).trim();
    if (/^https?:\/\//i.test(raw)) return raw;
    return `https://ko-fi.com/${raw.replace(/^@/, "")}`;
  }

  // Lightweight QR: a data-driven <img> against a public QR endpoint. Copy-to-clipboard
  // remains the reliable path; if the QR image fails to load it simply hides itself.
  function qrImg(payload, label) {
    const src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(payload)}`;
    return `<img class="tip-qr" loading="lazy" width="180" height="180" alt="${esc(label)}" src="${esc(src)}" onerror="this.style.display='none'">`;
  }

  function cryptoCard(coin) {
    const name = coin.name || coin.symbol || text("Crypto");
    const symbol = coin.symbol ? ` (${coin.symbol})` : "";
    const addr = String(coin.address || "");
    const accent = /^#[0-9a-fA-F]{3,8}$/.test(String(coin.color || "")) ? coin.color : "";
    const titleStyle = accent ? ` style="color:${esc(accent)}"` : "";
    const note = coin.note ? `<p class="tip-note">${esc(coin.note)}</p>` : "";
    return `
      <article class="feature-card tip-card">
        <span class="pill">${esc(text("Crypto"))}</span>
        <h2${titleStyle}>${esc(name)}${esc(symbol)}</h2>
        ${note}
        ${qrImg(addr, `${name} address QR`)}
        <code class="tip-address" data-tip-address>${esc(addr)}</code>
        <button class="button" type="button" data-copy="${esc(addr)}">${esc(text("Copy address"))}</button>
      </article>`;
  }

  async function renderSupport() {
    const cfg = await config();
    const mon = cfg.monetization || {};
    const cards = [];

    // 1. PayPal -------------------------------------------------------------
    // Two routes on one card:
    //  a) PayPal Buttons (JS SDK) -> in-page checkout. The same widget also
    //     surfaces card payment through PayPal's own hosted flow, so card and
    //     PayPal donations both go through PayPal (no card data ever touches
    //     this site). Rendered by renderPayPalButtons() after mount.
    //  b) The classic paypal.me link is kept as a reliable fallback (works even
    //     if the SDK is blocked) and matches the OBS overlay / QR address.
    const ppUrl = cfg.features.tip_jar ? paypalUrl(mon.paypal_me) : "";
    if (ppUrl) {
      cards.push(`
        <article class="feature-card tip-card highlight">
          <span class="pill">${esc(text("PayPal"))}</span>
          <h2>${esc(text("Tip via PayPal"))}</h2>
          <p>${esc(text("Choose an amount and pay with PayPal or any card. Card and PayPal donations are processed securely by PayPal."))}</p>
          <div class="paypal-buttons" data-paypal-buttons></div>
          <p class="tip-note">${esc(text("Card not showing? Use the direct PayPal link below."))}</p>
          ${button(ppUrl, text("Open paypal.me link"))}
        </article>`);
    }

    // 1b. Stripe (card) -----------------------------------------------------
    // Embedded Stripe Buy Button: Stripe's own hosted checkout widget, rendered
    // in-page from a PUBLIC publishable key (pk_live_) + buy-button-id. No
    // secret key and no backend are involved -- card data never touches this
    // site. The classic buy.stripe.com Payment Link is kept as a visible
    // fallback below in case the embed script is blocked / fails to load.
    // Hidden entirely until a real URL is configured (monetization.stripe_url).
    const stripeUrl = cfg.features.tip_jar ? String(mon.stripe_url || "").trim() : "";
    if (stripeUrl) {
      cards.push(`
        <article class="feature-card tip-card">
          <span class="pill">${esc(text("Card (Stripe)"))}</span>
          <h2>${esc(text("Donate by Card (Stripe)"))}</h2>
          <p>${esc(text("Pay with any debit or credit card. Securely processed by Stripe."))}</p>
          <div class="stripe-buy" data-stripe-buy>
            <stripe-buy-button
              buy-button-id="${STRIPE_BUY_BUTTON_ID}"
              publishable-key="${STRIPE_PUBLISHABLE_KEY}">
            </stripe-buy-button>
          </div>
          <p class="tip-note">${esc(text("Button not loading? Use the direct Stripe link below."))}</p>
          <a class="button" href="${esc(stripeUrl)}" target="_blank" rel="noopener noreferrer">${esc(text("Open Stripe checkout link"))}</a>
        </article>`);
    }

    // 2. Crypto -------------------------------------------------------------
    const coins = (cfg.features.tip_jar && Array.isArray(mon.crypto) ? mon.crypto : [])
      .filter((coin) => coin && coin.address);
    coins.forEach((coin) => cards.push(cryptoCard(coin)));

    // 3. Buy Me a Coffee (hidden until a real URL is configured) -------------
    const bmcUrl = cfg.features.tip_jar ? String(mon.buymeacoffee_url || "").trim() : "";
    if (bmcUrl) {
      cards.push(`
        <article class="feature-card tip-card">
          <span class="pill">${esc(text("Buy Me a Coffee"))}</span>
          <h2>${esc(text("Buy Me a Coffee"))}</h2>
          <p>${esc(text("Buy a quick coffee. Opens in a new tab."))}</p>
          ${button(bmcUrl, text("Buy a coffee"), "primary")}
        </article>`);
    }

    // 3b. Ko-fi (hidden until a real handle/URL is configured) --------------
    // monetization.kofi may be a bare handle ("samimirash") or a full ko-fi.com
    // URL; normalize either to the hosted Ko-fi page. Opens in a new tab.
    const kofiUrl = cfg.features.tip_jar ? kofiPage(mon.kofi) : "";
    if (kofiUrl) {
      cards.push(`
        <article class="feature-card tip-card">
          <span class="pill">${esc(text("Ko-fi"))}</span>
          <h2>${esc(text("Tip on Ko-fi"))}</h2>
          <p>${esc(text("Support with a one-off tip on Ko-fi. Opens in a new tab."))}</p>
          ${button(kofiUrl, text("Tip on Ko-fi"), "primary")}
        </article>`);
    }

    // 4. Rumble Tip (hidden until a real URL is configured) -----------------
    const rumbleUrl = cfg.features.tip_jar ? String(mon.rumble_tip_url || "").trim() : "";
    if (rumbleUrl) {
      cards.push(`
        <article class="feature-card tip-card">
          <span class="pill">${esc(text("Rumble Tip"))}</span>
          <h2>${esc(text("Rumble Tip"))}</h2>
          <p>${esc(text("Tip via Rumble. Opens in a new tab."))}</p>
          ${button(rumbleUrl, text("Tip on Rumble"), "primary")}
        </article>`);
    }

    // 5. Gift a Game (Steam) ------------------------------------------------
    // A non-money gift avenue: send a game instead of a tip. Two routes on one
    // card -- (a) the EASY path: a Steam gift card / wallet code mailed to the
    // contact email lands instantly, no friending required; (b) the DIRECT
    // path: add me on Steam (profile link OR permanent friend code 721718408),
    // then gift any title from my wishlist. Fixed Steam details, so this card is
    // shown whenever the tip jar is on (no config URL needed). Steam requires a
    // ~3-day friendship before a direct gift can be sent (anti-fraud), which is
    // why the gift-card-to-email route is the instant option.
    if (cfg.features.tip_jar) {
      const steamProfile = "https://steamcommunity.com/id/SamiMirash";
      const steamWishlist = "https://steamcommunity.com/id/SamiMirash/wishlist";
      const steamFriendCode = "721718408";
      const steamGiftEmail = "contact@samimirash.com";
      cards.push(`
        <article class="feature-card tip-card">
          <span class="pill">${esc(text("Steam"))}</span>
          <h2>${esc(text("Gift a Game (Steam)"))}</h2>
          <p>${esc(text("Tips are always welcome , or, if you'd rather, gift me a game on Steam. Both mean a lot."))}</p>
          <p class="tip-note">${esc(text("Easiest: send a Steam gift card / wallet code to"))} <strong>${esc(steamGiftEmail)}</strong> ${esc(text(", it arrives instantly, no friend request needed."))}</p>
          <p class="tip-note">${esc(text("Or gift directly: add me on Steam (use the profile link below, or friend code"))} <strong>${esc(steamFriendCode)}</strong>${esc(text("), then send any title from my wishlist. Direct gifting needs a Steam friendship for about 3 days first, so the gift card above is the instant option."))}</p>
          ${button(steamProfile, text("Add me on Steam"), "primary")}
          ${button(steamWishlist, text("See my wishlist"))}
        </article>`);
    }

    if (!cards.length) {
      mount("[data-support-links]", `<article class="card empty-state"><h2>${esc(text("Tips are not set up yet."))}</h2><p>${esc(text("Support routes appear here once real destinations are configured. No payment is built into this static site."))}</p></article>`);
      return;
    }

    mount("[data-support-links]", cards.join(""));
    wireCopyButtons();
    renderPayPalButtons();
    loadStripeBuyButton();
  }

  // ---------------------------------------------------------------------------
  // PayPal Buttons (JS SDK, client-side only).
  //
  // PAYPAL_CLIENT_ID below is the LIVE *Client ID*. It is PUBLIC by design and
  // safe to ship in frontend code -- it is NOT the secret. The PayPal Secret is
  // never used here and must never be placed in this repo / any frontend file.
  //
  // This site is static (GitHub Pages, no backend), so the order is created and
  // captured client-side via actions.order.create / actions.order.capture. The
  // donor enters any amount in CAD; the Buttons widget also offers card payment
  // through PayPal's hosted card fields, so card + PayPal both run through
  // PayPal. The classic paypal.me link on the same card is the fallback.
  // ---------------------------------------------------------------------------
  const PAYPAL_CLIENT_ID = "AdBMaMBc9jSMj48GG_rfQJiFUnHHwT_V-ROQFctgq5Tbhu5Q87_zRqMfKTsz9BK_xnNlT4KsBduNJ6Ot";
  const PAYPAL_CURRENCY = "CAD";
  let paypalSdkPromise = null;

  function loadPayPalSdk() {
    if (window.paypal) return Promise.resolve(window.paypal);
    if (paypalSdkPromise) return paypalSdkPromise;
    paypalSdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      const params = new URLSearchParams({
        "client-id": PAYPAL_CLIENT_ID,
        currency: PAYPAL_CURRENCY,
        intent: "capture",
        components: "buttons",
        "enable-funding": "card"
      });
      script.src = `https://www.paypal.com/sdk/js?${params.toString()}`;
      script.async = true;
      script.onload = () => (window.paypal ? resolve(window.paypal) : reject(new Error("PayPal SDK loaded but window.paypal missing")));
      script.onerror = () => reject(new Error("PayPal SDK failed to load"));
      document.head.appendChild(script);
    });
    return paypalSdkPromise;
  }

  // Donor picks the amount: prompt for a CAD value, validate, then build the
  // order. Returns a positive amount string with 2 decimals, or null to cancel.
  function askDonationAmount() {
    const raw = window.prompt(text("Donation amount in CAD (for example 10):"), "10");
    if (raw === null) return null; // user cancelled
    const value = Number(String(raw).replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(value) || value <= 0) {
      window.alert(text("Please enter a valid amount greater than 0."));
      return null;
    }
    return value.toFixed(2);
  }

  function renderPayPalButtons() {
    const host = document.querySelector("[data-paypal-buttons]");
    if (!host || host.dataset.ppRendered) return;
    host.dataset.ppRendered = "1";
    loadPayPalSdk().then((paypal) => {
      paypal.Buttons({
        style: { layout: "vertical", shape: "pill", label: "paypal" },
        createOrder: (data, actions) => {
          const amount = askDonationAmount();
          if (!amount) return Promise.reject(new Error("cancelled"));
          return actions.order.create({
            intent: "CAPTURE",
            purchase_units: [{
              amount: { currency_code: PAYPAL_CURRENCY, value: amount },
              description: "Tip for Samimirash"
            }]
          });
        },
        onApprove: (data, actions) => actions.order.capture().then((details) => {
          const name = details && details.payer && details.payer.name ? details.payer.name.given_name : "";
          host.innerHTML = `<p class="tip-note">${esc(text(`Thank you${name ? `, ${name}` : ""}! Your donation went through. A PayPal receipt is on its way.`))}</p>`;
        }),
        onError: (err) => {
          console.error("PayPal error", err);
          host.innerHTML = `<p class="tip-note">${esc(text("PayPal could not complete that. Please try the paypal.me link below."))}</p>`;
        }
      }).render(host).catch((err) => console.error("PayPal render failed", err));
    }).catch((err) => {
      console.error(err);
      // Leave the paypal.me fallback button visible; just note the SDK failure.
      host.innerHTML = `<p class="tip-note">${esc(text("PayPal checkout is unavailable right now. Use the paypal.me link below."))}</p>`;
    });
  }

  // ---------------------------------------------------------------------------
  // Stripe Buy Button (embedded, client-side only).
  //
  // STRIPE_PUBLISHABLE_KEY below is the LIVE *publishable* key (pk_live_). Like
  // the PayPal Client ID, it is PUBLIC by design and safe to ship in frontend
  // code -- it is NOT the Stripe secret key. The widget is rendered by Stripe's
  // hosted buy-button.js script; card data never touches this site. The classic
  // buy.stripe.com Payment Link on the same card is the visible fallback if this
  // script is blocked / fails to load.
  // ---------------------------------------------------------------------------
  const STRIPE_PUBLISHABLE_KEY = "pk_live_51TkqRkJojIFeFYUAxpsh0uqut081Ib4aAYCA5o1RJlTp0wBhjGGiTZcq2KJbR3FKtjS5H8AjK2bCiUcUVvMGWDgr00sOvDyn07";
  const STRIPE_BUY_BUTTON_ID = "buy_btn_1TlEBsJojIFeFYUAU1C8Ddoz";
  let stripeBuyButtonLoaded = false;

  // Inject Stripe's buy-button.js exactly once. The <stripe-buy-button> custom
  // element is already in the DOM (rendered by renderSupport); this script
  // upgrades it. If the script never loads, the element stays empty and the
  // fallback buy.stripe.com link below it remains visible/usable.
  function loadStripeBuyButton() {
    if (stripeBuyButtonLoaded) return;
    if (!document.querySelector("[data-stripe-buy]")) return; // nothing to upgrade
    stripeBuyButtonLoaded = true;
    const script = document.createElement("script");
    script.src = "https://js.stripe.com/v3/buy-button.js";
    script.async = true;
    script.onerror = () => console.error("Stripe buy-button.js failed to load");
    document.head.appendChild(script);
  }

  // Copy-to-clipboard for crypto addresses. Uses the async Clipboard API where
  // available and falls back to a hidden textarea + execCommand for older/non-secure
  // contexts so the button always works. Briefly flips the label to confirm.
  function wireCopyButtons() {
    document.querySelectorAll("[data-copy]").forEach((btn) => {
      if (btn.dataset.copyWired) return;
      btn.dataset.copyWired = "1";
      const original = btn.textContent;
      btn.addEventListener("click", async () => {
        const value = btn.getAttribute("data-copy") || "";
        let ok = false;
        try {
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(value);
            ok = true;
          } else {
            throw new Error("clipboard unavailable");
          }
        } catch (_) {
          try {
            const ta = document.createElement("textarea");
            ta.value = value;
            ta.setAttribute("readonly", "");
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.select();
            ok = document.execCommand("copy");
            document.body.removeChild(ta);
          } catch (__) {
            ok = false;
          }
        }
        btn.textContent = ok ? text("Copied") : text("Copy failed");
        btn.classList.toggle("is-copied", ok);
        window.setTimeout(() => {
          btn.textContent = original;
          btn.classList.remove("is-copied");
        }, 1600);
      });
    });
  }

  async function renderMediaKit() {
    const cfg = await config();
    if (!cfg.features.media_kit) {
      mount("[data-media-kit]", `<article class="card empty-state"><h2>${esc(text("Media kit later."))}</h2><p>${esc(text("No audience stats are published before an audience exists."))}</p></article>`);
      return;
    }
    mount("[data-media-kit]", `<article class="card empty-state"><h2>${esc(text("Stats pending."))}</h2><p>${esc(text("Real reach, average viewers, and sponsor fit will be added after public data exists."))}</p></article>`);
  }

  async function renderSponsors() {
    const cfg = await config();
    if (!cfg.features.media_kit) {
      return;
    }
    mount("[data-sponsor-notes]", `<article class="card empty-state"><h2>${esc(text("Sponsor stats pending."))}</h2><p>${esc(text("Audience and sponsor-fit details will be published only after real public data exists."))}</p></article>`);
  }

  async function renderContact() {
    const cfg = await config();
    mount("[data-contact-channels]", channelCards(cfg));
  }

  async function renderFaq() {
    const faq = await data("faq");
    mount("[data-faq-list]", (faq.items || []).map((item) => `<details class="faq-item"><summary>${esc(item.question)}</summary><p>${esc(item.answer)}</p></details>`).join(""));
  }

  async function renderMembers() {
    const posts = await data("member_posts");
    mount("[data-member-onboarding]", (posts.onboarding || []).map((item) => `<li><strong>${esc(item.step)}</strong><span>${esc(item.description)}</span></li>`).join(""));
    mount("[data-member-planned]", (posts.planned || []).map((item) => `<article class="card"><h3>${esc(item.title)}</h3><p>${esc(item.body)}</p></article>`).join(""));
    mount("[data-member-guidelines]", (posts.guidelines || []).map((item) => `<li>${esc(item)}</li>`).join(""));
  }


  // Links page: one place that lists every public destination. The platform grid reuses
  // platformCards so live.html and links.html can never disagree; podcasts come from the
  // separate "podcasts" array in data/platforms.json.
  function podcastCards(platforms) {
    const items = Array.isArray(platforms.podcasts) ? platforms.podcasts : [];
    return items.map((item, index) => `
      <article class="feature-card official-card">
        <span class="pill">${esc(item.kind || text("Podcast"))}</span>
        <h2>${esc(item.name)}</h2>
        <p>${esc(item.notes || "")}</p>
        ${item.url ? button(item.url, text(`Open ${item.name}`), index === 0 ? "primary" : "") : ""}
      </article>
    `).join("");
  }

  async function renderLinks() {
    const [cfg, platforms] = await Promise.all([config(), data("platforms")]);
    mount("[data-links-platforms]", platformCards(platforms, cfg));
    mount("[data-links-podcasts]", podcastCards(platforms));
  }

  const page = document.body ? document.body.dataset.page : "";
  const renderers = {
    home: renderHome,
    live: renderLive,
    schedule: renderSchedule,
    archive: renderArchive,
    clips: renderArchive,
    news: renderGamingNews,
    rumors: renderGamingNews,
    opinions: renderOpinions,
    leaderboard: renderLeaderboard,
    support: renderSupport,
    sponsors: renderSponsors,
    mediaKit: renderMediaKit,
    contact: renderContact,
    links: renderLinks,
    faq: renderFaq,
    members: renderMembers
  };

  async function render() {
    if (renderers[page]) await renderers[page]();
  }

  window.addEventListener("creatorhub:language", () => {
    render().catch(() => {});
  });

  render().catch((error) => {
    console.error(error);
    mount("[data-load-error]", `<article class="card"><h2>Content could not load</h2><p>Refresh the page or try again later.</p></article>`);
  });
})();

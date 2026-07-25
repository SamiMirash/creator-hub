(function () {
  const state = {
    franchises: [],
    rendered: [],
    playtime: {},
    query: "",
    franchise: "",
    platform: "",
    era: ""
  };

  // Match key shared with game_playtime_tracker.py (_normalize_key):
  // lowercase, collapse any run of non-alphanumerics to one space, trim.
  const playtimeKey = (value) => String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  const esc = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const t = (en) => en;

  async function loadJson(path, fallback) {
    try {
      const res = await fetch(path, { cache: "no-store" });
      if (!res.ok) throw new Error(`Could not load ${path}`);
      return await res.json();
    } catch (_) {
      return fallback;
    }
  }

  function allEntries() {
    return state.franchises.flatMap((franchise) => (franchise.entries || []).map((entry) => ({
      franchise: franchise.franchise,
      franchise_slug: franchise.franchise_slug,
      era: franchise.era,
      summary: franchise.summary,
      ...entry
    })));
  }

  function unique(values) {
    return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }

  function releasePlatforms(entry) {
    return unique([
      entry.primary?.platform,
      entry.sami?.chosen_platform,
      ...(entry.secondary || []).map((item) => item.platform),
      ...(entry.all_releases || []).map((item) => item.platform)
    ]);
  }

  function searchBlob(entry) {
    const blob = [
      entry.franchise,
      entry.title,
      entry.era,
      entry.summary,
      entry.status,
      entry.confidence,
      entry.definitive_edition,
      entry.remaster_caveats,
      entry.primary?.version,
      entry.primary?.platform,
      entry.primary?.why,
      entry.primary?.how_to_play,
      entry.sami?.chosen_platform,
      entry.sami?.rating,
      entry.sami?.difficulty,
      entry.sami?.completion_date,
      entry.sami?.notes,
      Array.isArray(entry.settings) ? entry.settings.join(" ") : entry.settings,
      entry.fidelity_vs_completeness_conflict?.note,
      entry.emulation?.emulator,
      entry.emulation?.notes,
      entry.emulation?.fidelity_ceiling,
      ...(entry.secondary || []).map((item) => `${item.platform} ${item.exclusive_content} ${item.what_to_play} ${item.why}`),
      ...(entry.all_releases || []).map((item) => `${item.platform} ${item.year} ${item.role} ${item.fidelity} ${item.reason}`)
    ].join(" ");
    // PUNCTUATION-INSENSITIVE (Sami, 2026-07-25): the blob used to keep punctuation, so the stored
    // title "Resident Evil: Requiem" did NOT contain the substring "resident evil requiem" and a
    // reader who omitted the colon got ZERO results. Normalise with the SAME `playtimeKey` helper
    // already used for playtime matching (lowercase, any run of non-alphanumerics -> one space) so
    // ':' ';' '-' '/' etc. can never break a search. Reuse, don't re-implement.
    return playtimeKey(blob);
  }

  function hasQuery(entry, query) {
    const needle = playtimeKey(query);
    if (!needle) return true;
    // NORMALISED PHRASE match. Both sides go through playtimeKey, so punctuation the reader types
    // (or omits) is irrelevant: "Resident Evil: Requiem", "resident evil requiem" and
    // "Resident  Evil   Requiem" all hit the same entry.
    // ⚠️ Deliberately NOT "every term matches anywhere" — measured 2026-07-25 on the real 4,569-entry
    // data, that pulled Silent Hill 3 / Origins / Shattered Memories into a "silent hill 2" search
    // (the bare "2" matches a year or "PlayStation 2" deep in the blob), and "the" matched 4,446 of
    // 4,569 rows. Loosening recall that far makes the search WORSE, not smarter.
    return searchBlob(entry).includes(needle);
  }

  function visibleEntries() {
    return allEntries().filter((entry) => {
      const platforms = releasePlatforms(entry).map((platform) => platform.toLowerCase());
      return hasQuery(entry, state.query)
        && (!state.franchise || entry.franchise_slug === state.franchise)
        && (!state.era || entry.era === state.era)
        && (!state.platform || platforms.some((platform) => platform.includes(state.platform.toLowerCase())));
    });
  }

  function setOptions(selector, values, allLabel, selected) {
    const node = document.querySelector(selector);
    if (!node) return;
    node.innerHTML = `<option value="">${esc(allLabel)}</option>${values.map((value) => `<option value="${esc(value)}"${value === selected ? " selected" : ""}>${esc(value)}</option>`).join("")}`;
  }

  function renderStats() {
    const entries = allEntries();
    const researched = entries.filter((entry) => entry.status === "researched").length;
    const conflicts = entries.filter((entry) => entry.fidelity_vs_completeness_conflict?.exists).length;
    const releases = entries.filter((entry) => entry.all_releases?.length).length;
    const stats = [
      [state.franchises.length, t("franchises")],
      [entries.length, t("game rows")],
      [researched, t("researched")],
      [releases, t("with release maps")]
    ];
    document.querySelectorAll("[data-games-stats]").forEach((mount) => {
      mount.innerHTML = stats.map(([value, label]) => `<article class="metric-card"><strong>${esc(value)}</strong><span>${esc(label)}</span></article>`).join("");
    });
  }

  function renderControls() {
    const entries = allEntries();
    const platforms = unique(entries.flatMap((entry) => releasePlatforms(entry).flatMap((platform) => platform.split(/\s\/\s| \/ | - |, /).map((part) => part.trim()))));
    const eras = unique(state.franchises.map((item) => item.era));
    const franchises = state.franchises.map((item) => ({ label: item.franchise, value: item.franchise_slug })).sort((a, b) => a.label.localeCompare(b.label));

    const searchNode = document.querySelector("[data-games-search]");
    if (searchNode && searchNode.value !== state.query) {
      searchNode.value = state.query;
    }
    setOptions("[data-games-era]", eras, t("All eras"), state.era);
    setOptions("[data-games-platform]", platforms, t("All platforms"), state.platform);
    const franchiseNode = document.querySelector("[data-games-franchise]");
    if (franchiseNode) {
      franchiseNode.innerHTML = `<option value="">${esc(t("All franchises"))}</option>${franchises.map((item) => `<option value="${esc(item.value)}"${item.value === state.franchise ? " selected" : ""}>${esc(item.label)}</option>`).join("")}`;
    }
  }

  // sourceLinks()/releaseSourceLinks() REMOVED 2026-07-17. They rendered `<a href>Source N</a>`
  // strips from entry.sources / release.sources, hydrating a de-facto sources page over the
  // prerendered HTML. We never cite, credit, or link anyone — the archive links nothing outward.
  // Provenance no longer ships either (see website_games_publish.py).

  function confidence(entry) {
    const level = entry.confidence || "low";
    return `<span class="confidence-badge confidence-${esc(level)}">${esc(level)}</span>`;
  }

  function yearLabel(year) {
    return year ? String(year) : "";
  }

  function samiPanel(entry) {
    const sami = entry.sami || {};
    const rows = [];
    if (sami.chosen_platform) rows.push([t("Chosen platform"), sami.chosen_platform]);
    if (sami.rating) rows.push([t("Rating"), sami.rating]);
    if (sami.difficulty) rows.push([t("Difficulty"), sami.difficulty]);
    if (sami.completion_date) rows.push([t("Completion"), sami.completion_date]);
    const facts = rows.length ? `<div class="sami-facts">${rows.map(([label, value]) => `<p><strong>${esc(label)}</strong><span>${esc(value)}</span></p>`).join("")}</div>` : "";
    const notes = sami.notes ? `<blockquote>${esc(sami.notes)}</blockquote>` : "";
    if (!facts && !notes) return "";
    return `<section class="sami-sheet"><span class="pill">${esc(t("Sami sheet"))}</span>${facts}${notes}</section>`;
  }

  function playtimeRecord(entry) {
    // Look the game up in playtime_totals.json by normalized title, then by the
    // game's own franchise label as a fallback. Returns null when nothing is tracked.
    const games = state.playtime || {};
    const candidates = [entry.title, entry.franchise];
    for (const name of candidates) {
      const rec = games[playtimeKey(name)];
      if (rec && Number(rec.total_seconds) > 0) return rec;
    }
    return null;
  }

  function playtimeBlock(entry) {
    const rec = playtimeRecord(entry);
    if (!rec) return ""; // absent -> render nothing, gracefully
    const label = rec.total_label || "";
    if (!label) return "";
    const sessions = Number(rec.sessions) > 0
      ? `<p><strong>${esc(t("Sessions"))}</strong><span>${esc(rec.sessions)}</span></p>`
      : "";
    return `<section class="settings-played"><span class="pill">${esc(t("Total playtime"))}</span><div class="settings-grid"><p><strong>${esc(t("Hours played"))}</strong><span>${esc(label)}</span></p>${sessions}</div></section>`;
  }

  function settingsBlock(entry) {
    const raw = entry.settings;
    if (!raw) return "";
    // Accept either a single string (free-form, newline-separated) or an array of
    // "Label: value" lines. Empty/whitespace-only values render nothing.
    const lines = (Array.isArray(raw) ? raw : String(raw).split(/\r?\n/))
      .map((line) => String(line ?? "").trim())
      .filter(Boolean);
    if (!lines.length) return "";
    const rows = lines.map((line) => {
      const idx = line.indexOf(":");
      if (idx > 0) {
        const label = line.slice(0, idx).trim();
        const value = line.slice(idx + 1).trim();
        if (label && value) {
          return `<p><strong>${esc(label)}</strong><span>${esc(value)}</span></p>`;
        }
      }
      return `<p><span>${esc(line)}</span></p>`;
    }).join("");
    return `<section class="settings-played"><span class="pill">${esc(t("Settings I played on"))}</span><div class="settings-grid">${rows}</div></section>`;
  }

  function secondaryList(entry) {
    const items = entry.secondary || [];
    if (!items.length) {
      return `<p class="sub">${esc(t("No secondary exclusive-content pass is currently logged."))}</p>`;
    }
    return `<div class="compact-stack">${items.map((item) => `
      <article class="official-proof">
        <strong>${esc(item.platform || t("Platform pending"))}</strong>
        <span>${esc(item.exclusive_content || t("Exclusive content pending research"))}</span>
        <small>${esc(item.what_to_play || item.why || "")}</small>
      </article>
    `).join("")}</div>`;
  }

  function releaseList(entry) {
    const releases = entry.all_releases || [];
    if (!releases.length) return "";
    return `<div class="release-list">${releases.map((release) => `
      <article class="release-row role-${esc(release.role || "skip")}">
        <div>
          <span class="role-badge">${esc(release.role || "skip")}</span>
          <strong>${esc(release.platform || t("Unknown platform"))}</strong>
          <small>${esc(yearLabel(release.year))}</small>
        </div>
        <p>${esc(release.fidelity || "")}</p>
        <p class="sub">${esc(release.reason || "")}</p>
      </article>
    `).join("")}</div>`;
  }

  function entryBody(entry) {
    if (entry.status !== "researched") {
      const sp = samiPanel(entry);
      const playtime = playtimeBlock(entry);
      const settings = settingsBlock(entry);
      const reason = entry.remaster_caveats || entry.primary?.why || t("Version breakdown coming soon.");
      return [
        sp,
        playtime,
        settings,
        `<section class="card empty-state"><span class="pill">${esc(entry.status || t("needs-research"))}</span><h3>${esc(t("Research exception"))}</h3><p>${esc(reason)}</p></section>`
      ].filter(Boolean).join("\n");
    }
    const p = entry.primary || {};
    const emu = entry.emulation || {};
    const conflict = entry.fidelity_vs_completeness_conflict || { exists: false, note: "" };
    const out = [];
    const sp = samiPanel(entry);
    if (sp) out.push(sp);
    const playtime = playtimeBlock(entry);
    if (playtime) out.push(playtime);
    const settings = settingsBlock(entry);
    if (settings) out.push(settings);
    if (p.version || p.platform || p.why || p.how_to_play) {
      out.push(`<section class="primary-pick"><span class="pill">${esc(t("Primary full run"))}</span>${(p.version || p.platform) ? `<h2>${esc(p.version || p.platform)}</h2>` : ""}${p.platform ? `<p><strong>${esc(p.platform)}</strong></p>` : ""}${p.why ? `<p>${esc(p.why)}</p>` : ""}${p.how_to_play ? `<p class="sub">${esc(p.how_to_play)}</p>` : ""}</section>`);
    }
    if ((entry.secondary || []).length) {
      out.push(`<section class="card"><h3>${esc(t("Secondary exclusives"))}</h3>${secondaryList(entry)}</section>`);
    }
    if ((entry.all_releases || []).length) {
      out.push(`<section class="release-map-section"><h3>${esc(t("Every platform release"))}</h3>${releaseList(entry)}</section>`);
    }
    if (conflict.exists && conflict.note) {
      out.push(`<section class="conflict-flag has-conflict"><span class="pill">${esc(t("Fidelity vs completeness conflict"))}</span><p>${esc(conflict.note)}</p></section>`);
    }
    if (emu.emulator || emu.notes || emu.fidelity_ceiling) {
      out.push(`<section class="card"><h3>${esc(t("Emulation / fidelity ceiling"))}</h3>${emu.emulator ? `<p><strong>${esc(emu.emulator)}</strong></p>` : ""}${emu.notes ? `<p>${esc(emu.notes)}</p>` : ""}${emu.fidelity_ceiling ? `<p class="sub">${esc(emu.fidelity_ceiling)}</p>` : ""}</section>`);
    }
    const caveats = [];
    if (entry.remaster_caveats) caveats.push(`<article class="card"><h3>${esc(t("Remaster caveats"))}</h3><p>${esc(entry.remaster_caveats)}</p></article>`);
    if (entry.definitive_edition) caveats.push(`<article class="card"><h3>${esc(t("Definitive edition"))}</h3><p>${esc(entry.definitive_edition)}</p></article>`);
    if (caveats.length) out.push(`<section class="game-grid caveat-grid">${caveats.join("")}</section>`);
    return out.join("\n");
  }

  function entryShell(entry, index) {
    return `
      <details class="game-entry" data-i="${index}" ${index === 0 ? "open" : ""}>
        <summary>
          <span>
            <small>${esc(entry.franchise)}${entry.release_year ? " · " + esc(entry.release_year) : ""}</small>
            <strong>${esc(entry.title)}</strong>
          </span>
          ${confidence(entry)}
        </summary>
        <div class="game-entry-body" data-lazy></div>
      </details>
    `;
  }

  function fillBody(det) {
    const body = det.querySelector(".game-entry-body[data-lazy]");
    if (!body) return;
    const entry = state.rendered[Number(det.dataset.i)];
    if (!entry) return;
    body.innerHTML = entryBody(entry);
    body.removeAttribute("data-lazy");
  }

  function renderEntries() {
    const entries = visibleEntries();
    state.rendered = entries;
    document.querySelectorAll("[data-games-count]").forEach((node) => {
      node.textContent = t(`${entries.length} matching games`);
    });
    document.querySelectorAll("[data-games-list]").forEach((mount) => {
      // Lazy render: build only lightweight summaries up front (701 full cards at once
      // crashes iOS Safari on memory). Each card body is built on first expand.
      mount.innerHTML = entries.length
        ? entries.map((entry, index) => entryShell(entry, index)).join("")
        : `<article class="card empty-state"><h2>${esc(t("No matches yet."))}</h2><p>${esc(t("Try a broader franchise, platform, era, note, or release reason."))}</p></article>`;
      mount.querySelectorAll(".game-entry").forEach((det) => {
        // Backstop: when the browser does toggle natively, still fill the body.
        det.addEventListener("toggle", () => { if (det.open) fillBody(det); });
        // iOS Safari does not reliably toggle a <details> when the tap lands on a
        // block/grid child inside <summary> (here summary is display:grid with
        // <strong>/<small>/badge children), and it can flip the marker WITHOUT
        // firing `toggle`, so the lazy body never fills -> "opening does nothing".
        // Drive open/close ourselves from an explicit click so it behaves the same
        // on iOS and desktop.
        const summary = det.querySelector("summary");
        if (summary) {
          summary.addEventListener("click", (event) => {
            // Let real links/buttons inside the summary work normally.
            if (event.target.closest("a, button:not(summary)")) return;
            event.preventDefault();
            const willOpen = !det.open;
            det.open = willOpen;
            if (willOpen) fillBody(det);
          });
        }
      });
      const firstOpen = mount.querySelector(".game-entry[open]");
      if (firstOpen) fillBody(firstOpen);
    });
  }

  function bindControls() {
    const search = document.querySelector("[data-games-search]");
    const franchise = document.querySelector("[data-games-franchise]");
    const platform = document.querySelector("[data-games-platform]");
    const era = document.querySelector("[data-games-era]");
    if (search) {
      search.addEventListener("input", () => {
        state.query = search.value.trim();
        renderEntries();
      });
    }
    if (franchise) {
      franchise.addEventListener("change", () => {
        state.franchise = franchise.value;
        renderEntries();
      });
    }
    if (platform) {
      platform.addEventListener("change", () => {
        state.platform = platform.value;
        renderEntries();
      });
    }
    if (era) {
      era.addEventListener("change", () => {
        state.era = era.value;
        renderEntries();
      });
    }
  }

  function renderAll() {
    renderStats();
    renderControls();
    renderEntries();
  }

  async function init() {
    if (!document.body || document.body.dataset.page !== "games") return;
    const params = new URLSearchParams(location.search);
    if (params.get("shot") === "archive" || params.get("shot") === "release") {
      document.documentElement.classList.add("archive-shot");
    }
    if (params.get("shot") === "release") {
      document.documentElement.classList.add("release-shot");
    }
    state.query = params.get("q") || "";
    state.franchise = params.get("franchise") || "";
    state.platform = params.get("platform") || "";
    state.era = params.get("era") || "";
    const [franchises, playtime] = await Promise.all([
      loadJson("data/games.json", []),
      loadJson("data/playtime_totals.json", { games: {} })
    ]);
    state.franchises = Array.isArray(franchises) ? franchises : [];
    state.playtime = (playtime && typeof playtime.games === "object" && playtime.games) || {};
    renderAll();
    bindControls();
    if (location.hash === "#archive" || params.get("shot") === "archive" || params.get("shot") === "release") {
      window.setTimeout(() => {
        const target = params.get("shot") === "release"
          ? document.querySelector("[data-games-list] .game-entry .release-list") || document.querySelector("[data-games-list] .game-entry")
          : document.querySelector("[data-games-list] .game-entry") || document.querySelector("#archive");
        if (target) target.scrollIntoView({ block: "start" });
      }, 120);
    }
    window.addEventListener("creatorhub:language", renderAll);
  }

  init().catch((error) => {
    console.error(error);
    document.querySelectorAll("[data-games-list]").forEach((mount) => {
      mount.innerHTML = `<article class="card"><h2>Game archive could not load.</h2><p>Refresh the page and try again.</p></article>`;
    });
  });
})();

/*
 * Play-log renderer for the Games page.
 * Reads data/playlog.json (built offline from the stream's own session logs) and
 * shows, per game: total time played, first/last played, my review + score, and a
 * day-by-day breakdown of each session's start->stop clock time and duration.
 * Data-driven: every game in playlog.json renders automatically.
 */
(function () {
  const esc = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  async function loadJson(path, fallback) {
    try {
      const res = await fetch(path, { cache: "no-store" });
      if (!res.ok) throw new Error(`Could not load ${path}`);
      return await res.json();
    } catch (_) {
      return fallback;
    }
  }

  function prettyDate(iso) {
    // "2026-06-27" -> "Sat, Jun 27, 2026"
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
    if (!m) return String(iso || "");
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" });
  }

  function scoreBadge(score) {
    if (!score) return "";
    return `<span class="playlog-score">${esc(score)}</span>`;
  }

  function reviewBlock(game) {
    const review = game.review || "";
    const score = game.score || "";
    if (!review && !score) return "";
    const body = review ? `<blockquote>${esc(review)}</blockquote>` : "";
    const sc = score ? `<p class="playlog-review-score"><strong>My score</strong> ${scoreBadge(score)}</p>` : "";
    return `<section class="playlog-review"><span class="pill">My review</span>${sc}${body}</section>`;
  }

  function sessionRow(session) {
    const span = (session.start_clock && session.end_clock)
      ? `${esc(session.start_clock)} to ${esc(session.end_clock)}`
      : "";
    return `<li><span class="playlog-span">${span}</span><span class="playlog-dur">${esc(session.duration_label || "")}</span></li>`;
  }

  function dayBlock(day) {
    const sessions = (day.sessions || []).map(sessionRow).join("");
    return `
      <article class="playlog-day">
        <header>
          <strong>${esc(prettyDate(day.date))}</strong>
          <span class="playlog-day-total">${esc(day.day_label || "")}</span>
        </header>
        <ul class="playlog-sessions">${sessions}</ul>
      </article>`;
  }

  function gameCard(game) {
    const facts = [];
    // TWO DIFFERENT FACTS. "Played" is the game's own counter; "on stream" is measured off the
    // recordings. They are never equal - Returnal was 15h03m played against 10h29m streamed -
    // and showing only one under the other's name is how the page told a visitor something false.
    if (game.ingame_label) {
      facts.push(["Time played", game.ingame_label + (game.ingame_as_of ? " (to " + game.ingame_as_of + ")" : "")]);
    }
    facts.push([game.ingame_label ? "Of that, on stream" : "Time on stream", game.total_label || ""]);
    // Every fact below is derived from the STREAMS. Once the game's own counter is present they
    // must say so: "Last played Aug 2" was wrong the moment he played on the 14th off-stream.
    const s = game.ingame_label ? " streamed" : " played";
    if (game.first_played) facts.push(["First" + s, prettyDate(game.first_played)]);
    const lastStream = game.last_played || "";
    if (lastStream && lastStream !== game.first_played) facts.push(["Last" + s, prettyDate(lastStream)]);
    if (game.ingame_as_of && game.ingame_as_of > lastStream) facts.push(["Last played", prettyDate(game.ingame_as_of)]);
    if (game.day_count) facts.push([game.ingame_label ? "Days streamed" : "Days played", String(game.day_count)]);
    if (game.session_count) facts.push([game.ingame_label ? "Streams" : "Sessions", String(game.session_count)]);
    const factGrid = `<div class="settings-grid">${facts.map(([label, value]) => `<p><strong>${esc(label)}</strong><span>${esc(value)}</span></p>`).join("")}</div>`;
    const days = (game.days || []).slice().reverse().map(dayBlock).join("");
    return `
      <details class="game-entry playlog-entry" open>
        <summary>
          <span>
            <small>Play log${game.score ? " · scored " + esc(game.score) : ""}</small>
            <strong>${esc(game.display || "")}</strong>
          </span>
          <span class="playlog-total-badge">${esc(game.ingame_label || game.total_label || "")}</span>
        </summary>
        <div class="game-entry-body">
          <section class="settings-played"><span class="pill">${esc(game.ingame_label ? "How long I have played it" : "Time on stream")}</span>${factGrid}</section>
          ${reviewBlock(game)}
          <section class="playlog-days"><h3>Session by session</h3>${days || '<p class="sub">No sessions logged yet.</p>'}</section>
        </div>
      </details>`;
  }

  async function init() {
    if (!document.body || document.body.dataset.page !== "games") return;
    const section = document.querySelector("[data-playlog-section]");
    const list = document.querySelector("[data-playlog-list]");
    if (!section || !list) return;

    const data = await loadJson("data/playlog.json", { games: {} });
    const games = (data && typeof data.games === "object" && data.games) || {};
    const cards = Object.values(games)
      .filter((g) => g && Number(g.total_seconds) > 0)
      .sort((a, b) => String(b.last_played || "").localeCompare(String(a.last_played || "")))
      .map(gameCard)
      .join("");

    if (!cards) {
      // Nothing tracked yet -> keep the section hidden so the page stays clean.
      return;
    }
    list.innerHTML = cards;
    section.hidden = false;
  }

  init().catch((error) => { console.error(error); });
})();

/* Spoiler-free one-run game helper -- phone viewer.
   Loads packs/<id>/pack.json, renders one AREA at a time, hides spoilers by
   default, lets the user reveal per item at levels 0..3, and tracks manual
   progress in localStorage. No network beyond loading the static pack. */
(function () {
  "use strict";

  var app = document.getElementById("app");
  var PACKS_INDEX = "packs/index.json";

  function qs(name) {
    return new URLSearchParams(location.search).get(name);
  }
  function tpl(id) {
    return document.getElementById(id).content.cloneNode(true);
  }
  function el(root, sel) { return root.querySelector(sel); }
  function els(root, sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); }
  function setText(node, sel, t) { var n = el(node, sel); if (n) n.textContent = t; }

  function getJSON(url) {
    return fetch(url, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(url + " -> " + r.status);
      return r.json();
    });
  }
  function render(node) { app.innerHTML = ""; app.appendChild(node); }
  function fail(msg) {
    app.innerHTML = '<main class="pad"><div class="checkcard"><h2>Could not load</h2>' +
      '<p class="muted small">' + escapeHtml(msg) + '</p></div></main>';
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /* ---------- progress (localStorage) ---------- */
  function Progress(packId) {
    this.key = "ggp:" + packId;
    try { this.data = JSON.parse(localStorage.getItem(this.key) || "{}"); }
    catch (e) { this.data = {}; }
    if (!this.data.collected) this.data.collected = {};
    if (!this.data.acked) this.data.acked = {};
    if (typeof this.data.areaIdx !== "number") this.data.areaIdx = 0;
    if (typeof this.data.spoiler !== "number") this.data.spoiler = 0;
    // high-water mark: furthest area index the user has actually reached.
    // Used to keep the jump list spoiler-free (only reached areas are listed,
    // so the full area list / total count is never exposed).
    if (typeof this.data.reached !== "number") this.data.reached = this.data.areaIdx;
    if (this.data.areaIdx > this.data.reached) this.data.reached = this.data.areaIdx;
  }
  Progress.prototype.save = function () {
    try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) {}
  };
  Progress.prototype.isCollected = function (id) { return !!this.data.collected[id]; };
  Progress.prototype.toggle = function (id) {
    if (this.data.collected[id]) delete this.data.collected[id];
    else this.data.collected[id] = 1;
    this.save();
  };
  Progress.prototype.isAcked = function (id) { return !!this.data.acked[id]; };
  Progress.prototype.ack = function (id) { this.data.acked[id] = 1; this.save(); };

  /* ---------- pack picker ---------- */
  function showPicker() {
    getJSON(PACKS_INDEX).then(function (idx) {
      var node = tpl("tpl-picker");
      var list = el(node, "[data-list]");
      (idx.packs || []).forEach(function (p) {
        var li = document.createElement("li");
        li.innerHTML = '<a href="?pack=' + encodeURIComponent(p.id) + '">' +
          '<span class="pg">' + escapeHtml(p.title) + '</span><span class="pa">&#8594;</span></a>';
        list.appendChild(li);
      });
      if (!(idx.packs || []).length) {
        list.innerHTML = '<li class="muted small">No game packs yet.</li>';
      }
      render(node);
    }).catch(function () {
      fail("No game packs available yet.");
    });
  }

  /* ---------- main game view ---------- */
  function showGame(packId) {
    getJSON("packs/" + packId + "/pack.json").then(function (pack) {
      new GameView(pack, packId).mount();
    }).catch(function (e) {
      fail("Pack '" + packId + "' did not load. " + e.message);
    });
  }

  function GameView(pack, packId) {
    this.pack = pack;
    this.packId = packId;
    this.areas = pack.areas || [];
    this.prog = new Progress(packId);
    this.spoiler = this.prog.data.spoiler;
    this.areaIdx = Math.min(this.prog.data.areaIdx, Math.max(0, this.areas.length - 1));
    this.reached = Math.min(this.prog.data.reached || 0, Math.max(0, this.areas.length - 1));
    if (this.areaIdx > this.reached) this.reached = this.areaIdx;
    this.checkOpen = false; // whether the "before I leave" list is revealed
    this.atEnd = false;     // showing the "reached the end" message
  }

  GameView.prototype.area = function () { return this.areas[this.areaIdx] || {}; };

  // count items in an area by collected state
  GameView.prototype.tally = function (area) {
    var items = area.items || [], left = 0, miss = 0, done = 0;
    var self = this;
    items.forEach(function (it) {
      if (self.prog.isCollected(it.id)) done++;
      else { left++; if (it.missable) miss++; }
    });
    return { total: items.length, left: left, miss: miss, done: done };
  };

  GameView.prototype.mount = function () {
    render(tpl("tpl-game"));
    // After render() appends the template fragment into #app, the fragment is
    // emptied -- so all later queries must run against the live #app container,
    // not the now-empty fragment. (Querying the fragment returned null and broke
    // mounting with "Cannot read properties of null".)
    this.node = app;
    var self = this;

    setText(this.node, "[data-game-name]", this.pack.game || "Game");
    document.title = (this.pack.game || "Game") + " helper";

    // area select -- only lists areas the user has actually REACHED, so the
    // full area list (and therefore the total area count) is never exposed.
    var sel = el(this.node, "[data-area-select]");
    this.renderAreaSelect();
    sel.addEventListener("change", function () { self.go(parseInt(sel.value, 10)); });

    el(this.node, "[data-prev]").addEventListener("click", function () { self.go(self.areaIdx - 1); });
    el(this.node, "[data-next]").addEventListener("click", function () { self.go(self.areaIdx + 1); });

    // ⭐⭐ THE TWO OTHER WAYS A PERSON SAYS "GO LEFT". the creator reported that "the moving left
    // and right thing" did not work, and three separate looks at this file found nothing, because
    // go() is correct and the buttons are wired. The defect was never in the handler - it was that
    // the handler had exactly ONE way in. On a phone or an iPad you swipe; at a desk you press the
    // arrow keys; neither existed, so both did nothing at all while the on-screen arrows worked.
    // ⛔ Checking the button handler is the SAMPLE. The population is every way a user can
    // express the intent.

    // keyboard: ignore it while a form control has focus, or typing in the area select would move
    document.addEventListener("keydown", function (e) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      var t = e.target || {};
      var tag = (t.tagName || "").toLowerCase();
      if (tag === "input" || tag === "select" || tag === "textarea" || t.isContentEditable) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); self.go(self.areaIdx - 1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); self.go(self.areaIdx + 1); }
    });

    // swipe: horizontal only, and only a decisive one, so it can never fight vertical scrolling
    var sx = 0, sy = 0, tracking = false;
    this.node.addEventListener("touchstart", function (e) {
      if (e.touches.length !== 1) { tracking = false; return; }
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; tracking = true;
    }, { passive: true });
    this.node.addEventListener("touchend", function (e) {
      if (!tracking) return;
      tracking = false;
      var tt = (e.changedTouches && e.changedTouches[0]) || null;
      if (!tt) return;
      var dx = tt.clientX - sx, dy = tt.clientY - sy;
      // ⭐ a swipe counts only if it is long enough AND clearly more sideways than vertical
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.7) return;
      if (dx < 0) self.go(self.areaIdx + 1);   // swipe LEFT  -> forward, like turning a page
      else self.go(self.areaIdx - 1);          // swipe RIGHT -> back
    }, { passive: true });

    el(this.node, "[data-check]").addEventListener("click", function () {
      self.checkOpen = true; self.renderArea();
    });
    el(this.node, "[data-nextarea]").addEventListener("click", function () {
      self.go(self.areaIdx + 1);
    });
    var endback = el(this.node, "[data-endback]");
    if (endback) endback.addEventListener("click", function () {
      self.atEnd = false; self.go(self.areaIdx);
    });

    // spoiler level buttons
    els(this.node, ".sl-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        self.spoiler = parseInt(b.getAttribute("data-sl"), 10);
        self.prog.data.spoiler = self.spoiler; self.prog.save();
        self.renderItems();
        self.syncSpoilerBar();
      });
    });

    el(this.node, "[data-reset]").addEventListener("click", function () {
      if (confirm("Reset all progress for " + (self.pack.game || "this game") + "? This clears collected items and warnings on this phone.")) {
        try { localStorage.removeItem(self.prog.key); } catch (e) {}
        location.reload();
      }
    });

    this.syncSpoilerBar();
    this.renderArea();
  };

  GameView.prototype.go = function (idx) {
    if (idx < 0) return;
    // Advancing PAST the final area reveals the end-of-game message. The next
    // arrow stays normal on every area (never grayed), so the user only learns
    // the game is over by actively choosing to advance past the last area.
    if (idx >= this.areas.length) {
      if (this.areaIdx >= this.areas.length - 1) { this.showEnd(); }
      return;
    }
    this.atEnd = false;
    this.areaIdx = idx;
    this.checkOpen = false;
    // A NEW AREA STARTS SPOILER-FREE (Sami, 2026-07-25). Previously the detail level
    // carried over from the last area, so walking into a new place immediately dumped
    // level-3 locations on you -- the opposite of what this tool is for. Worse, the
    // spoiler bar was never re-synced after the move, so its highlight disagreed with
    // the level actually being rendered and the buttons looked dead until you reloaded
    // the page. Reset the level AND re-sync the bar on every area change.
    this.spoiler = 0;
    this.prog.data.spoiler = 0;
    this.prog.data.areaIdx = idx;
    if (idx > this.reached) { this.reached = idx; this.prog.data.reached = idx; this.renderAreaSelect(); }
    this.prog.save();
    var sel = el(this.node, "[data-area-select]"); if (sel) sel.value = idx;
    // scroll to top of body so the new area starts clean
    window.scrollTo(0, 0);
    this.renderArea();
    this.syncSpoilerBar();
  };

  // Populate the jump dropdown with ONLY the areas the user has reached so far.
  GameView.prototype.renderAreaSelect = function () {
    var sel = el(this.node, "[data-area-select]");
    if (!sel) return;
    var max = this.reached, cur = this.areaIdx;
    sel.innerHTML = "";
    for (var i = 0; i <= max; i++) {
      var a = this.areas[i] || {};
      var o = document.createElement("option");
      o.value = i; o.textContent = (i + 1) + ". " + (a.name || ("Area " + (i + 1)));
      sel.appendChild(o);
    }
    sel.value = cur;
  };

  // Reveal the end-of-game message (only via advancing past the last area).
  GameView.prototype.showEnd = function () {
    this.atEnd = true;
    var card = el(this.node, "[data-endcard]");
    window.scrollTo(0, 0);
    // hide normal area body sections, show the end card
    els(this.node, "[data-area-cue-wrap],[data-warnzone],.checkcard,[data-spoilerbar],[data-items],[data-areafoot]").forEach(function (n) {
      n.hidden = true; n.style.display = "none";
    });
    if (card) card.hidden = false;
  };

  GameView.prototype.syncSpoilerBar = function () {
    var self = this;
    els(this.node, ".sl-btn").forEach(function (b) {
      b.classList.toggle("active", parseInt(b.getAttribute("data-sl"), 10) === self.spoiler);
    });
    // The sketch-discoverability hint only matters while the reader is BELOW the
    // level that reveals sketches (2+). Once they're at 2 or 3, the "Show sketch"
    // buttons are already visible, so hide the hint to avoid nagging.
    var hint = el(this.node, "[data-sketch-hint]");
    if (hint) hint.hidden = self.spoiler >= 2;
  };

  GameView.prototype.renderArea = function () {
    var a = this.area();
    var t = this.tally(a);

    setText(this.node, "[data-area-label]", a.name || ("Area " + (this.areaIdx + 1)));
    // Position WITHOUT the total -- "of N" reveals overall game length (spoiler).
    setText(this.node, "[data-area-pos]", "Area " + (this.areaIdx + 1));
    setText(this.node, "[data-area-status]",
      t.left === 0 ? "all clear" : (t.left + " left" + (t.miss ? " · " + t.miss + " missable" : "")));
    setText(this.node, "[data-area-note]", a.note || "Explore normally. When you are about to leave, tap below.");

    // Area location cue -- a purely physical, spoiler-free "how to recognise
    // this place" line, for games that never show the area name on screen.
    // No story / character / event, just a landmark/setting you can see.
    var cueWrap = el(this.node, "[data-area-cue-wrap]");
    if (cueWrap) {
      cueWrap.style.display = ""; // undo any hide from the end card
      if (a.location_cue) {
        setText(this.node, "[data-area-cue]", a.location_cue);
        cueWrap.hidden = false;
      } else {
        cueWrap.hidden = true;
      }
    }

    // counts chips
    var counts = el(this.node, "[data-counts]");
    counts.innerHTML = "";
    function chip(cls, txt) { var s = document.createElement("span"); s.className = "chip " + cls; s.textContent = txt; counts.appendChild(s); }
    if (t.total === 0) chip("zero", "nothing to collect");
    else {
      chip(t.left ? "left" : "done", t.left ? (t.left + " left") : "all done");
      if (t.miss) chip("miss", t.miss + " missable");
      if (t.done) chip("done", t.done + " got");
    }

    // Prev disables only at the very first area (no spoiler -- start is known).
    // Next ALWAYS stays enabled/normal, even on the final area, so the arrow
    // never pre-reveals the end; pressing it past the last area shows the end.
    el(this.node, "[data-prev]").disabled = this.areaIdx === 0;
    el(this.node, "[data-next]").disabled = false;

    // returning from the end card: restore normal body sections + hide end card
    var endcard = el(this.node, "[data-endcard]");
    if (endcard) { endcard.hidden = true; endcard.style.display = ""; }
    els(this.node, "[data-warnzone],.checkcard").forEach(function (n) {
      n.hidden = false; n.style.display = "";
    });

    this.renderWarnings(a);

    // body sections visibility
    el(this.node, "[data-spoilerbar]").style.display = "";
    el(this.node, "[data-items]").style.display = "";
    el(this.node, "[data-areafoot]").style.display = "";
    el(this.node, "[data-spoilerbar]").hidden = !this.checkOpen;
    el(this.node, "[data-items]").hidden = !this.checkOpen;
    el(this.node, "[data-areafoot]").hidden = !this.checkOpen;

    if (this.checkOpen) this.renderItems();
    this.renderProgress();
  };

  // Save-backup + point-of-no-return warning cards (shown without opening the check).
  GameView.prototype.renderWarnings = function (a) {
    var zone = el(this.node, "[data-warnzone]");
    zone.innerHTML = "";
    var self = this;

    // Generic, spoiler-free "how to" for backing up a save. Two methods:
    //   1) In-game manual save slots (no point ever overwrites a backup slot).
    //   2) A true file-level backup by copying the save folder.
    // Path is FULLY ANONYMIZED -- placeholders only, never any personal
    // username, PC name or Steam ID.
    var BACKUP_HOWTO =
      '<details class="howto"><summary>How to back up your save</summary>' +
      '<p class="muted small"><strong>Easiest (in-game):</strong> at any safe room / typewriter, ' +
      'create a <em>new</em> manual save in an EMPTY slot instead of overwriting your current one. ' +
      'The game keeps many manual slots, so an old slot stays a perfect backup you can reload later.</p>' +
      '<p class="muted small"><strong>Belt-and-braces (copy the file on PC):</strong> close the game first, ' +
      'then copy the whole save folder somewhere safe (e.g. your Desktop). On a default Steam install it is at:</p>' +
      '<p class="muted small"><code>%ProgramFiles(x86)%\\Steam\\userdata\\&lt;YourSteamID&gt;\\3764200\\remote\\win64_save\\</code></p>' +
      '<p class="muted small">If Steam is installed elsewhere, open <code>...\\Steam\\userdata\\</code> in your own ' +
      'Steam folder, then the numbered <code>&lt;YourSteamID&gt;</code> folder, then <code>3764200</code> ' +
      '(Requiem&rsquo;s app id) &rarr; <code>remote\\win64_save</code>. To restore, close the game and copy that ' +
      'folder back. Optional: in the game&rsquo;s Steam properties you can turn off Steam Cloud sync so it can&rsquo;t ' +
      'overwrite a restored save.</p>' +
      '</details>';

    function card(w, cls, icon, title) {
      var wid = (a.id || self.areaIdx) + ":" + cls;
      var div = document.createElement("div");
      div.className = "warn " + cls + (self.prog.isAcked(wid) ? " acked" : "");
      div.innerHTML =
        '<h3>' + icon + " " + escapeHtml(title) + '</h3>' +
        '<p>' + escapeHtml(w.why || "") + '</p>' +
        (w.detail ? '<p class="muted small">' + escapeHtml(w.detail) + '</p>' : "") +
        (cls === "backup" ? BACKUP_HOWTO : "") +
        '<button class="ack">Got it, I handled this</button>';
      el(div, ".ack").addEventListener("click", function () {
        self.prog.ack(wid); div.classList.add("acked");
      });
      zone.appendChild(div);
    }

    // Save-backup first -- it's an action he must take BEFORE proceeding.
    if (a.save_backup) {
      card(a.save_backup, "backup", "⚠️",
        a.save_backup.title || "Back up your save now");
    }
    if (a.point_of_no_return) {
      card(a.point_of_no_return, "ponr", "⛔",
        a.point_of_no_return.title || "Point of no return ahead");
    }
  };

  GameView.prototype.renderItems = function () {
    var ul = el(this.node, "[data-items]");
    var a = this.area();
    var items = a.items || [];
    var self = this;
    ul.innerHTML = "";

    if (!items.length) {
      ul.innerHTML = '<li class="area-clear">Nothing collectible here. Explore freely and move on.</li>';
      return;
    }

    var allDone = items.every(function (it) { return self.prog.isCollected(it.id); });
    if (allDone) {
      var done = document.createElement("li");
      done.className = "area-clear";
      done.textContent = "✓ Everything in this area is marked collected. You're clear to move on.";
      ul.appendChild(done);
    }

    items.forEach(function (it) {
      ul.appendChild(self.renderItem(it));
    });
  };

  // Per item: at level 0 show only the safe type (no name); levels 1..3 reveal more.
  GameView.prototype.renderItem = function (it) {
    var self = this;
    var li = document.createElement("li");
    var collected = this.prog.isCollected(it.id);
    li.className = "item" + (collected ? " collected" : "");

    var lvl = this.spoiler;
    // Level 0 = count only: hide the item's name; show generic type label.
    var label = lvl === 0 ? (it.safe_type || typeName(it.type)) : (it.label || it.safe_type || typeName(it.type));

    var hint = "";
    if (lvl >= 1 && it.levels) {
      // pick the highest available level text up to the selected level
      for (var L = Math.min(lvl, 3); L >= 1; L--) {
        if (it.levels[L]) { hint = it.levels[L]; break; }
      }
    }

    // Button-gated confirmation SKETCH. Only offered when:
    //   - the item carries a sketch descriptor, AND
    //   - the selected spoiler level is at or above the sketch's min_level
    //     (the level that actually reveals a location -- never level 0/1).
    // The sketch is opt-in: it stays hidden until the user taps "Show sketch",
    // and it is scoped to THIS collectible only (one SVG, this item's spot).
    var sketch = it.sketch;
    var sketchGated = sketch && typeof sketch.min_level === "number"
      ? lvl >= sketch.min_level
      : !!sketch;
    var showSketch = sketch && sketchGated;

    li.innerHTML =
      '<div class="row1">' +
        '<span class="typ">' + escapeHtml(typeName(it.type)) + '</span>' +
        '<span class="label">' + escapeHtml(label) + '</span>' +
        (it.missable ? '<span class="miss-tag">missable</span>' : "") +
      '</div>' +
      (hint ? '<div class="hint' + (lvl >= 3 ? ' lvl3' : '') + '">' + escapeHtml(hint) + '</div>' : '') +
      '<div class="actions">' +
        '<button class="mark">' + (collected ? "✓ Collected" : "Mark collected") + '</button>' +
        (showSketch ? '<button class="sketchbtn" type="button">Show sketch</button>' : '') +
      '</div>' +
      (showSketch ? '<figure class="sketchwrap" hidden><img class="sketchimg" alt="Spoiler-safe location sketch for this collectible"><figcaption class="muted small">Line sketch of this exact spot, a location guide rather than a screenshot.</figcaption></figure>' : '');

    el(li, ".mark").addEventListener("click", function () {
      self.prog.toggle(it.id);
      self.renderArea(); // recompute counts + clear state
    });

    if (showSketch) {
      var btn = el(li, ".sketchbtn");
      var fig = el(li, ".sketchwrap");
      var img = el(li, ".sketchimg");
      btn.addEventListener("click", function () {
        if (fig.hidden) {
          // Lazy-load the visual only on first reveal. Path is relative to the
          // current pack folder; the sketch lives at packs/<id>/<src>.
          // ⭐ UNLESS IT IS ALREADY ABSOLUTE. Guide images are moving to Cloudflare Pages,
          // because GitHub Pages caps a published site at 1 GB and the finished guide set needs
          // roughly 30 GB at 4K , it cannot fit at ANY image quality, so the images have to live
          // off-site while the HTML and JSON stay here and the routing never changes.
          // ⛔ Backward-compatible ON PURPOSE: all 185 packs already on the site carry a relative
          // `src` and must keep working untouched. Only a pack whose src starts with http(s) is
          // treated as external, so this can be rolled out one pack at a time instead of as a
          // flag-day migration.
          if (!img.getAttribute("src")) {
            var _s = sketch.src || "";
            img.setAttribute("src", /^https?:\/\//i.test(_s)
              ? _s
              : "packs/" + self.packId + "/" + _s);
          }
          fig.hidden = false;
          btn.textContent = "Hide sketch";
        } else {
          fig.hidden = true;
          btn.textContent = "Show sketch";
        }
      });
    }
    return li;
  };

  function typeName(t) {
    var m = {
      file: "File", document: "Document", note: "Note", collectible: "Collectible",
      secret: "Secret", weapon: "Weapon", upgrade: "Upgrade", treasure: "Treasure",
      key: "Key item", lock: "Locked / come back", interaction: "Interaction",
      optional: "Optional", choice: "Choice", ending: "Ending",
      // legacy aliases -> completion framing (no trophies/achievements shown)
      trophy: "Collectible", achievement: "Collectible"
    };
    return m[t] || "Collectible";
  }

  GameView.prototype.renderProgress = function () {
    // Per-AREA progress only. A global "got / total" across every area would
    // leak the total collectible count -> overall game length (spoiler).
    var a = this.area();
    var items = a.items || [], got = 0;
    var self = this;
    items.forEach(function (it) { if (self.prog.isCollected(it.id)) got++; });
    setText(this.node, "[data-progress]",
      items.length ? (got + " / " + items.length + " here") : "tracking");
  };

  /* ---------- boot ---------- */
  var packId = qs("pack");
  if (packId) showGame(packId);
  else showPicker();
})();

(function () {
  const site = {
    name: "Sami Mirash",
    tagline: "Games and live commentary on news, movies, tech, politics, and internet culture."
  };

  // Top navigation. FLAT by design: the things that matter most are top-level,
  // directly-visible links -- NOT buried inside dropdown groups. Each entry is:
  //   ["Label", "href.html"]                      -> a plain top-level link
  //   { group: "Label", items: [ ["L","h"], ... ] } -> a dropdown of links
  // The bar wraps to a second line on narrow widths (flex-wrap), so a long flat
  // row stays legible. Only the genuinely-secondary pages live in a single small
  // "More" dropdown. NOTHING is removed -- every page is still reachable.
  // The grouped <a> children keep the same selectors (gating, motion, palette)
  // working. On mobile the dropdown expands inline inside the menu panel.
  // Terms / Privacy / FAQ stay BOTTOM-ONLY (footer links); they are intentionally
  // kept out of the top nav + command palette and live only in footerItems below.
  const navItems = [
    ["Home", "index.html"],
    ["Live", "live.html"],
    // Game Hub merges the game list, its settings, its guide and its playtime onto ONE page
    // per game (Sami 2026-08-16: "I want everything about that game to be there").
    // ⛔ Games / 100% Guides / Game Settings are deliberately NOT in the menu any more —
    // "we don't want the other sections shown in the menu, we combine all the sections".
    // The PAGES still exist and their URLs still work; they are just not advertised separately.
    ["Game Hub", "game.html"],
    ["About", "about.html"],
      ["Marginalia", "marginalia.html"],
    // Themed groups (Sami 2026-07-14: "not many people click on More" -- everything that was
    // buried there now lives in a visible, named group. NOTHING removed except the Sponsors
    // link, dropped per the remove-all-sponsorship-talk order; the page itself still exists.)
    { group: "Video archive", items: [
      ["Videos & streams", "archive.html"]
    ] },
    { group: "Music", items: [
      ["Music", "music.html"]
    ] },
    { group: "News & Takes", items: [
      ["Gaming News & Rumors", "news.html"],
      ["My Take", "opinions.html"],
      ["Newsletter", "newsletter.html"]
    ] },
    { group: "Community", items: [
      ["Schedule", "schedule.html"],
      ["Leaderboard", "leaderboard.html"],
      ["Contact", "contact.html"]
    ] },
    { group: "Membership", items: [
      ["Join", "join.html"],
      ["Login", "login.html"],
      ["Members", "members.html"],
      ["Profile", "profile.html"]
    ] },
    ["Support", "support.html"],
    { group: "More", items: [
      ["Media Kit", "media-kit.html"],
      ["Merch", "merch.html"]
    ] }
  ];

  const footerItems = [
    ["About", "about.html"],
    ["Marginalia", "marginalia.html"],
    ["Live", "live.html"],
    ["Game Hub", "game.html"],
    ["Games", "games.html"],
    ["100% Guides", "guides.html"],
    ["Game Settings", "setup.html"],
    ["Music", "music.html"],
    ["Schedule", "schedule.html"],
    ["Archive", "archive.html"],
    ["My Take", "opinions.html"],
    ["Gaming News & Rumors", "news.html"],
    ["FAQ", "faq.html"],
    ["Support", "support.html"],
    ["Leaderboard", "leaderboard.html"],
    ["Media Kit", "media-kit.html"],
        ["Merch", "merch.html"],
    ["Members", "members.html"],
    ["Join", "join.html"],
    ["Login", "login.html"],
    ["Profile", "profile.html"],
    ["Newsletter", "newsletter.html"],
    ["Contact", "contact.html"],
    ["Privacy", "privacy.html"],
    ["Terms", "terms.html"]
  ];

  const current = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  function isCurrent(href) {
    return href.toLowerCase() === current || (current === "" && href === "index.html");
  }

  function navLink([label, href, lang]) {
    const aria = isCurrent(href) ? ' aria-current="page"' : "";
    const langAttr = lang ? ` lang="${lang}"` : "";
    return `<a href="${href}"${langAttr}${aria}>${label}</a>`;
  }

  function renderHeader() {
    const mount = document.querySelector("[data-site-header]");
    if (!mount) return;
    const links = navItems.map((entry) => {
      // Grouped dropdown: a <details> whose summary is the group name and whose
      // body is the child links. data-nav-group lets initMenu close it on click
      // and lets the desktop CSS open it on hover/focus.
      if (entry && entry.group) {
        const children = (entry.items || []);
        const hasCurrent = children.some(([, href]) => isCurrent(href));
        const childLinks = children.map(navLink).join("");
        const openAttr = hasCurrent ? " open" : "";
        const currentAttr = hasCurrent ? ' aria-current="page"' : "";
        return `<details class="nav-group" data-nav-group${openAttr}>`
          + `<summary${currentAttr}>${entry.group}</summary>`
          + `<div class="nav-group-menu">${childLinks}</div>`
          + `</details>`;
      }
      return navLink(entry);
    }).join("");
    mount.innerHTML = `
      <div class="announcement-bar" data-announcement hidden></div>
      <div class="wrap nav">
        <a class="brand" href="index.html" aria-label="${site.name} home"><img src="assets/logo.png" alt="" width="36" height="36" style="border-radius:50%;display:block;object-fit:cover"><span>${site.name}</span></a>
        <nav class="nav-links" id="site-links" data-links aria-label="Primary navigation">${links}</nav>
        <button class="menu-button" data-menu aria-expanded="false" aria-controls="site-links">Menu</button>
        <div class="nav-actions">
          <button class="theme-button" type="button" data-command-open>Menu</button>
          <button class="theme-button" type="button" data-theme-toggle aria-label="Toggle light and dark theme">Theme</button>
        </div>
      </div>`;
  }

  async function fetchJson(path) {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`Could not load ${path}`);
    return res.json();
  }

  async function initAnnouncement() {
    const mount = document.querySelector("[data-announcement]");
    if (!mount) return;
    try {
      const payload = await fetchJson("data/site.json");
      const announcement = payload.announcement || {};
      if (!announcement.enabled || !announcement.message) return;
      const href = announcement.url || "newsletter.html";
      mount.innerHTML = `<a href="${href}"><strong>${announcement.label || "Update"}</strong><span>${announcement.message}</span></a>`;
      mount.hidden = false;
    } catch (_) {
      mount.hidden = true;
    }
  }

  async function initAnalytics() {
    try {
      const config = await fetchJson("data/config.json");
      const domain = config.analytics && config.analytics.plausible_domain;
      if (!domain) return;
      const script = document.createElement("script");
      script.defer = true;
      script.src = "https://plausible.io/js/script.js";
      script.setAttribute("data-domain", domain);
      document.head.appendChild(script);
    } catch (_) {}
  }

  function renderFooter() {
    const mount = document.querySelector("[data-site-footer]");
    if (!mount) return;
    const links = footerItems.map(([label, href]) => `<a href="${href}">${label}</a>`).join("");
    mount.innerHTML = `
      <div class="wrap footer-grid">
        <div>
          <strong>${site.name}</strong>
          <p class="sub">${site.tagline} Static GitHub Pages site, free member accounts through Supabase, and no service keys in the browser.</p>
          <div class="platforms" aria-label="Public platforms">
            <a href="https://kick.com/SamiMirash" rel="me noopener noreferrer">Kick</a>
            <a href="https://x.com/SamiMirash" rel="me noopener noreferrer">X</a>
            <a href="https://t.me/sami_mirash" rel="me noopener noreferrer">Telegram</a>
          </div>
          <p class="sub footer-contact">Contact: <a href="mailto:contact@samimirash.com">contact@samimirash.com</a></p>
        </div>
        <nav class="footer-links" aria-label="Footer navigation">${links}</nav>
        <div class="footer-meta">
          <small>Copyright <span data-year></span> ${site.name}. All rights reserved.</small>
          <small>No clips, videos, audience stats, sponsors, or products are claimed before they exist.</small>
        </div>
      </div>`;
  }

  // Optional pages (News idea #252, Rumors idea #251) default to ON; a site owner can
  // hide them by setting features.news / features.rumors to false in data/config.json.
  // The header/footer render synchronously before config loads, so we prune the links
  // afterward -- the same "explicit false hides it, anything else shows it" rule the
  // data pages use in content.js. Optional-page hrefs map to their feature flag here.
  const optionalNavFlags = {
    "opinions.html": "opinions",
    "leaderboard.html": "leaderboard"
  };
  function removeNavHref(href) {
    document
      .querySelectorAll(`[data-links] a[href="${href}"], .footer-links a[href="${href}"], .command-result[href="${href}"]`)
      .forEach((node) => node.remove());
  }
  async function gateOptionalNav() {
    let features;
    try {
      const config = await fetchJson("data/config.json");
      features = (config && config.features) || {};
    } catch (_) {
      return; // Config missing -> leave defaults (links visible).
    }
    Object.entries(optionalNavFlags).forEach(([href, flag]) => {
      if (features[flag] !== false) return; // default true: only an explicit false hides it
      removeNavHref(href);
    });
    // Combined Gaming News & Rumors page (news.html): hide only when BOTH the news
    // and rumors features are explicitly turned off.
    if (features.news === false && features.rumors === false) removeNavHref("news.html");
  }

  function renderQuickRail() {
    if (document.querySelector("[data-desk-rail]")) return;
    const rail = document.createElement("nav");
    rail.className = "desk-rail";
    rail.setAttribute("data-desk-rail", "");
    rail.setAttribute("aria-label", "Quick navigation");
    rail.innerHTML = `
      <a href="live.html"><span>Watch</span><strong>Live</strong></a>
      <a href="games.html"><span>Best</span><strong>Games</strong></a>
      <a href="join.html"><span>Free</span><strong>Join</strong></a>
      <button type="button" data-command-open><span>Open</span><strong>Menu</strong></button>`;
    document.body.appendChild(rail);
  }

  function initCommandPalette() {
    const items = [
      ["Home", "Pre-launch link hub", "index.html", "start landing"],
      ["Support", "Config-gated donations, crypto, Ko-fi and wishlist links", "support.html", "tips donate donations crypto paypal"],
      ["Bio", "About Sami and the channel", "about.html", "about story me"],
      ["Live", "Watch links, live badge, and player facades", "live.html", "stream watch"],
      ["Games", "Best-version-to-play archive with sourced port differences", "games.html", "versions ports remasters"],
      ["100% Guides", "Search a game and open a spoiler-free guide to 100% completion -- every collectible, secret, and all endings in one run", "guides.html", "guide guides spoiler free 100 percent completion collectibles secrets endings walkthrough"],
      ["Game Settings", "The exact graphics, display, and mod setup Sami runs on stream, per game, read straight from the game's own settings file", "setup.html", "game settings setup stream graphics display mods configuration"],
      ["Music", "Sami's playlists and music taste", "music.html", "songs tracks audio playlists spotify"],
      ["Schedule", "Next stream and calendar file", "schedule.html", "calendar ics"],
      ["Archive", "Future VOD and episode archive", "archive.html", "vod episodes"],
      ["Gaming News & Rumors", "Game news plus tracked rumors, each rumor rated for how likely it is true", "news.html", "game news rumors rumours leaks odds updates"],
      ["My Take", "Sami's personal opinions and takes", "opinions.html", "opinion opinions blog my take views articles"],
      ["Leaderboard", "Follower counts across platforms and a thank-you board for supporters", "leaderboard.html", "leaderboard followers supporters top donors rank stats"],
      ["Media Kit", "Brand assets, stats, and contact for partners", "media-kit.html", "press brand assets partnership"],
      ["Sponsors", "Sponsorship and partnership info", "sponsors.html", "brands partners advertising"],
      ["Merch", "Merch store and drops", "merch.html", "store shop apparel"],
      ["Members", "Free member room", "members.html", "account"],
      ["Join", "Create a free member account", "join.html", "signup register account"],
      ["Login", "Sign in to your member account", "login.html", "signin account auth"],
      ["Profile", "Manage your member profile", "profile.html", "account settings me"],
      ["Newsletter", "Subscribe for updates", "newsletter.html", "subscribe email updates"],
      ["Contact", "Public and form contact routes", "contact.html", "message"]
      // Terms / Privacy / FAQ are BOTTOM-ONLY -- intentionally omitted from the
      // Ctrl+K command palette to match navItems (they live in the footer only).
    ].map(([label, detail, href, tags]) => ({ label, detail, href, tags }));

    const overlay = document.createElement("div");
    overlay.className = "command-overlay";
    overlay.setAttribute("data-command-overlay", "");
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="command-dialog" role="dialog" aria-modal="true" aria-label="Quick menu">
        <div class="command-head">
          <span class="pill">Quick menu</span>
          <button type="button" data-command-close aria-label="Close menu">Close</button>
        </div>
        <label class="command-search">
          <span>Jump to</span>
          <input type="search" data-command-input autocomplete="off" placeholder="Live, games, archive, members">
        </label>
        <div class="command-results" data-command-results></div>
      </div>`;
    document.body.appendChild(overlay);

    const input = overlay.querySelector("[data-command-input]");
    const results = overlay.querySelector("[data-command-results]");
    const render = () => {
      const query = input.value.trim().toLowerCase();
      const visible = items.filter((item) => !query || `${item.label} ${item.detail} ${item.tags}`.toLowerCase().includes(query));
      results.innerHTML = visible.map((item) => `
        <a class="command-result" href="${item.href}">
          <strong>${item.label}</strong>
          <span>${item.detail}</span>
        </a>
      `).join("") || `<p class="command-empty">No matching page.</p>`;
    };
    const open = () => {
      overlay.setAttribute("aria-hidden", "false");
      document.documentElement.classList.add("command-open");
      input.value = "";
      render();
      window.setTimeout(() => input.focus(), 30);
    };
    const close = () => {
      overlay.setAttribute("aria-hidden", "true");
      document.documentElement.classList.remove("command-open");
    };

    document.querySelectorAll("[data-command-open]").forEach((button) => button.addEventListener("click", open));
    overlay.querySelector("[data-command-close]").addEventListener("click", close);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close();
    });
    input.addEventListener("input", render);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && document.documentElement.classList.contains("command-open")) close();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        open();
      }
    });
    render();
  }

  function initTheme() {
    const prefName = "creatorHubTheme";
    const saved = localStorage.getItem(prefName);
    if (saved === "light" || saved === "dark") document.documentElement.dataset.theme = saved;
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
        document.documentElement.dataset.theme = next;
        localStorage.setItem(prefName, next);
      });
    });
  }

  function initMenu() {
    const menu = document.querySelector("[data-menu]");
    const links = document.querySelector("[data-links]");
    if (!menu || !links) return;
    menu.addEventListener("click", () => {
      const open = links.getAttribute("data-open") === "true";
      links.setAttribute("data-open", String(!open));
      menu.setAttribute("aria-expanded", String(!open));
    });
    links.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        links.setAttribute("data-open", "false");
        menu.setAttribute("aria-expanded", "false");
      });
    });
  }

  function initYear() {
    document.querySelectorAll("[data-year]").forEach((node) => {
      node.textContent = new Date().getFullYear();
    });
  }

  // --- Whole-site translation (Google Website Translate element) ---------------
  // English is the source. A visitor picks a target language once; the choice is
  // stored in the `site_lang` cookie so we never ask again, and applied on every
  // return visit via the `googtrans` cookie that the Google widget reads.
  function initTranslate() {
    // A representative spread of widely-spoken world languages for the first-visit
    // picker. The Google widget itself exposes the full ~130-language list once it
    // loads (the small "Select Language" control it injects), so this only needs to
    // cover the common cases that set the cookie.
    // Every language Google Translate supports, named uniformly in plain ASCII.
    // ⭐ 2026-08-23, The creator: "add every single language that exists in the world ... it
    //   doesn't cost us anything". This REPLACES the curated 30-entry list.
    // ⛔ AND IT RESOLVES THE DOX PROBLEM THAT REMOVED FARSI ON 2026-07-12 RATHER THAN
    //   REOPENING IT. The risk then was never Farsi's presence: it was that Farsi was the
    //   ONLY name written in its native script while all 29 others were ASCII. One
    //   hand-written alphabet is a tell. A COMPLETE list, every entry named the same way,
    //   has no selection signal at all - nothing stands out because nothing was chosen.
    //   Persian appears here as "Persian", exactly like Polish and Portuguese.
    //   See doctrine/reversal_registry.json -> farsi_may_return_inside_a_complete_list
    const LANGUAGES = [
      ["en", "English"], ["af", "Afrikaans"], ["sq", "Albanian"], ["am", "Amharic"],
      ["ar", "Arabic"], ["hy", "Armenian"], ["as", "Assamese"], ["ay", "Aymara"],
      ["az", "Azerbaijani"], ["bm", "Bambara"], ["eu", "Basque"], ["be", "Belarusian"],
      ["bn", "Bengali"], ["bho", "Bhojpuri"], ["bs", "Bosnian"], ["bg", "Bulgarian"],
      ["ca", "Catalan"], ["ceb", "Cebuano"], ["ny", "Chichewa"],
      ["zh-CN", "Chinese (Simplified)"], ["zh-TW", "Chinese (Traditional)"],
      ["co", "Corsican"], ["hr", "Croatian"], ["cs", "Czech"], ["da", "Danish"],
      ["dv", "Dhivehi"], ["doi", "Dogri"], ["nl", "Dutch"], ["eo", "Esperanto"],
      ["et", "Estonian"], ["ee", "Ewe"], ["fil", "Filipino"], ["fi", "Finnish"],
      ["fr", "French"], ["fy", "Frisian"], ["gl", "Galician"], ["ka", "Georgian"],
      ["de", "German"], ["el", "Greek"], ["gn", "Guarani"], ["gu", "Gujarati"],
      ["ht", "Haitian Creole"], ["ha", "Hausa"], ["haw", "Hawaiian"], ["he", "Hebrew"],
      ["hi", "Hindi"], ["hmn", "Hmong"], ["hu", "Hungarian"], ["is", "Icelandic"],
      ["ig", "Igbo"], ["ilo", "Ilocano"], ["id", "Indonesian"], ["ga", "Irish"],
      ["it", "Italian"], ["ja", "Japanese"], ["jv", "Javanese"], ["kn", "Kannada"],
      ["kk", "Kazakh"], ["km", "Khmer"], ["rw", "Kinyarwanda"], ["gom", "Konkani"],
      ["ko", "Korean"], ["kri", "Krio"], ["ku", "Kurdish (Kurmanji)"],
      ["ckb", "Kurdish (Sorani)"], ["ky", "Kyrgyz"], ["lo", "Lao"], ["la", "Latin"],
      ["lv", "Latvian"], ["ln", "Lingala"], ["lt", "Lithuanian"], ["lg", "Luganda"],
      ["lb", "Luxembourgish"], ["mk", "Macedonian"], ["mai", "Maithili"], ["mg", "Malagasy"],
      ["ms", "Malay"], ["ml", "Malayalam"], ["mt", "Maltese"], ["mi", "Maori"],
      ["mr", "Marathi"], ["mni-Mtei", "Meiteilon (Manipuri)"], ["lus", "Mizo"],
      ["mn", "Mongolian"], ["my", "Myanmar (Burmese)"], ["ne", "Nepali"], ["no", "Norwegian"],
      ["or", "Odia (Oriya)"], ["om", "Oromo"], ["ps", "Pashto"], ["fa", "Persian"],
      ["pl", "Polish"], ["pt", "Portuguese"], ["pa", "Punjabi"], ["qu", "Quechua"],
      ["ro", "Romanian"], ["ru", "Russian"], ["sm", "Samoan"], ["sa", "Sanskrit"],
      ["gd", "Scots Gaelic"], ["nso", "Sepedi"], ["sr", "Serbian"], ["st", "Sesotho"],
      ["sn", "Shona"], ["sd", "Sindhi"], ["si", "Sinhala"], ["sk", "Slovak"],
      ["sl", "Slovenian"], ["so", "Somali"], ["es", "Spanish"], ["su", "Sundanese"],
      ["sw", "Swahili"], ["sv", "Swedish"], ["tg", "Tajik"], ["ta", "Tamil"], ["tt", "Tatar"],
      ["te", "Telugu"], ["th", "Thai"], ["ti", "Tigrinya"], ["ts", "Tsonga"],
      ["tr", "Turkish"], ["tk", "Turkmen"], ["ak", "Twi"], ["uk", "Ukrainian"], ["ur", "Urdu"],
      ["ug", "Uyghur"], ["uz", "Uzbek"], ["vi", "Vietnamese"], ["cy", "Welsh"],
      ["xh", "Xhosa"], ["yi", "Yiddish"], ["yo", "Yoruba"], ["zu", "Zulu"]
    ];

    const PREF = "site_lang";

    // Right-to-left target languages: when one of these is active we flip the page
    // direction so the translated text reads correctly. (Google's widget also sets
    // this, but we do it explicitly so it is reliable and applies on first paint.)
    const RTL_LANGS = ["fa", "ar", "he", "ur", "ps", "sd", "yi"];
    function applyDir(lang) {
      const rtl = RTL_LANGS.indexOf(lang) !== -1;
      document.documentElement.setAttribute("dir", rtl ? "rtl" : "ltr");
      document.documentElement.setAttribute("lang", lang || "en");
    }

    function readCookie(name) {
      const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
      return match ? decodeURIComponent(match[1]) : "";
    }
    function writeCookie(name, value, days) {
      const maxAge = days ? "; max-age=" + (days * 86400) : "";
      // Set on the bare host and (best-effort) the registrable domain so the widget
      // and our preference agree across www/apex.
      document.cookie = name + "=" + value + "; path=/" + maxAge + "; SameSite=Lax";
      const host = location.hostname.replace(/^www\./, "");
      if (host && host.indexOf(".") !== -1) {
        document.cookie = name + "=" + value + "; path=/; domain=." + host + maxAge + "; SameSite=Lax";
      }
    }
    function clearGoogtrans() {
      document.cookie = "googtrans=; path=/; max-age=0";
      const host = location.hostname.replace(/^www\./, "");
      document.cookie = "googtrans=; path=/; domain=." + host + "; max-age=0";
    }

    // The Google widget reads target language from the `googtrans=/en/<lang>` cookie.
    function setGoogtrans(lang) {
      if (!lang || lang === "en") {
        clearGoogtrans();
      } else {
        writeCookie("googtrans", "/en/" + lang, 365);
      }
    }

    let widgetLoaded = false;
    function loadWidget() {
      if (widgetLoaded) return;
      widgetLoaded = true;
      if (!document.getElementById("google_translate_element")) {
        const mount = document.createElement("div");
        mount.id = "google_translate_element";
        mount.setAttribute("aria-hidden", "true");
        document.body.appendChild(mount);
      }
      window.googleTranslateElementInit = function () {
        if (!(window.google && window.google.translate)) return;
        /* eslint-disable no-new */
        new window.google.translate.TranslateElement({
          pageLanguage: "en",
          autoDisplay: false,
          layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE
        }, "google_translate_element");
      };
      const script = document.createElement("script");
      script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      script.async = true;
      document.head.appendChild(script);
    }

    // Apply a chosen language: store preference, set the widget cookie, and load
    // (or reload to re-run) the widget so the translation takes effect immediately.
    function applyLanguage(lang, persist) {
      if (persist) writeCookie(PREF, lang, 365);
      setGoogtrans(lang);
      applyDir(lang);
      if (lang === "en") {
        // Easiest reliable way to drop back to the untranslated source.
        location.reload();
        return;
      }
      if (widgetLoaded) {
        location.reload();
      } else {
        loadWidget();
      }
    }

    const saved = readCookie(PREF);

    // Return visit with a non-English choice: apply it silently on load.
    if (saved && saved !== "en") {
      setGoogtrans(saved);
      applyDir(saved);
      loadWidget();
    }

    // First visit (no stored preference): show the dismissible picker.
    if (!saved) {
      showPicker();
    }

    function showPicker() {
      if (document.querySelector("[data-lang-picker]")) return;
      const bar = document.createElement("div");
      bar.className = "lang-picker";
      bar.setAttribute("data-lang-picker", "");
      bar.setAttribute("role", "dialog");
      bar.setAttribute("aria-label", "Choose your language");
      const options = LANGUAGES.map(([code, label]) =>
        `<option value="${code}">${label}</option>`).join("");
      bar.innerHTML = `
        <span class="lang-picker-text">Read this site in your language?</span>
        <label class="lang-picker-field">
          <span class="visually-hidden">Language</span>
          <select data-lang-select aria-label="Language">${options}</select>
        </label>
        <button type="button" class="lang-picker-apply" data-lang-apply>Translate</button>
        <button type="button" class="lang-picker-close" data-lang-dismiss aria-label="Keep English and close">No thanks</button>`;
      document.body.appendChild(bar);

      const select = bar.querySelector("[data-lang-select]");
      const dismiss = () => {
        // Remember the dismissal as "English" so we never ask again.
        writeCookie(PREF, "en", 365);
        bar.remove();
      };
      bar.querySelector("[data-lang-apply]").addEventListener("click", () => {
        const lang = select.value;
        bar.remove();
        applyLanguage(lang, true);
      });
      bar.querySelector("[data-lang-dismiss]").addEventListener("click", dismiss);
    }
  }

  function initServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    // Service worker retired (caused stale pages, incl. blank game archive on iOS).
    // Unregister any existing worker and drop its caches so every device self-heals;
    // do NOT register a new one. Registering sw.js (the kill switch) is also unnecessary
    // because the browser update-checks the existing registration on navigation.
    navigator.serviceWorker.getRegistrations()
      .then((regs) => regs.forEach((r) => r.unregister()))
      .catch(() => {});
    if (self.caches && caches.keys) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
    }
  }

  function initPremiumMotion() {
    document.documentElement.classList.add("premium-experience");
    const progress = document.createElement("div");
    progress.className = "read-progress";
    progress.setAttribute("aria-hidden", "true");
    progress.innerHTML = "<span></span>";
    document.body.appendChild(progress);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const transition = document.createElement("div");
    transition.className = "page-transition";
    transition.setAttribute("aria-hidden", "true");
    document.body.appendChild(transition);
    const aura = document.createElement("div");
    aura.className = "pointer-aura";
    aura.setAttribute("aria-hidden", "true");
    document.body.appendChild(aura);
    const clickLayer = document.createElement("div");
    clickLayer.className = "click-layer";
    clickLayer.setAttribute("aria-hidden", "true");
    document.body.appendChild(clickLayer);

    if (!reducedMotion) {
      const revealSelector = "main .hero, main .section, main .compact-section, .card, .feature-card, .route-card, .tier-card, .metric-card, .front-brief, .board-cell, .auth-panel, .embed-facade";
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -7% 0px" });
      const reveal = (scope) => {
        const nodes = scope.matches && scope.matches(revealSelector) ? [scope] : Array.from(scope.querySelectorAll ? scope.querySelectorAll(revealSelector) : []);
        nodes.forEach((node) => {
          if (node.classList.contains("motion-reveal")) return;
          node.classList.add("motion-reveal");
          observer.observe(node);
        });
      };
      reveal(document);
      new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) reveal(node);
          });
        });
      }).observe(document.body, { childList: true, subtree: true });
      window.addEventListener("pointermove", (event) => {
        document.documentElement.style.setProperty("--pointer-x", `${event.clientX}px`);
        document.documentElement.style.setProperty("--pointer-y", `${event.clientY}px`);
      }, { passive: true });
    }

    const updateProgress = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const ratio = Math.min(1, Math.max(0, window.scrollY / max));
      progress.style.setProperty("--read-progress", ratio.toFixed(4));
      document.documentElement.dataset.scrolled = window.scrollY > 280 ? "true" : "false";
      document.documentElement.style.setProperty("--scroll-ratio", ratio.toFixed(4));
      document.documentElement.style.setProperty("--hero-shift", `${Math.min(54, window.scrollY * 0.075).toFixed(1)}px`);
    };
    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);

    document.addEventListener("pointerdown", (event) => {
      if (reducedMotion || !event.isPrimary) return;
      const pulse = document.createElement("span");
      pulse.className = "click-pulse";
      pulse.style.left = `${event.clientX}px`;
      pulse.style.top = `${event.clientY}px`;
      clickLayer.appendChild(pulse);
      pulse.addEventListener("animationend", () => pulse.remove(), { once: true });
    });

    const magneticSelector = ".button, .theme-button, .nav-links a, .footer-links a, .desk-rail a, .desk-rail button, .command-result, .card a, .feature-card a, .route-card a";
    let magneticNode = null;
    const resetMagnet = (node) => {
      if (!node) return;
      node.style.removeProperty("--magnet-x");
      node.style.removeProperty("--magnet-y");
    };
    document.addEventListener("pointermove", (event) => {
      if (reducedMotion || !event.target.closest) return;
      const node = event.target.closest(magneticSelector);
      if (magneticNode && magneticNode !== node) resetMagnet(magneticNode);
      if (!node) {
        magneticNode = null;
        return;
      }
      const box = node.getBoundingClientRect();
      node.style.setProperty("--magnet-x", `${((event.clientX - box.left) / Math.max(1, box.width) - 0.5) * 10}px`);
      node.style.setProperty("--magnet-y", `${((event.clientY - box.top) / Math.max(1, box.height) - 0.5) * 10}px`);
      magneticNode = node;
    }, { passive: true });
    document.addEventListener("pointerout", (event) => {
      if (!magneticNode || !event.target.closest) return;
      const leaving = event.target.closest(magneticSelector);
      if (leaving !== magneticNode) return;
      if (event.relatedTarget && magneticNode.contains(event.relatedTarget)) return;
      resetMagnet(magneticNode);
      magneticNode = null;
    }, { passive: true });

    document.querySelectorAll('a[href]:not([target]):not([href^="#"]):not([href^="mailto:"]):not([href^="tel:"])').forEach((link) => {
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || reducedMotion) return;
      link.addEventListener("click", (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.defaultPrevented) return;
        event.preventDefault();
        document.documentElement.classList.add("is-transitioning");
        window.setTimeout(() => {
          location.href = link.href;
        }, 210);
      });
    });
    window.addEventListener("pageshow", () => {
      document.documentElement.classList.remove("is-transitioning");
      document.documentElement.classList.add("is-ready");
    });
  }

  renderHeader();
  renderFooter();
  renderQuickRail();
  initCommandPalette();
  gateOptionalNav();
  initAnnouncement();
  initAnalytics();
  initTheme();
  initMenu();
  initYear();
  initTranslate();
  initPremiumMotion();
  initServiceWorker();
})();

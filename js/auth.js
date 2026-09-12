(function () {
  const cfg = window.CREATOR_HUB_CONFIG || {};
  const pendingUrlMarker = ["YOUR", "PROJECT", "REF"].join("-");
  const pendingKeyMarker = ["YOUR", "PUBLIC", "SUPABASE", "ANON", "KEY"].join("_");
  const setupPending = !cfg.SUPABASE_URL ||
    !cfg.SUPABASE_ANON_KEY ||
    cfg.SUPABASE_URL.includes(pendingUrlMarker) ||
    cfg.SUPABASE_ANON_KEY.includes(pendingKeyMarker);
  const warnings = document.querySelectorAll("[data-config-warning]");
  const statusNodes = document.querySelectorAll("[data-auth-status]");
  const authRequired = document.querySelectorAll("[data-auth-required]");
  const membersOnly = document.querySelectorAll("[data-members-only]");
  const memberName = document.querySelector("[data-member-name]");

  const setStatus = (msg, tone) => {
    statusNodes.forEach((node) => {
      node.textContent = msg || "";
      node.dataset.tone = tone || "";
    });
  };

  if (setupPending || !window.supabase) {
    warnings.forEach((node) => {
      node.dataset.tone = "bad";
      node.textContent = "Supabase setup pending: paste the project URL and public anon key into js/config.js.";
    });
    authRequired.forEach((node) => { node.hidden = false; });
    membersOnly.forEach((node) => { node.hidden = true; });
    return;
  }

  const client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  async function currentSession() {
    const { data, error } = await client.auth.getSession();
    if (error) return null;
    return data && data.session ? data.session : null;
  }

  async function loadProfile(userId) {
    const { data, error } = await client.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (error) return null;
    return data;
  }

  async function upsertProfile(user, patch) {
    const row = {
      id: user.id,
      display_name: patch.display_name || user.email || "Member",
      handle: patch.handle || null,
      bio: patch.bio || null,
      favorite_topics: patch.favorite_topics || null,
      updated_at: new Date().toISOString()
    };
    const { error } = await client.from("profiles").upsert(row, { onConflict: "id" });
    if (error) throw error;
    return row;
  }

  async function subscribeNewsletter(email, language) {
    const row = {
      email,
      preferred_language: language || "en",
      source: "creator_hub_static_site",
      subscribed_at: new Date().toISOString()
    };
    const { error } = await client.from("newsletter_subscribers").insert(row, { returning: "minimal" });
    if (error) throw error;
    return row;
  }

  async function sendContact(name, email, message, reason) {
    const row = {
      name: name || null,
      email,
      reason: reason || "general",
      message,
      source: "creator_hub_static_site",
      submitted_at: new Date().toISOString()
    };
    const { error } = await client.from("contact_messages").insert(row, { returning: "minimal" });
    if (error) throw error;
    return row;
  }

  async function refreshGate() {
    const session = await currentSession();
    const isIn = Boolean(session && session.user);
    authRequired.forEach((node) => { node.hidden = isIn; });
    membersOnly.forEach((node) => { node.hidden = !isIn; });
    if (!isIn) return;

    const profile = await loadProfile(session.user.id);
    const display = profile && profile.display_name ? profile.display_name : (session.user.email || "Member");
    if (memberName) memberName.textContent = `Welcome, ${display}`;
    const form = document.querySelector("#profile-form");
    if (form && profile) {
      form.elements.display_name.value = profile.display_name || "";
      form.elements.handle.value = profile.handle || "";
      form.elements.bio.value = profile.bio || "";
      form.elements.favorite_topics.value = profile.favorite_topics || "";
    }
  }

  const signup = document.querySelector("#signup-form");
  if (signup) {
    signup.addEventListener("submit", async (event) => {
      event.preventDefault();
      setStatus("Creating account...", "");
      const form = new FormData(signup);
      const displayName = String(form.get("display_name") || "").trim();
      const email = String(form.get("email") || "").trim();
      const password = String(form.get("password") || "");
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } }
      });
      if (error) {
        setStatus(error.message, "bad");
        return;
      }
      if (data.user) {
        try {
          await upsertProfile(data.user, { display_name: displayName });
        } catch (_) {
          /* Confirmation settings can delay profile writes until login. */
        }
      }
      setStatus("Account created. If confirmation is enabled, verify your email; otherwise open the member room.", "ok");
    });
  }

  const login = document.querySelector("#login-form");
  if (login) {
    login.addEventListener("submit", async (event) => {
      event.preventDefault();
      setStatus("Logging in...", "");
      const form = new FormData(login);
      const email = String(form.get("email") || "").trim();
      const password = String(form.get("password") || "");
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) {
        setStatus(error.message, "bad");
        return;
      }
      setStatus("Logged in. Opening the member room...", "ok");
      window.setTimeout(() => { window.location.href = "members.html"; }, 500);
    });
  }

  const profileForm = document.querySelector("#profile-form");
  if (profileForm) {
    profileForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      setStatus("Saving profile...", "");
      const session = await currentSession();
      if (!session) {
        setStatus("Log in before saving a profile.", "bad");
        return;
      }
      const form = new FormData(profileForm);
      try {
        await upsertProfile(session.user, {
          display_name: String(form.get("display_name") || "").trim(),
          handle: String(form.get("handle") || "").trim(),
          bio: String(form.get("bio") || "").trim(),
          favorite_topics: String(form.get("favorite_topics") || "").trim()
        });
        setStatus("Profile saved.", "ok");
        await refreshGate();
      } catch (error) {
        setStatus(error.message || "Could not save profile.", "bad");
      }
    });
  }

  const newsletter = document.querySelector("#newsletter-form");
  if (newsletter) {
    newsletter.addEventListener("submit", async (event) => {
      event.preventDefault();
      setStatus("Subscribing...", "");
      const form = new FormData(newsletter);
      const email = String(form.get("email") || "").trim();
      const language = String(form.get("language") || "en").trim();
      try {
        await subscribeNewsletter(email, language);
        setStatus("Subscribed. You are on the launch notification list.", "ok");
        newsletter.reset();
      } catch (error) {
        const already = String(error.message || "").toLowerCase().includes("duplicate");
        setStatus(already ? "That email is already on the list." : (error.message || "Could not subscribe."), already ? "ok" : "bad");
      }
    });
  }

  const contact = document.querySelector("#contact-form");
  if (contact) {
    contact.addEventListener("submit", async (event) => {
      event.preventDefault();
      setStatus("Sending message...", "");
      const form = new FormData(contact);
      try {
        await sendContact(
          String(form.get("name") || "").trim(),
          String(form.get("email") || "").trim(),
          String(form.get("message") || "").trim(),
          String(form.get("reason") || "general").trim()
        );
        setStatus("Message sent.", "ok");
        contact.reset();
      } catch (error) {
        setStatus(error.message || "Could not send message.", "bad");
      }
    });
  }

  document.querySelectorAll("[data-logout]").forEach((button) => {
    button.addEventListener("click", async () => {
      await client.auth.signOut();
      window.location.href = "index.html";
    });
  });

  client.auth.onAuthStateChange(() => { refreshGate(); });
  refreshGate();
})();

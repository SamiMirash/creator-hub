/**
 * /api/youtube  —  server-side proxy for the channel's YouTube RSS feed.
 *
 * WHY THIS EXISTS
 * The site used to fetch https://www.youtube.com/feeds/videos.xml straight from the browser.
 * That can never work: YouTube serves the feed with NO Access-Control-Allow-Origin header, so
 * every request from samimirash.com is blocked by CORS. The old code caught the failure and fell
 * back to an empty state, which is why the page read "No YouTube videos found" while the channel
 * had public videos the whole time. MEASURED 2026-08-27:
 *     curl  https://www.youtube.com/feeds/videos.xml?channel_id=UCkEhDkAiaagGJlIuYhugBPQ
 *       -> HTTP 200, 4959 bytes, <title>Sami Mirash</title> + both videos
 *     curl -I with Origin: https://www.samimirash.com
 *       -> HTTP 200 and NO access-control-allow-origin
 * The channel id was correct all along. The transport was the bug.
 *
 * A Pages Function runs on Cloudflare's side, where CORS does not apply, so it can read the feed
 * and hand it back as same-origin JSON. No API key, no quota, no third-party proxy.
 */

const FEED = "https://www.youtube.com/feeds/videos.xml?channel_id=";

// Pull one tag's text out of an <entry> block. The feed is small and rigidly shaped, and a
// Pages Function has no DOMParser, so a scoped regex is the right tool here rather than a
// dependency. Anchored to the entry slice so it cannot wander into a neighbouring entry.
function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? m[1].trim() : "";
}

function attr(block, name, key) {
  const m = block.match(new RegExp(`<${name}[^>]*\\b${key}="([^"]*)"`));
  return m ? m[1] : "";
}

function decode(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const channelId = url.searchParams.get("channel_id") || "";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "6", 10) || 6, 15);

  const headers = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    // the feed changes when a video is published, which is rare. cache hard at the edge, and let
    // a stale copy serve while it revalidates so a YouTube hiccup never blanks the page.
    "cache-control": "public, max-age=900, s-maxage=900, stale-while-revalidate=86400",
  };

  // ⛔ fail CLOSED and say WHY. An empty list and a broken fetch used to look identical from the
  // page's side, which is exactly how this stayed broken without anyone noticing.
  if (!/^UC[A-Za-z0-9_-]{20,}$/.test(channelId)) {
    return new Response(
      JSON.stringify({ ok: false, error: "missing or malformed channel_id", videos: [] }),
      { status: 400, headers }
    );
  }

  let xml;
  try {
    const res = await fetch(FEED + encodeURIComponent(channelId), {
      headers: { "user-agent": "samimirash.com feed reader" },
      cf: { cacheTtl: 900, cacheEverything: true },
    });
    if (!res.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: `youtube returned ${res.status}`, videos: [] }),
        { status: 502, headers }
      );
    }
    xml = await res.text();
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: "could not reach youtube", videos: [] }),
      { status: 502, headers }
    );
  }

  const entries = xml.split("<entry>").slice(1, limit + 1);
  const videos = entries.map((block) => {
    const videoId = tag(block, "yt:videoId") || tag(block, "videoId");
    return {
      title: decode(tag(block, "title")),
      videoId,
      url: attr(block, "link", "href") || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : ""),
      published: tag(block, "published"),
      thumb: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : "",
    };
  }).filter((v) => v.videoId);

  return new Response(
    JSON.stringify({ ok: true, channel: decode(tag(xml.split("<entry>")[0], "title")), count: videos.length, videos }),
    { status: 200, headers }
  );
}

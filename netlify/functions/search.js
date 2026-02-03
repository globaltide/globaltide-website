// netlify/functions/search.js  (Netlify Functions v2 style)
// MUST return Response

const CACHE = new Map(); // key -> { ts, data }
const CACHE_MS = 10 * 60 * 1000;

function stripHtml(s) {
  return (s || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cacheKey(q, hl, gl, ceid, limit) {
  return `${(q || "").toLowerCase()}::${hl}:${gl}:${ceid}::${limit}`;
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

async function fetchWithTimeout(url, ms, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function tryFetchText(name, url, timeoutMs) {
  const r = await fetchWithTimeout(url, timeoutMs, {
    headers: {
      "user-agent": "Mozilla/5.0 (Netlify Function; GlobalTide)",
      ...(url.includes("news.google.com")
        ? { "accept": "application/rss+xml, application/xml, text/xml, */*" }
        : {}),
    },
  });

  if (!r.ok) throw new Error(`${name} not ok: ${r.status}`);

  const text = await r.text();

  // HTML/too-short 방어 (차단 페이지)
  if (!text || text.length < 80 || /<html/i.test(text)) {
    throw new Error(`${name} returned html/too-short`);
  }

  return text;
}

async function fetchRssText(rssUrl) {
  // 1) direct 시도
  try {
    return await tryFetchText("direct", rssUrl, 4500);
  } catch (_) {}

  // 2) proxy fallback (서버에서만)
  const proxies = [
    { name: "allorigins", url: `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`, t: 4500 },
    { name: "corsproxy.io", url: `https://corsproxy.io/?${encodeURIComponent(rssUrl)}`, t: 4500 },
    { name: "codetabs", url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(rssUrl)}`, t: 9000 },
  ];

  let lastErr = null;
  for (const p of proxies) {
    try {
      return await tryFetchText(p.name, p.url, p.t);
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`Failed to fetch RSS. ${lastErr?.message || ""}`.trim());
}

function parseRssItems(xmlText, limit = 30) {
  const items = [];
  const blocks = xmlText.match(/<item>[\s\S]*?<\/item>/gi) || [];

  for (const block of blocks.slice(0, limit)) {
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
      return m ? m[1].trim() : "";
    };

    const title = stripHtml(get("title"));
    const link = stripHtml(get("link"));
    const pubDate = stripHtml(get("pubDate"));
    const source = stripHtml(get("source"));
    const desc = stripHtml(get("description"));

    items.push({
      title,
      url: link,
      source,
      date: pubDate,
      snippet: desc,
    });
  }

  return items;
}

export default async (request) => {
  try {
    const u = new URL(request.url);
    const q = (u.searchParams.get("q") || "").trim();
    if (!q) return json({ items: [] });

    const hl = u.searchParams.get("hl") || "en";
    const gl = u.searchParams.get("gl") || "US";
    const ceid = u.searchParams.get("ceid") || "US:en";
    const limit = Math.min(parseInt(u.searchParams.get("limit") || "30", 10) || 30, 50);

    const key = cacheKey(q, hl, gl, ceid, limit);
    const cached = CACHE.get(key);
    if (cached && (Date.now() - cached.ts) < CACHE_MS) {
      return json({ items: cached.data, cached: true }, 200, {
        "cache-control": "public, max-age=60",
      });
    }

    const rssUrl =
      `https://news.google.com/rss/search?q=${encodeURIComponent(q)}` +
      `&hl=${encodeURIComponent(hl)}&gl=${encodeURIComponent(gl)}&ceid=${encodeURIComponent(ceid)}`;

    const xmlText = await fetchRssText(rssUrl);
    const items = parseRssItems(xmlText, limit);

    CACHE.set(key, { ts: Date.now(), data: items });

    return json({ items }, 200, {
      "cache-control": "public, max-age=60",
    });
  } catch (err) {
    return json({ error: err?.message || String(err) }, 502);
  }
};

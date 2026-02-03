// netlify/functions/gt_search.mjs
// Netlify Functions v2: MUST return Response

const CACHE = new Map();
const CACHE_MS = 10 * 60 * 1000;

function stripHtml(s) {
  return (s || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
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

async function tryText(name, url, t) {
  const r = await fetchWithTimeout(url, t, {
    headers: {
      "user-agent": "Mozilla/5.0 (GlobalTide; Netlify)",
      "accept": "application/rss+xml, application/xml, text/xml, */*",
    },
  });
  if (!r.ok) throw new Error(`${name} not ok: ${r.status}`);
  const text = await r.text();
  if (!text || text.length < 80 || /<html/i.test(text)) {
    throw new Error(`${name} returned html/too-short`);
  }
  return text;
}

async function fetchRss(rssUrl) {
  // direct first
  try { return await tryText("direct", rssUrl, 4500); } catch (_) {}

  const proxies = [
    { name: "allorigins", url: `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`, t: 4500 },
    { name: "corsproxy", url: `https://corsproxy.io/?${encodeURIComponent(rssUrl)}`, t: 4500 },
    { name: "codetabs", url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(rssUrl)}`, t: 9000 },
  ];

  let last = null;
  for (const p of proxies) {
    try { return await tryText(p.name, p.url, p.t); }
    catch (e) { last = e; }
  }
  throw new Error(`Failed to fetch RSS. ${last?.message || ""}`.trim());
}

function parseItems(xml, limit) {
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
  const items = [];

  for (const block of blocks.slice(0, limit)) {
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
      return m ? m[1].trim() : "";
    };
    items.push({
      title: stripHtml(get("title")),
      url: stripHtml(get("link")),
      date: stripHtml(get("pubDate")),
      source: stripHtml(get("source")),
      snippet: stripHtml(get("description")),
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

    const key = `${q.toLowerCase()}::${hl}:${gl}:${ceid}::${limit}`;
    const cached = CACHE.get(key);
    if (cached && (Date.now() - cached.ts) < CACHE_MS) {
      return json({ items: cached.items, cached: true }, 200, { "cache-control": "public, max-age=60" });
    }

    const rssUrl =
      `https://news.google.com/rss/search?q=${encodeURIComponent(q)}` +
      `&hl=${encodeURIComponent(hl)}&gl=${encodeURIComponent(gl)}&ceid=${encodeURIComponent(ceid)}`;

    const xml = await fetchRss(rssUrl);
    const items = parseItems(xml, limit);

    CACHE.set(key, { ts: Date.now(), items });

    return json({ items }, 200, { "cache-control": "public, max-age=60" });
  } catch (e) {
    return json({ error: e?.message || String(e) }, 502);
  }
};

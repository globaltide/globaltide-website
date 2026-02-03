// netlify/functions/search.js
// Node (Netlify Functions) - NO window / NO document / NO DOMParser

const CACHE = new Map(); // key -> {ts, data}
const CACHE_MS = 10 * 60 * 1000; // 10 min

function cacheKey(q, hl, gl, ceid, limit, translate) {
  return `${(q||"").toLowerCase()}::${hl}:${gl}:${ceid}::${limit}::${translate}`;
}

function stripHtml(s) {
  return (s || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

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
      // 일부 upstream이 UA 없으면 막는 경우가 있어 명시
      "User-Agent": "Mozilla/5.0 (Netlify Function; GlobalTide)"
    }
  });

  if (!r.ok) throw new Error(`${name} not ok: ${r.status}`);

  const text = await r.text();

  // HTML/짧은 텍스트 차단 페이지 방어
  if (!text || text.length < 80 || /<html/i.test(text)) {
    throw new Error(`${name} returned html/too-short`);
  }

  return text;
}

async function fetchRssText(rssUrl) {
  // 1) direct
  try {
    return await tryFetchText("direct", rssUrl, 4500);
  } catch (e) {
    // fallback to proxies
  }

  const fast = [
    { name: "allorigins", url: `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`, t: 4500 },
    { name: "corsproxy.io", url: `https://corsproxy.io/?${encodeURIComponent(rssUrl)}`, t: 4500 },
  ];
  const slow = [
    { name: "codetabs", url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(rssUrl)}`, t: 9000 },
  ];

  let lastErr = null;
  for (const p of fast) {
    try { return await tryFetchText(p.name, p.url, p.t); }
    catch (e) { lastErr = e; }
  }
  for (const p of slow) {
    try { return await tryFetchText(p.name, p.url, p.t); }
    catch (e) { lastErr = e; }
  }

  throw new Error(`Failed to fetch RSS. ${lastErr?.message || ""}`.trim());
}

// 매우 가벼운 RSS 파서 (정규식 기반)
// Google News RSS 구조에 맞게 item 단위로 뽑음
function parseRssItems(xmlText, limit = 30) {
  const items = [];
  const itemMatches = xmlText.match(/<item>[\s\S]*?<\/item>/gi) || [];

  for (const block of itemMatches.slice(0, limit)) {
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
      return m ? m[1].trim() : "";
    };

    const title = stripHtml(get("title"));
    const link = stripHtml(get("link"));
    const pubDate = stripHtml(get("pubDate"));
    const source = stripHtml(get("source"));
    const descRaw = get("description");
    const desc = stripHtml(descRaw);

    items.push({
      title,
      url: link,
      source,
      date: pubDate,
      snippet: desc
    });
  }

  return items;
}

export default async (req) => {
  try {
    const q = (req.queryStringParameters?.q || "").trim();
    if (!q) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({ items: [] })
      };
    }

    const hl = req.queryStringParameters?.hl || "en";
    const gl = req.queryStringParameters?.gl || "US";
    const ceid = req.queryStringParameters?.ceid || "US:en";
    const limit = Math.min(parseInt(req.queryStringParameters?.limit || "30", 10) || 30, 50);
    const translate = req.queryStringParameters?.translate === "1";

    const key = cacheKey(q, hl, gl, ceid, limit, translate);
    const cached = CACHE.get(key);
    if (cached && (Date.now() - cached.ts) < CACHE_MS) {
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=60"
        },
        body: JSON.stringify({ items: cached.data, cached: true })
      };
    }

    const rssUrl =
      `https://news.google.com/rss/search?q=${encodeURIComponent(q)}` +
      `&hl=${encodeURIComponent(hl)}&gl=${encodeURIComponent(gl)}&ceid=${encodeURIComponent(ceid)}`;

    const xmlText = await fetchRssText(rssUrl);
    const items = parseRssItems(xmlText, limit);

    // (선택) 번역은 여기서 처리 가능하지만, 우선은 서버 번역 없이 내려보내도 됨.
    // translate=1 옵션이 와도 지금은 패스(원하면 다음 단계에서 추가)
    // if (translate) { ... items에 titleKo/snippetKo 붙이기 ... }

    CACHE.set(key, { ts: Date.now(), data: items });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60"
      },
      body: JSON.stringify({ items })
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({
        error: err?.message || String(err)
      })
    };
  }
};

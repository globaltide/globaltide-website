function stripHtml(s) {
  return (s || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isKorean(text) {
  return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(text);
}

// ====== in-memory cache (same session) ======
const _cache = new Map(); // key -> { ts, items }
const CACHE_MS = 10 * 60 * 1000; // 10 min

function cacheKey(q, params) {
  return `${params.ceid}::${q.toLowerCase()}`;
}

async function fetchWithTimeout(url, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function tryProxy(name, url, timeoutMs) {
  const r = await fetchWithTimeout(url, timeoutMs);
  if (!r.ok) throw new Error(`${name} not ok: ${r.status}`);
  const text = await r.text();

  // 차단 HTML/너무 짧은 응답은 실패 처리
  if (!text || text.length < 80 || /<html/i.test(text)) {
    throw new Error(`${name} returned html/too-short`);
  }
  return text;
}

async function fetchRssViaFreeProxy(rssUrl) {
  // ✅ fast tier (짧은 timeout) — 체감 속도 핵심
  const fast = [
    { name: "allorigins", url: `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`, t: 3500 },
    { name: "corsproxy.io", url: `https://corsproxy.io/?${encodeURIComponent(rssUrl)}`, t: 3500 },
  ];

  // ✅ slow tier (백업) — fast가 실패할 때만
  const slow = [
    { name: "codetabs", url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(rssUrl)}`, t: 9000 },
    { name: "jina", url: `https://r.jina.ai/http://${rssUrl.replace(/^https?:\/\//, "")}`, t: 9000 },
  ];

  // 1) fast tier 순차
  let lastErr = null;
  for (const p of fast) {
    try {
      return await tryProxy(p.name, p.url, p.t);
    } catch (e) {
      lastErr = e;
    }
  }

  // 2) slow tier 순차
  for (const p of slow) {
    try {
      return await tryProxy(p.name, p.url, p.t);
    } catch (e) {
      lastErr = e;
    }
  }

  throw new Error(`Failed to fetch. ${lastErr?.message || ""}`.trim());
}

export async function searchNews(query) {
  const q = (query || "").trim();
  if (!q) return [];

  const korean = isKorean(q);
  const params = korean
    ? { hl: "ko", gl: "KR", ceid: "KR:ko" }
    : { hl: "en", gl: "US", ceid: "US:en" };

  // ✅ 캐시 hit면 즉시 반환
  const key = cacheKey(q, params);
  const cached = _cache.get(key);
  if (cached && (Date.now() - cached.ts) < CACHE_MS) {
    return cached.items;
  }

  const rssUrl =
    `https://news.google.com/rss/search?q=${encodeURIComponent(q)}` +
    `&hl=${params.hl}&gl=${params.gl}&ceid=${params.ceid}`;

  const xmlText = await fetchRssViaFreeProxy(rssUrl);

  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    throw new Error(`XML parse error: ${parserError.textContent.slice(0, 200)}`);
  }

  const nodes = Array.from(doc.querySelectorAll("item"));
  const items = nodes.map((it) => {
    const title = it.querySelector("title")?.textContent?.trim() || "";
    const link = it.querySelector("link")?.textContent?.trim() || "";
    const pubDate = it.querySelector("pubDate")?.textContent?.trim() || "";
    const source = it.querySelector("source")?.textContent?.trim() || "";
    const desc = stripHtml(it.querySelector("description")?.textContent || "");
    return { title, url: link, source, date: pubDate, snippet: desc };
  });

  // ✅ 캐시 저장
  _cache.set(key, { ts: Date.now(), items });

  return items;
}

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

// start/end: YYYY-MM-DD 를 Date(UTC 자정)로 변환
function parseYmdToUtcDate(ymd) {
  if (!ymd) return null;
  const m = String(ymd).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  // UTC 기준 자정
  return new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0));
}

function inRange(pubDateStr, startUtc, endUtcInclusive) {
  if (!startUtc && !endUtcInclusive) return true;
  const t = Date.parse(pubDateStr || "");
  if (!Number.isFinite(t)) return true; // 파싱 실패하면 일단 통과 (너무 많이 걸러지면 결과 0 되는 문제 방지)

  const dt = new Date(t);

  if (startUtc && dt < startUtc) return false;

  if (endUtcInclusive) {
    // inclusive: end 날짜의 23:59:59.999 UTC까지 허용
    const endMax = new Date(endUtcInclusive.getTime() + 24 * 60 * 60 * 1000 - 1);
    if (dt > endMax) return false;
  }
  return true;
}

export default async (request) => {
  try {
    const u = new URL(request.url);
    const qRaw = (u.searchParams.get("q") || "").trim();
    if (!qRaw) return json({ items: [] });

    const hl = u.searchParams.get("hl") || "en";
    const gl = u.searchParams.get("gl") || "US";
    const ceid = u.searchParams.get("ceid") || "US:en";
    const limit = Math.min(parseInt(u.searchParams.get("limit") || "30", 10) || 30, 50);

    // ✅ 추가: 날짜 파라미터 (YYYY-MM-DD)
    const start = (u.searchParams.get("start") || "").trim();
    const end = (u.searchParams.get("end") || "").trim();

    const startUtc = parseYmdToUtcDate(start);
    const endUtc = parseYmdToUtcDate(end);

    // ✅ 구글 RSS 검색어에 기간 필터를 붙임
    // before 는 보통 exclusive로 동작할 수 있어 end 다음날로 넣는게 안전
    let q = qRaw;
    if (startUtc) q += ` after:${start}`;
    if (endUtc) {
      const endPlus1 = new Date(endUtc.getTime() + 24 * 60 * 60 * 1000);
      const y = endPlus1.getUTCFullYear();
      const m = String(endPlus1.getUTCMonth() + 1).padStart(2, "0");
      const d = String(endPlus1.getUTCDate()).padStart(2, "0");
      q += ` before:${y}-${m}-${d}`;
    }

    // ✅ 캐시 키에 start/end 포함
    const key = `${q.toLowerCase()}::${hl}:${gl}:${ceid}::${limit}::${start || "-"}::${end || "-"}`;
    const cached = CACHE.get(key);
    if (cached && (Date.now() - cached.ts) < CACHE_MS) {
      return json({ items: cached.items, cached: true }, 200, { "cache-control": "public, max-age=60" });
    }

    const rssUrl =
      `https://news.google.com/rss/search?q=${encodeURIComponent(q)}` +
      `&hl=${encodeURIComponent(hl)}&gl=${encodeURIComponent(gl)}&ceid=${encodeURIComponent(ceid)}`;

    const xml = await fetchRss(rssUrl);

    // RSS 자체 필터가 완벽하지 않을 수 있어 넉넉히 받아서 서버에서 2차 필터
    const rawItems = parseItems(xml, 50);
    const filtered = rawItems.filter(it => inRange(it.date, startUtc, endUtc));
    const items = filtered.slice(0, limit);

    CACHE.set(key, { ts: Date.now(), items });

    return json({ items }, 200, { "cache-control": "public, max-age=60" });
  } catch (e) {
    return json({ error: e?.message || String(e) }, 502);
  }
};
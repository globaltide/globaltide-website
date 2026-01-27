// netlify/functions/web-search.js
import fetch from "node-fetch";

const DEFAULT_LIMIT = 12;
const TIMEOUT_MS = 9000;

// ---------- utils ----------
function withTimeout(promise, ms = TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return {
    signal: ctrl.signal,
    run: (async () => {
      try {
        return await promise(ctrl.signal);
      } finally {
        clearTimeout(t);
      }
    })(),
  };
}

function j(statusCode, bodyObj, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
    body: JSON.stringify(bodyObj),
  };
}

function norm(s) {
  return (s ?? "").toString().trim();
}

function take(arr, n) {
  return Array.isArray(arr) ? arr.slice(0, n) : [];
}

// ---------- GDELT (news) ----------
async function searchGDELT(q, limit, debug) {
  // GDELT 2.1 DOC API (free)
  // format=json, mode=ArtList gives article list
  // sort=datedesc: 최신순
  const url =
    "https://api.gdeltproject.org/api/v2/doc/doc" +
    `?query=${encodeURIComponent(q)}` +
    `&mode=ArtList` +
    `&format=json` +
    `&sort=datedesc` +
    `&maxrecords=${encodeURIComponent(limit)}`;

  const { run } = withTimeout(async (signal) => {
    const res = await fetch(url, { signal });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text, url };
  });

  const out = await run;

  if (!out.ok) {
    return { ok: false, source: "gdelt", error: `Upstream ${out.status}`, detail: debug ? out.text.slice(0, 600) : "" };
  }

  let data;
  try {
    data = JSON.parse(out.text);
  } catch (e) {
    return { ok: false, source: "gdelt", error: "Invalid JSON", detail: debug ? out.text.slice(0, 600) : "" };
  }

  const articles = take(data?.articles || [], limit).map((a) => ({
    title: norm(a.title),
    url: norm(a.url),
    source: norm(a.sourceCountry) ? `GDELT · ${a.sourceCountry}` : "GDELT",
    date: norm(a.seendate) || norm(a.socialimage) || "", // seendate가 보통 있음
    snippet: norm(a.description) || norm(a.snippet) || "",
  }));

  return { ok: true, source: "gdelt", items: articles, meta: debug ? { url: out.url } : undefined };
}

// ---------- Wikipedia (fallback) ----------
async function searchWikipedia(q, limit, debug) {
  // Wikipedia search API (free)
  // We fetch summary for each top title
  const searchUrl =
    "https://en.wikipedia.org/w/api.php" +
    `?action=query&list=search&srsearch=${encodeURIComponent(q)}` +
    `&utf8=1&format=json&srlimit=${encodeURIComponent(Math.min(limit, 8))}`;

  const { run } = withTimeout(async (signal) => {
    const res = await fetch(searchUrl, { signal });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text, searchUrl };
  });

  const out = await run;

  if (!out.ok) {
    return { ok: false, source: "wikipedia", error: `Upstream ${out.status}`, detail: debug ? out.text.slice(0, 600) : "" };
  }

  let data;
  try {
    data = JSON.parse(out.text);
  } catch (e) {
    return { ok: false, source: "wikipedia", error: "Invalid JSON", detail: debug ? out.text.slice(0, 600) : "" };
  }

  const hits = take(data?.query?.search || [], limit);

  const items = hits.map((h) => {
    const title = norm(h.title);
    const url = title ? `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}` : "";
    const snippet = norm(h.snippet).replace(/<\/?[^>]+(>|$)/g, ""); // html strip
    return {
      title,
      url,
      source: "Wikipedia",
      date: "",
      snippet,
    };
  });

  return { ok: true, source: "wikipedia", items, meta: debug ? { searchUrl: out.searchUrl } : undefined };
}

// ---------- handler ----------
export async function handler(event) {
  try {
    const q = norm(event.queryStringParameters?.q);
    const limit = Math.min(parseInt(event.queryStringParameters?.limit || `${DEFAULT_LIMIT}`, 10) || DEFAULT_LIMIT, 20);
    const debug = event.queryStringParameters?.debug === "1";

    if (!q) return j(400, { error: "Missing q" });

    // 1) GDELT 먼저
    const gd = await searchGDELT(q, limit, debug);
    if (gd.ok && gd.items.length > 0) {
      return j(200, { q, count: gd.items.length, source: gd.source, items: gd.items, ...(debug ? { debug: gd.meta } : {}) });
    }

    // 2) GDELT 실패 또는 결과 0개면 Wikipedia fallback
    const wk = await searchWikipedia(q, limit, debug);
    if (wk.ok && wk.items.length > 0) {
      return j(200, {
        q,
        count: wk.items.length,
        source: wk.source,
        items: wk.items,
        fallback_from: gd.source,
        ...(debug ? { debug: { gdelt_error: gd.error, gdelt_detail: gd.detail, ...wk.meta } } : {}),
      });
    }

    // 둘 다 실패/0개
    return j(200, {
      q,
      count: 0,
      source: "none",
      items: [],
      ...(debug
        ? { debug: { gdelt: gd, wikipedia: wk } }
        : { note: "No results from GDELT, fallback Wikipedia also returned no results." }),
    });
  } catch (e) {
    return j(500, { error: e?.message || String(e) });
  }
}

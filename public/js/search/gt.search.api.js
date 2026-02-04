// public/js/search/gt.search.api.js

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

function isKorean(text){
  return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(text || "");
}

function decodeHtmlEntities(s){
  if (!s) return "";
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(s){
  return (s || "").replace(/<[^>]*>/g, " ");
}

function cleanText(s){
  return (s || "").replace(/\s+/g, " ").trim();
}

function summarizeTo100(text){
  const t = cleanText(text);
  if (!t) return "";
  if (t.length <= 100) return t;

  const cut = t.slice(0, 160);
  const idx = Math.max(
    cut.lastIndexOf(". "),
    cut.lastIndexOf("? "),
    cut.lastIndexOf("! "),
    cut.lastIndexOf("· "),
    cut.lastIndexOf(" - "),
    cut.lastIndexOf(" — ")
  );
  const base = (idx > 40) ? cut.slice(0, idx + 1) : cut;
  return base.slice(0, 100).trim();
}

const _translationCache = new Map();
async function translateToKo(text){
  const t = (text || "").trim();
  if (!t) return "";
  if (t.length < 3) return t;

  if (_translationCache.has(t)) return _translationCache.get(t);

  try{
    const url =
      "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=" +
      encodeURIComponent(t);

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return "";
    const data = await res.json().catch(() => null);
    const out = data?.[0]?.[0]?.[0];
    const ko = (typeof out === "string") ? out : "";
    if (ko) _translationCache.set(t, ko);
    return ko;
  }catch(_){
    return "";
  }
}

async function fetchWithTimeout(url, ms){
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try{
    return await fetch(url, { signal: ctrl.signal, cache: "no-store" });
  } finally{
    clearTimeout(t);
  }
}

async function safeJson(res){
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (!ct.includes("application/json")){
    const txt = await res.text().catch(() => "");
    throw new Error(`non-json (${res.status}): ${txt.slice(0, 160)}`);
  }
  return await res.json();
}

async function mapWithConcurrency(arr, n, fn){
  const out = new Array(arr.length);
  let i = 0;
  const workers = new Array(Math.min(n, arr.length)).fill(0).map(async () => {
    while (i < arr.length){
      const idx = i++;
      out[idx] = await fn(arr[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Calls Netlify Function: /.netlify/functions/gt_search
 * Returns items with snippet + snippetKo (for english query)
 *
 * ✅ 추가: startDate/endDate (YYYY-MM-DD) 를 넘기면 서버에서 기간 필터 적용
 */
export async function gtSearchNews(
  query,
  { limit = 30, startDate = "", endDate = "" } = {}
){
  const q = (query || "").trim();
  if (!q) return [];

  const koreanQuery = isKorean(q);

  const params = koreanQuery
    ? { hl: "ko", gl: "KR", ceid: "KR:ko" }
    : { hl: "en", gl: "US", ceid: "US:en" };

  const qs = new URLSearchParams({
    q,
    hl: params.hl,
    gl: params.gl,
    ceid: params.ceid,
    limit: String(Math.min(50, Math.max(1, Number(limit) || 30))),
  });

  // ✅ 날짜 전달 (서버에서 start/end로 받음)
  if ((startDate || "").trim()) qs.set("start", String(startDate).trim());
  if ((endDate || "").trim())   qs.set("end",   String(endDate).trim());

  const url = "/.netlify/functions/gt_search?" + qs.toString();

  let lastErr = null;

  // ✅ intermittent 방어: 3회 재시도
  for (let attempt = 0; attempt < 3; attempt++){
    try{
      if (attempt > 0){
        const backoff =
          Math.min(2500, 600 * Math.pow(2, attempt - 1)) +
          Math.floor(Math.random() * 150);
        await sleep(backoff);
      }

      const res = await fetchWithTimeout(url, 12000);
      const j = await safeJson(res);
      if (!res.ok) throw new Error(j?.error || `http ${res.status}`);

      let items = Array.isArray(j.items) ? j.items : [];

      // ✅ 1) &lt;a href... 제거: entity decode -> stripHtml -> clean
      items = items.map(it => {
        const raw = it?.snippet || "";
        const decoded = decodeHtmlEntities(raw);
        const stripped = stripHtml(decoded);
        const snippet = cleanText(stripped);
        return { ...it, snippet };
      });

      // ✅ 2) 영어 검색이면: snippet을 100자 내 요약 -> 번역해서 snippetKo 생성 (최대 15개)
      if (!koreanQuery && items.length){
        const head = items.slice(0, Math.min(15, items.length));
        const tail = items.slice(head.length);

        const enriched = await mapWithConcurrency(head, 4, async (it) => {
          const base = summarizeTo100(it.snippet || it.title || "");
          const ko = await translateToKo(base);
          return { ...it, snippetKo: ko || "" };
        });

        items = [...enriched, ...tail];
      }

      return items;
    }catch(e){
      lastErr = e;
    }
  }

  throw lastErr || new Error("gt_search failed");
}
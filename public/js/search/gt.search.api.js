// public/js/search/gt.search.api.js

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

function isKorean(text){
  return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(text || "");
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

/**
 * Calls Netlify Function: /.netlify/functions/gt_search
 * Returns: array of { title, url, date, source, snippet }
 */
export async function gtSearchNews(query, { limit = 30 } = {}){
  const q = (query || "").trim();
  if (!q) return [];

  const korean = isKorean(q);
  const params = korean
    ? { hl: "ko", gl: "KR", ceid: "KR:ko" }
    : { hl: "en", gl: "US", ceid: "US:en" };

  const url =
    "/.netlify/functions/gt_search?" +
    new URLSearchParams({
      q,
      hl: params.hl,
      gl: params.gl,
      ceid: params.ceid,
      limit: String(Math.min(50, Math.max(1, Number(limit) || 30))),
    }).toString();

  let lastErr = null;

  // ✅ intermittent 방어: 3회 재시도 + 지수 backoff
  for (let attempt = 0; attempt < 3; attempt++){
    try{
      if (attempt > 0){
        const backoff =
          Math.min(2500, 600 * Math.pow(2, attempt - 1)) +
          Math.floor(Math.random() * 150);
        await sleep(backoff);
      }

      const res = await fetchWithTimeout(url, 12000);

      const ct = (res.headers.get("content-type") || "").toLowerCase();
      if (!ct.includes("application/json")){
        const txt = await res.text().catch(() => "");
        throw new Error(`non-json (${res.status}): ${txt.slice(0, 160)}`);
      }

      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || `http ${res.status}`);

      const items = Array.isArray(j.items) ? j.items : [];
      return items;
    } catch(e){
      lastErr = e;
    }
  }

  throw lastErr || new Error("gt_search failed");
}

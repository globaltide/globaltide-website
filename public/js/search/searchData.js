function isKorean(text) {
  return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(text || "");
}

// ====== in-memory cache (same session) ======
const _cache = new Map(); // key -> { ts, items }
const CACHE_MS = 10 * 60 * 1000; // 10 min

function cacheKey(q, params) {
  // q + locale params
  return `${params.ceid}::${q.toLowerCase()}`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJsonWithTimeout(url, ms, fetchOptions = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      ...fetchOptions,
      signal: ctrl.signal,
      // 캐시/프록시 이슈 완화
      cache: "no-store",
    });

    const ct = (res.headers.get("content-type") || "").toLowerCase();

    // JSON이 아닌 응답(HTML 에러 페이지 등)은 즉시 실패 처리
    if (!ct.includes("application/json")) {
      const text = await res.text().catch(() => "");
      const preview = (text || "").slice(0, 120);
      throw new Error(`non-json response: ${res.status} ${preview}`);
    }

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson?.error || `http ${res.status}`);
    }

    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function fetchJsonWithRetry(url, {
  timeoutMs = 8000,
  retries = 2,
  baseDelayMs = 500,
  maxDelayMs = 2500,
} = {}) {
  let lastErr = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // 지터로 동시 실패(스파이크) 완화
      const jitter = Math.floor(Math.random() * 120);
      if (attempt > 0) {
        const backoff = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1)) + jitter;
        await sleep(backoff);
      }
      return await fetchJsonWithTimeout(url, timeoutMs);
    } catch (e) {
      lastErr = e;
    }
  }

  throw new Error(lastErr?.message || "failed to fetch json");
}

function normalizeItems(payload) {
  // payload가 배열이거나 {items:[...]} 형태 모두 지원
  const arr = Array.isArray(payload) ? payload : (payload?.items || []);
  if (!Array.isArray(arr)) return [];

  return arr.map((x) => ({
    title: x.title || "",
    url: x.url || x.link || "",
    source: x.source || "",
    date: x.date || x.pubDate || "",
    snippet: x.snippet || x.description || "",
    // 서버가 번역해서 내려주면 그대로 사용
    titleKo: x.titleKo,
    snippetKo: x.snippetKo,
  }));
}

/**
 * searchNews(query)
 * - 외부(구글뉴스/프록시/번역) 직접 호출 금지
 * - Netlify function: /.netlify/functions/search 로만 호출
 */
export async function searchNews(query) {
  const q = (query || "").trim();
  if (!q) return [];

  const korean = isKorean(q);
  const params = korean
    ? { hl: "ko", gl: "KR", ceid: "KR:ko" }
    : { hl: "en", gl: "US", ceid: "US:en" };

  // 캐시 hit면 즉시 반환
  const key = cacheKey(q, params);
  const cached = _cache.get(key);
  if (cached && (Date.now() - cached.ts) < CACHE_MS) {
    return cached.items;
  }

  // ✅ 프론트는 Netlify function만 호출
  // function이 내부에서 RSS/본문/번역 등을 처리해야 함
  const url =
    "/.netlify/functions/search?" +
    new URLSearchParams({
      q,
      hl: params.hl,
      gl: params.gl,
      ceid: params.ceid,
      // 서버에서 번역 처리 권장 (영문 검색이면 ko 번역 내려주기)
      translate: korean ? "0" : "1",
      // 필요하면 서버에서 max 제한
      limit: "30",
    }).toString();

  const payload = await fetchJsonWithRetry(url, {
    timeoutMs: 9000,
    retries: 2,
    baseDelayMs: 500,
    maxDelayMs: 2500,
  });

  const items = normalizeItems(payload);

  // 캐시 저장
  _cache.set(key, { ts: Date.now(), items });

  return items;
}

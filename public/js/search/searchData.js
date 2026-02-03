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

// ====== translation cache ======
const _translationCache = new Map();

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
  if (!text || text.length < 80 || /<html/i.test(text)) {
    throw new Error(`${name} returned html/too-short`);
  }
  return text;
}

async function fetchRssViaFreeProxy(rssUrl) {
  const fast = [
    { name: "allorigins", url: `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`, t: 3500 },
    { name: "corsproxy.io", url: `https://corsproxy.io/?${encodeURIComponent(rssUrl)}`, t: 3500 },
  ];
  const slow = [
    { name: "codetabs", url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(rssUrl)}`, t: 9000 },
  ];
  
  let lastErr = null;
  for (const p of fast) {
    try {
      return await tryProxy(p.name, p.url, p.t);
    } catch (e) {
      lastErr = e;
    }
  }
  for (const p of slow) {
    try {
      return await tryProxy(p.name, p.url, p.t);
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`Failed to fetch. ${lastErr?.message || ""}`.trim());
}

// ====== Translation functions ======
async function translateText(text) {
  if (!text) return text;
  
  // 한글이면 번역 안함
  if (isKorean(text)) return text;
  
  // 캐시 확인
  if (_translationCache.has(text)) {
    return _translationCache.get(text);
  }

  try {
    const encodedText = encodeURIComponent(text);
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=' + encodedText;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data && data[0] && data[0][0] && data[0][0][0]) {
      const translated = data[0][0][0];
      _translationCache.set(text, translated);
      return translated;
    }
  } catch (error) {
    console.error('Translation error:', error);
  }
  
  return text;
}

async function translateItems(items) {
  const promises = items.map(async (item, idx) => {
    // API 레이트 리밋 방지 (100ms 간격)
    await new Promise(resolve => setTimeout(resolve, idx * 100));
    
    const titleKo = await translateText(item.title);
    const snippetKo = item.snippet ? await translateText(item.snippet.substring(0, 200)) : '';
    
    return {
      ...item,
      titleKo,
      snippetKo
    };
  });

  return await Promise.all(promises);
}

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
  
  // 번역 (영어 검색일 때만, 최대 15개)
  let finalItems = items;
  if (!korean && items.length > 0) {
    const itemsToTranslate = items.slice(0, 15);
    const translatedItems = await translateItems(itemsToTranslate);
    const remainingItems = items.slice(15);
    finalItems = [...translatedItems, ...remainingItems];
  }
  
  // 캐시 저장
  _cache.set(key, { ts: Date.now(), items: finalItems });
  
  return finalItems;
}

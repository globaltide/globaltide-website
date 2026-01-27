// netlify/functions/investor-news.js
// Google News RSS -> JSON
// Features:
// 1) URL canonicalization + exact dedup
// 2) Similarity clustering (cross-publisher same-story filter)
// 3) Negative keyword exclusion (optional RFP bypass)

const { XMLParser } = require("fast-xml-parser");

const CACHE_MS = 3 * 60 * 1000; // 3 minutes
let cache = { ts: 0, payload: null };

function nowISO() {
  return new Date().toISOString();
}

function stripHtml(s) {
  return (s || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalizeUrl(url) {
  try {
    const u = new URL(url);
    const drop = [
      "utm_source","utm_medium","utm_campaign","utm_term","utm_content",
      "gclid","fbclid","mc_cid","mc_eid","ref","ref_src"
    ];
    drop.forEach(k => u.searchParams.delete(k));
    u.hash = "";
    return u.toString();
  } catch {
    return (url || "").trim();
  }
}

function normalizeTitle(title) {
  return (title || "")
    .toLowerCase()
    .replace(/[“”"']/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function makeDedupKey(item) {
  const cu = canonicalizeUrl(item.url || "");
  if (cu) return "u:" + cu;
  const t = normalizeTitle(item.title || "");
  const d = (item.date || "").slice(0, 10);
  return "t:" + t + "|" + d;
}

function dedupExact(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const k = makeDedupKey(it);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }

  // Second pass: same normalized title + day
  const seen2 = new Set();
  const out2 = [];
  for (const it of out) {
    const t = normalizeTitle(it.title || "");
    const d = (it.date || "").slice(0, 10);
    const k2 = t ? `td:${t}|${d}` : "";
    if (k2) {
      if (seen2.has(k2)) continue;
      seen2.add(k2);
    }
    out2.push(it);
  }
  return out2;
}

/** ---------- Similarity (cross-publisher same-story) ---------- **/

const STOPWORDS_EN = new Set([
  "the","a","an","and","or","to","of","in","on","for","with","by","from","at","as",
  "is","are","was","were","be","been","being",
  "this","that","these","those",
  "it","its","their","they","them","we","our",
  "will","would","can","could","may","might","should",
  "new","says","said","report","reports","reported","update",
]);

const STOPWORDS_KO = new Set([
  "및","과","와","또는","혹은","대한","관련","등","것","수","중","내","외","더","큰","새","발표",
  "기자","뉴스","단독","속보","인터뷰","분석","전망","공개","확인","밝혔다","했다","한다","했다며",
  "올해","내년","이번","지난","오늘","어제",
]);

function tokenize(text) {
  const s = (text || "").toLowerCase();
  // keep letters/numbers/spaces (ko/en)
  const clean = s
    .replace(/[“”"']/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) return [];

  const raw = clean.split(" ").filter(Boolean);

  // basic stopword removal + length filter
  const tokens = [];
  for (const w of raw) {
    if (w.length <= 1) continue;

    // english stopwords
    if (/^[a-z]+$/.test(w) && STOPWORDS_EN.has(w)) continue;

    // korean stopwords (exact match)
    if (STOPWORDS_KO.has(w)) continue;

    tokens.push(w);
  }

  return tokens;
}

function jaccard(aSet, bSet) {
  if (!aSet.size || !bSet.size) return 0;
  let inter = 0;
  for (const x of aSet) if (bSet.has(x)) inter++;
  const union = aSet.size + bSet.size - inter;
  return union ? inter / union : 0;
}

/**
 * Cluster same-day similar stories and keep 1 representative.
 * Why same-day: prevents over-aggregating recurring topics.
 */
function dedupSimilarSameDay(items, opts = {}) {
  const {
    threshold = 0.62,       // higher => stricter (fewer merges)
    minTokens = 6,          // avoid merging too-short titles
    keepPerCluster = 1,
  } = opts;

  // group by date (YYYY-MM-DD)
  const byDay = new Map();
  for (const it of items) {
    const d = (it.date || "").slice(0, 10) || "unknown";
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(it);
  }

  const out = [];

  for (const [day, arr] of byDay.entries()) {
    // sort within day by timestamp desc so best "latest" tends to win
    arr.sort((a, b) => (b._ts || 0) - (a._ts || 0));

    const clusters = []; // { rep, repSet, members[] }

    for (const it of arr) {
      const baseText = `${it.title || ""} ${it.body || ""}`;
      const toks = tokenize(baseText);

      // if too short, don't cluster aggressively
      if (toks.length < minTokens) {
        clusters.push({ rep: it, repSet: new Set(toks), members: [it] });
        continue;
      }

      const tSet = new Set(toks);

      let placed = false;
      for (const c of clusters) {
        const score = jaccard(c.repSet, tSet);
        if (score >= threshold) {
          c.members.push(it);
          // keep the rep as first (already sorted newest), but expand token set for robustness
          for (const t of tSet) c.repSet.add(t);
          placed = true;
          break;
        }
      }

      if (!placed) {
        clusters.push({ rep: it, repSet: tSet, members: [it] });
      }
    }

    // pick representative(s) per cluster (default 1)
    for (const c of clusters) {
      const members = c.members;
      // already newest-first
      out.push(...members.slice(0, keepPerCluster));
    }
  }

  return out;
}

/** ---------- Negative keyword filter ---------- **/

// Tune freely. Keep it conservative to avoid deleting too much.
const NEGATIVE_PATTERNS = [
  // KR
  "부도","파산","디폴트","연체","위기","충격","급락","폭락","붕괴","손실","적자","사기","횡령","배임",
  "구속","기소","수사","압수수색","징역","벌금","제재","징계","취소","중단","철회",
  "불법","논란","리콜","사망","사고","참사","감원","구조조정","파업","해고",
  "피해자","뒷전","워싱","민주당","국민의힘","국회","우려","불과","무색","죄송","질타","부실선정",
  // EN 는 금지어 없음

];

function hasNegative(text) {
  const t = (text || "").toLowerCase();
  return NEGATIVE_PATTERNS.some(k => t.includes(k.toLowerCase()));
}

/** ---------- Classification ---------- **/

function labels() {
  return {
    region: { korea: "Korea", global: "Global", all: "All" },
    type: { deploy: "투자 집행", news: "소식", perf: "실적", rfp: "RFP" },
    inst: {
      bank: "은행",
      central: "중앙회",
      mutual: "공제회",
      pension: "연기금",
      insurance: "보험사",
      capital: "캐피탈",
      swf: "SWF",
      endowment: "Endowment",
      all: "All"
    },
    asset: { pd:"PD", re:"RE", pe:"PE", vc:"VC", infra:"Infra", coin:"Coin", all:"All" }
  };
}

function googleNewsRssUrl({ q, hl, gl, ceid }) {
  const qp = encodeURIComponent(q);
  return `https://news.google.com/rss/search?q=${qp}&hl=${hl}&gl=${gl}&ceid=${ceid}`;
}

const FEEDS = [
  // Korea investor actions/news
  { id: "kr_investor_actions", region: "korea",  q: "국민연금 투자 집행 OR 공제회 투자 OR 보험사 대체투자 OR 출자사업", hl:"ko", gl:"KR", ceid:"KR:ko" },
  { id: "kr_investor_news",    region: "korea",  q: "국민연금 OR KIC OR 공제회 OR 보험사 운용사 선정 OR 위탁운용사", hl:"ko", gl:"KR", ceid:"KR:ko" },

  // Global investor actions/news/performance
  { id: "gl_investor_actions", region: "global", q: "pension fund commits OR allocates OR invests in private credit OR direct lending", hl:"en", gl:"US", ceid:"US:en" },
  { id: "gl_investor_news",    region: "global", q: "pension fund OR insurance company manager search OR investor intentions", hl:"en", gl:"US", ceid:"US:en" },
  { id: "gl_performance",      region: "global", q: "pension fund returns fiscal year OR annual report returns", hl:"en", gl:"US", ceid:"US:en" },

  // RFP
  { id: "rfp_kr",              region: "korea",  q: "위탁운용사 모집 공고 OR 출자사업 공고 OR 제안서 RFP", hl:"ko", gl:"KR", ceid:"KR:ko" },
  { id: "rfp_gl",              region: "global", q: "RFP manager search mandate pension fund private debt", hl:"en", gl:"US", ceid:"US:en" },
];

async function fetchRss(url) {
  const res = await fetch(url, { headers: { "user-agent": "globaltide/1.0" } });
  if (!res.ok) throw new Error(`rss fetch failed: ${res.status}`);
  return await res.text();
}

function parseRss(xml) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    allowBooleanAttributes: true
  });
  const obj = parser.parse(xml);
  const channel = obj?.rss?.channel;
  const items = channel?.item ? (Array.isArray(channel.item) ? channel.item : [channel.item]) : [];
  const sourceTitle = channel?.title || "Google News";
  return { sourceTitle, items };
}

function isRfpText(title, desc) {
  const t = (title + " " + desc).toLowerCase();
  const kws = [
    "rfp","request for proposal","tender","invitation to bid","manager search","mandate",
    "제안","제안서","제안 요청","위탁운용","위탁운용사","모집","공고","입찰","선정","출자사업"
  ];
  return kws.some(k => t.includes(k.toLowerCase()));
}

function guessType(title, desc, rfp) {
  const t = (title + " " + desc).toLowerCase();
  if (rfp) return "rfp";
  if (/(return|returns|performance|aum|earnings|results|fiscal year|annual report|q[1-4])/i.test(t)) return "perf";
  if (/(commit|commits|allocate|allocation|invests|investment|acquires|acquisition|buys|purchase|closes|close|fundraise|raises|raised|final close|first close|deploy)/i.test(t)) return "deploy";
  return "news";
}

function guessInst(title, desc) {
  const t = (title + " " + desc).toLowerCase();
  if (/(pension|retirement|teachers'|fire|police|superannuation|calpers|calstrs|trs|ers)/i.test(t)) return "pension";
  if (/(insurance|life|annuity|insurer)/i.test(t)) return "insurance";
  if (/(bank|banking)/i.test(t)) return "bank";
  if (/(sovereign|swf|sovereign wealth)/i.test(t)) return "swf";
  if (/(endowment|foundation)/i.test(t)) return "endowment";
  if (/(credit union|cooperative|mutual|공제회)/i.test(t)) return "mutual";
  if (/(중앙회|농협|수협|신협)/i.test(t)) return "central";
  return "all";
}

function guessAsset(title, desc) {
  const t = (title + " " + desc).toLowerCase();
  if (/(private debt|direct lending|private credit|credit fund|loan|middle market|mezzanine)/i.test(t)) return "pd";
  if (/(real estate|property|office|logistics|multifamily|hotel|mortgage|cre|cmbs)/i.test(t)) return "re";
  if (/(private equity|buyout|pe fund|leveraged buyout|secondary)/i.test(t)) return "pe";
  if (/(venture|vc|startup|seed|series a|series b|growth equity)/i.test(t)) return "vc";
  if (/(infrastructure|renewable|power|grid|solar|wind|data center)/i.test(t)) return "infra";
  if (/(crypto|bitcoin|ethereum|stablecoin|token)/i.test(t)) return "coin";
  return "all";
}

exports.handler = async function handler() {
  // cache hit
  if (cache.payload && Date.now() - cache.ts < CACHE_MS) {
    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=60"
      },
      body: JSON.stringify(cache.payload)
    };
  }

  try {
    const L = labels();
    const all = [];

    for (const f of FEEDS) {
      const url = googleNewsRssUrl({ q: f.q, hl: f.hl, gl: f.gl, ceid: f.ceid });
      const xml = await fetchRss(url);
      const parsed = parseRss(xml);

      for (const it of parsed.items) {
        const title = stripHtml(it.title || "");
        const link = canonicalizeUrl(it.link || "");
        const pubDate = it.pubDate || it.published || "";
        const desc = stripHtml(it.description || it.content || "");
        const source = parsed.sourceTitle || "Google News";

        const rfp = isRfpText(title, desc);
        const type = guessType(title, desc, rfp);

        const region = f.region;
        const inst = guessInst(title, desc);
        const asset = guessAsset(title, desc);

        const ts = pubDate ? new Date(pubDate).getTime() : 0;

        const item = {
          title,
          url: link,
          source,
          date: pubDate ? new Date(pubDate).toISOString().slice(0, 10) : "",
          body: desc,

          region,
          type,
          rfp,

          inst,
          asset,

          regionLabel: L.region[region] || region,
          typeLabel: L.type[type] || type,
          instLabel: L.inst[inst] || inst,
          assetLabel: L.asset[asset] || asset,

          _ts: Number.isFinite(ts) ? ts : 0
        };

        // Negative filter (default: exclude if negative AND not RFP)
        // If you want to exclude even RFP, remove `&& !item.rfp`.
        const negText = `${item.title} ${item.body}`;
        if (hasNegative(negText) && !item.rfp) continue;

        all.push(item);
      }
    }

    // 1) exact-ish dedup
    let items = dedupExact(all);

    // 2) cross-publisher same-story dedup (same-day clustering)
    items = dedupSimilarSameDay(items, {
      threshold: 0.55, // tune: 0.55 (more aggressive) ~ 0.70 (more strict)
      minTokens: 6,
      keepPerCluster: 1
    });

    // sort newest first
    items.sort((a, b) => (b._ts || 0) - (a._ts || 0));

    // trim
    const out = items.slice(0, 220).map(({ _ts, ...rest }) => rest);

    const payload = { updatedAt: nowISO(), items: out };
    cache = { ts: Date.now(), payload };

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=60"
      },
      body: JSON.stringify(payload)
    };
  } catch (e) {
    const payload = { updatedAt: nowISO(), items: [], error: String(e?.message || e) };
    return {
      statusCode: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload)
    };
  }
};

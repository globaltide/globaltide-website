/* =====================
   Config (shared)
===================== */
const SUPABASE_URL = 'https://toppqscjkkmmelpngzda.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_4eEtjEs8RtBFFWnpdTwRfg_DkXpAa7g';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* expose for modules */
window.GT_NOW = {
  sb,
  SUPABASE_URL,
  SUPABASE_ANON_KEY
};

/* =====================
   Utilities (shared)
===================== */
function fmt2(x){
  if (x == null || x === '') return '—';
  const n = Number(x);
  if (Number.isNaN(n)) return '—';
  return n.toFixed(2).replace(/\.?0+$/,'');
}
function fmtPct(x){
  if (x == null || x === '') return '—';
  const n = Number(x);
  if (Number.isNaN(n)) return '—';
  return fmt2(n) + '%';
}
function fmtInt(x){
  if (x == null) return '—';
  const n = Number(x);
  if (Number.isNaN(n)) return '—';
  return Math.round(n).toLocaleString();
}

/* FIX: null-safe show/hide to prevent crashes when an element id is missing */
function show(el){
  if (!el) return;
  el.classList.remove('hidden');
}
function hide(el){
  if (!el) return;
  el.classList.add('hidden');
}

function formatDateLabel(d){
  if (!d) return '';
  const dt = (typeof d === 'string') ? new Date(d) : d;
  if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return '';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2,'0');
  const dd = String(dt.getDate()).padStart(2,'0');
  return y + '.' + m + '.' + dd;
}

async function fetchJSON(path){
  try{
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  }catch(e){
    return null;
  }
}

window.GT_NOW_UTIL = { fmt2, fmtPct, fmtInt, show, hide, formatDateLabel, fetchJSON };

/* =====================
   State
===================== */
let currentCategory = 'Market';
let currentRange = 'Recent';
let figuresLoadedOnce = false;
let chartLoadedOnce = false;

function updateViews(){
  const vRecent = document.getElementById('viewRecent');
  const vFig    = document.getElementById('viewFigures');
  const vChart  = document.getElementById('viewChart');
  const vPh     = document.getElementById('viewPlaceholder');

  hide(vRecent); hide(vFig); hide(vChart); hide(vPh);

  if (currentCategory !== 'Market'){
    show(vPh);
    const pt = document.getElementById('placeholderText');
    if (pt) pt.textContent = currentCategory + ' · ' + currentRange + ' data is not ready yet.';
    return;
  }
  if (currentRange === 'Recent') show(vRecent);
  if (currentRange === 'Figures') show(vFig);
  if (currentRange === 'Chart') show(vChart);
}

/* =====================
   Toolbar events
===================== */
(function initToolbar(){
  document.querySelectorAll('#catSeg .btn[data-cat]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('#catSeg .btn[data-cat]').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.dataset.cat;
      const catMore = document.getElementById('catMore');
      if (catMore) catMore.value = '';
      updateViews();
      loadDataForState();
      loadHeadlines();
    });
  });

  const catMore = document.getElementById('catMore');
  if (catMore){
    catMore.addEventListener('change', (e)=>{
      const v = e.target.value;
      if (!v) return;
      document.querySelectorAll('#catSeg .btn[data-cat]').forEach(b=>b.classList.remove('active'));
      currentCategory = v;
      updateViews();
      loadDataForState();
      loadHeadlines();
    });
  }

  document.querySelectorAll('#rangeSeg .btn[data-range]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('#rangeSeg .btn[data-range]').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      currentRange = btn.dataset.range;
      updateViews();
      loadDataForState();
    });
  });
})();

/* =====================
   Recent
===================== */
async function fetchLatestMarketRow(){
  try{
    /* FIX: ensure truly latest row (order by snapshot_date desc) */
    const { data, error } = await sb
      .from('v_market_figures_120m')
      .select('snapshot_date, usdkrw_spot, kor_10y, us_10y, sofr_30d, source_type')
      .order('snapshot_date', { ascending: false })
      .limit(1);

    if (error) return { error: error.message || String(error), row: null };
    const row = (data && data.length) ? data[0] : null;
    return { error: null, row };
  }catch(e){
    return { error: String(e.message || e), row: null };
  }
}

async function loadMarketRecent(){
  const cacheKey = 'gtNowMarketRecent';
  const cachedRaw = localStorage.getItem(cacheKey);
  if (cachedRaw){
    try{
      const { data, ts } = JSON.parse(cachedRaw);
      if ((Date.now() - ts) / 1000 / 60 < 10){
        updateMarketRecentUI(data);
      }
    }catch(e){}
  }

  const [fxRes, rRes, korRes, latest] = await Promise.all([
    fetchJSON('/.netlify/functions/fx'),
    fetchJSON('/.netlify/functions/rates'),
    fetchJSON('/.netlify/functions/kor10'),
    fetchLatestMarketRow()
  ]);

  const payload = { fxRes, rRes, korRes, latest };
  updateMarketRecentUI(payload);
  try{
    localStorage.setItem(cacheKey, JSON.stringify({ data: payload, ts: Date.now() }));
  }catch(e){}
}

function updateMarketRecentUI(data){
  const { fxRes, rRes, korRes, latest } = data || {};
  const latestRow = latest && latest.row ? latest.row : null;

  const usdkrwEl = document.getElementById('usdkrwSpot');
  if (latestRow?.usdkrw_spot != null){
    if (usdkrwEl) usdkrwEl.textContent = fmt2(latestRow.usdkrw_spot);
  } else if (fxRes?.spotUSDKRW != null){
    if (usdkrwEl) usdkrwEl.textContent = fmt2(fxRes.spotUSDKRW);
  }

  const us10El = document.getElementById('us10');
  if (latestRow?.us_10y != null){
    if (us10El) us10El.textContent = fmtPct(latestRow.us_10y);
  } else if (rRes?.us10 != null){
    if (us10El) us10El.textContent = fmtPct(rRes.us10);
  }

  const sofrEl = document.getElementById('sofr30d');
  if (latestRow?.sofr_30d != null){
    if (sofrEl) sofrEl.textContent = fmtPct(latestRow.sofr_30d);
  } else if (rRes?.sofr30d != null){
    if (sofrEl) sofrEl.textContent = fmtPct(rRes.sofr30d);
  }

  const kor10El = document.getElementById('kor10');
  if (latestRow?.kor_10y != null){
    if (kor10El) kor10El.textContent = fmtPct(latestRow.kor_10y);
  } else {
    let kor10 = null;
    if (korRes){
      kor10 = korRes.y10 ?? korRes.kor10 ?? korRes.yield10 ?? null;
    }
    if (kor10 != null && kor10El) kor10El.textContent = fmtPct(kor10);
  }

  let us1 = null;
  if (rRes) us1 = rRes.us1 ?? null;

  let kor1 = null;
  if (korRes) kor1 = korRes.y1 ?? korRes.kor1 ?? korRes.yield1 ?? null;

  const basis = 0.0;  // basis adjustment (fine-tune based on actual market swap quotes)
  const swapEl = document.getElementById('usdkrwSwap1y');
  const detailEl = document.getElementById('swapDetail');

  if (us1 != null && kor1 != null){
    // Correct formula: KOR1Y - US1Y + basis
    const diff = (Number(kor1) - Number(us1)) + basis;
    if (swapEl) swapEl.textContent = fmtPct(diff);
    if (detailEl) detailEl.textContent = '( KOR1Y: ' + fmt2(kor1) + '% · US1Y: ' + fmt2(us1) + '% )';
  } else {
    if (swapEl) swapEl.textContent = '—';
    if (detailEl) detailEl.textContent = '';
  }
}

/* =====================
   Headlines
===================== */
async function loadHeadlines(){
  const loadingEl = document.getElementById('newsLoading');
  const statusEl = document.getElementById('newsStatus');
  const list = document.getElementById('newsList');

  if (loadingEl) loadingEl.style.display = 'inline';
  if (statusEl) statusEl.textContent = '';
  if (list) list.innerHTML = '';

  if (currentCategory !== 'Market'){
    if (loadingEl) loadingEl.style.display = 'none';
    if (statusEl) statusEl.textContent = currentCategory + ' headlines are coming soon.';
    return;
  }

  const rssRes = await fetchJSON('/.netlify/functions/rss');
  if (loadingEl) loadingEl.style.display = 'none';

  if (rssRes?.items?.length && list){
    rssRes.items.slice(0, 30).forEach(it=>{
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;gap:12px;margin-bottom:12px;';

      const left = document.createElement('div');
      left.style.cssText = 'min-width:0;flex:1;';
      
      const a = document.createElement('a');
      a.href = it.link;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = it.title;
      a.style.cssText = 'font-size:13px;color:#0066cc;text-decoration:none;';
      a.onmouseover = function(){ this.style.textDecoration = 'underline'; };
      a.onmouseout = function(){ this.style.textDecoration = 'none'; };
      left.appendChild(a);
      
      if (it.summary && it.summary !== it.title) {
        const summary = document.createElement('div');
        summary.textContent = it.summary;
        summary.style.cssText = 'font-size:14px;color:#333;margin-top:4px;line-height:1.4;';
        left.appendChild(summary);
      }

      const right = document.createElement('div');
      right.className = 'muted-xs';
      right.style.cssText = 'white-space:nowrap;font-size:12px;color:#888;';
      right.textContent = it.pubDate ? new Date(it.pubDate).toLocaleDateString() : '';

      row.append(left, right);
      list.appendChild(row);
    });
  } else {
    if (statusEl) statusEl.textContent = 'No headlines available';
  }
}

/* =====================
   Lazy-load modules (via Netlify Functions)
===================== */
function loadScriptOnce(src){
  return new Promise((resolve, reject)=>{
    if (document.querySelector('script[data-src="' + src + '"]')) return resolve();

    const s = document.createElement('script');

    /* keep cache bust to avoid stale function edge cache during dev */
    const bust = 'v=' + Date.now();
    s.src = src + (src.includes('?') ? '&' : '?') + bust;

    s.defer = true;
    s.dataset.src = src;

    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
}

/* =====================
   Main dispatcher
===================== */
async function loadDataForState(){
  if (currentCategory !== 'Market') return;

  if (currentRange === 'Recent'){
    await loadMarketRecent();
    return;
  }

  if (currentRange === 'Figures'){
    if (!figuresLoadedOnce){
      figuresLoadedOnce = true;
      try{
        await loadScriptOnce('/.netlify/functions/now-figures');

        if (!window.GT_NOW_FIGURES || typeof window.GT_NOW_FIGURES.load !== 'function'){
          throw new Error('GT_NOW_FIGURES.load not found. now-figures must return executable JS that assigns window.GT_NOW_FIGURES');
        }

        await window.GT_NOW_FIGURES.load();
      }catch(e){
        const srcEl = document.getElementById('figSourceText');
        const stEl  = document.getElementById('figStatus');
        const tbEl  = document.getElementById('figTbody');

        if (srcEl) srcEl.innerHTML = '<b>Figures load error</b>';
        if (stEl)  stEl.textContent = String(e.message || e);
        if (tbEl)  tbEl.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#888;padding:20px;">Load failed</td></tr>';

        console.error('Figures load error:', e);
      }
    }
    return;
  }

  if (currentRange === 'Chart'){
    if (!chartLoadedOnce){
      chartLoadedOnce = true;
      try{
        await loadScriptOnce('/.netlify/functions/now-chart');

        if (!window.GT_NOW_CHART || typeof window.GT_NOW_CHART.load !== 'function'){
          throw new Error('GT_NOW_CHART.load not found. now-chart must return executable JS that assigns window.GT_NOW_CHART');
        }

        await window.GT_NOW_CHART.load();
      }catch(e){
        const srcEl = document.getElementById('chartSourceText');
        const stEl  = document.getElementById('chartStatus');

        if (srcEl) srcEl.innerHTML = '<b>Chart load error</b>';
        if (stEl)  stEl.textContent = String(e.message || e);

        console.error('Chart load error:', e);
      }
    } else {
      if (window.GT_NOW_CHART && typeof window.GT_NOW_CHART.redraw === 'function'){
        try{ window.GT_NOW_CHART.redraw(); }catch(e){ console.error('Chart redraw error:', e); }
      }
    }
    return;
  }
}

/* =====================
   Init
===================== */
(function init(){
  updateViews();
  loadDataForState();
  loadHeadlines();

  fetch('/.netlify/functions/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: window.location.pathname, referrer: document.referrer || '' })
  }).catch(()=>{});
})();

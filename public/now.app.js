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
function fmt2(x){ if (x==null||x==='') return '—'; const n=Number(x); if(Number.isNaN(n)) return '—'; return n.toFixed(2).replace(/\.?0+$/,''); }
function fmtPct(x){ if (x==null||x==='') return '—'; const n=Number(x); if(Number.isNaN(n)) return '—'; return fmt2(n)+'%'; }
function fmtInt(x){ if (x==null) return '—'; const n=Number(x); if(Number.isNaN(n)) return '—'; return Math.round(n).toLocaleString(); }
function show(el){ el.classList.remove('hidden'); }
function hide(el){ el.classList.add('hidden'); }
function formatDateLabel(d){
  if(!d) return '';
  const dt=(typeof d==='string')?new Date(d):d;
  const y=dt.getFullYear();
  const m=String(dt.getMonth()+1).padStart(2,'0');
  const dd=String(dt.getDate()).padStart(2,'0');
  return y + '.' + m + '.' + dd;
}
async function fetchJSON(path){
  try{ const res=await fetch(path); return await res.json(); }catch(e){ return null; }
}
window.GT_NOW_UTIL = { fmt2, fmtPct, fmtInt, show, hide, formatDateLabel, fetchJSON };

/* =====================
   State
===================== */
let currentCategory = "Market";
let currentRange = "Recent";
let figuresLoadedOnce = false;
let chartLoadedOnce = false;

function updateViews(){
  const vRecent = document.getElementById('viewRecent');
  const vFig    = document.getElementById('viewFigures');
  const vChart  = document.getElementById('viewChart');
  const vPh     = document.getElementById('viewPlaceholder');

  hide(vRecent); hide(vFig); hide(vChart); hide(vPh);

  if (currentCategory !== "Market"){
    show(vPh);
    document.getElementById('placeholderText').textContent =
      currentCategory + ' · ' + currentRange + ' data is not ready yet.';
    return;
  }
  if (currentRange === "Recent") show(vRecent);
  if (currentRange === "Figures") show(vFig);
  if (currentRange === "Chart") show(vChart);
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
      document.getElementById('catMore').value = "";
      updateViews();
      loadDataForState();
      loadHeadlines();
    });
  });

  document.getElementById('catMore').addEventListener('change', (e)=>{
    const v = e.target.value;
    if (!v) return;
    document.querySelectorAll('#catSeg .btn[data-cat]').forEach(b=>b.classList.remove('active'));
    currentCategory = v;
    updateViews();
    loadDataForState();
    loadHeadlines();
  });

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
   Recent (UPDATED)
===================== */
async function fetchLatestMarketRow(){
  try{
    const { data, error } = await sb
      .from('v_market_figures_120m')
      .select('snapshot_date, usdkrw_spot, kor_10y, us_10y, sofr_30d, source_type')
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
      if ((Date.now() - ts)/1000/60 < 10){
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
  localStorage.setItem(cacheKey, JSON.stringify({ data: payload, ts: Date.now() }));
}

function updateMarketRecentUI(data){
  const { fxRes, rRes, korRes, latest } = data || {};
  const latestRow = latest && latest.row ? latest.row : null;

  if (latestRow?.usdkrw_spot != null){
    document.getElementById('usdkrwSpot').textContent = fmt2(latestRow.usdkrw_spot);
  } else if (fxRes?.spotUSDKRW != null){
    document.getElementById('usdkrwSpot').textContent = fmt2(fxRes.spotUSDKRW);
  }

  if (latestRow?.us_10y != null){
    document.getElementById('us10').textContent = fmtPct(latestRow.us_10y);
  } else if (rRes?.us10 != null){
    document.getElementById('us10').textContent = fmtPct(rRes.us10);
  }

  if (latestRow?.sofr_30d != null){
    document.getElementById('sofr30d').textContent = fmtPct(latestRow.sofr_30d);
  } else if (rRes?.sofr30d != null){
    document.getElementById('sofr30d').textContent = fmtPct(rRes.sofr30d);
  }

  if (latestRow?.kor_10y != null){
    document.getElementById('kor10').textContent = fmtPct(latestRow.kor_10y);
  } else {
    let kor10 = null;
    if (korRes){
      kor10 = korRes.y10 ?? korRes.kor10 ?? korRes.yield10 ?? null;
    }
    if (kor10 != null) document.getElementById('kor10').textContent = fmtPct(kor10);
  }

  let us1 = null;
  if (rRes) us1 = rRes.us1 ?? null;

  let kor1 = null;
  if (korRes) kor1 = korRes.y1 ?? korRes.kor1 ?? korRes.yield1 ?? null;

  const basis = -2.6;
  const swapEl = document.getElementById('usdkrwSwap1y');
  const detailEl = document.getElementById('swapDetail');

  if (us1 != null && kor1 != null){
    const diff = (Number(us1) - Number(kor1)) + basis;
    swapEl.textContent = fmtPct(diff);
    detailEl.textContent = '( US1Y: ' + fmt2(us1) + '% · KOR1Y: ' + fmt2(kor1) + '% )';
  } else {
    swapEl.textContent = '—';
    detailEl.textContent = '';
  }
}

/* =====================
   Headlines
===================== */
async function loadHeadlines(){
  document.getElementById('newsLoading').style.display = 'inline';
  document.getElementById('newsStatus').textContent = '';
  const list = document.getElementById('newsList');
  list.innerHTML = '';

  if (currentCategory !== 'Market'){
    document.getElementById('newsLoading').style.display = 'none';
    document.getElementById('newsStatus').textContent = currentCategory + ' headlines are coming soon.';
    return;
  }

  const rssRes = await fetchJSON('/.netlify/functions/rss');
  document.getElementById('newsLoading').style.display = 'none';

  if (rssRes?.items?.length){
    rssRes.items.slice(0, 30).forEach(it=>{
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;gap:12px;margin-bottom:8px;';

      const left = document.createElement('div');
      left.style.cssText = 'min-width:0;flex:1;';
      const a = document.createElement('a');
      a.href = it.link; a.target = '_blank'; a.textContent = it.title;
      left.appendChild(a);

      const right = document.createElement('div');
      right.className = 'muted-xs';
      right.textContent = it.pubDate ? new Date(it.pubDate).toLocaleDateString() : '';

      row.append(left, right);
      list.appendChild(row);
    });
  } else {
    document.getElementById('newsStatus').textContent = 'No headlines available';
  }
}

/* =====================
   Lazy-load modules (via Netlify Functions)
===================== */
function loadScriptOnce(src){
  return new Promise((resolve, reject)=>{
    if (document.querySelector('script[data-src="'+src+'"]')) return resolve();
    const s = document.createElement('script');

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
          throw new Error('GT_NOW_FIGURES.load not found (function output is not valid JS module)');
        }
        await window.GT_NOW_FIGURES.load();
      }catch(e){
        document.getElementById('figSourceText').innerHTML = '<b>Figures load error</b>';
        document.getElementById('figStatus').textContent = String(e.message || e);
        document.getElementById('figTbody').innerHTML =
          '<tr><td colspan="5" style="text-align:center;color:#888;padding:20px;">Load failed</td></tr>';
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
          throw new Error('GT_NOW_CHART.load not found (function output is not valid JS module)');
        }
        await window.GT_NOW_CHART.load();
      }catch(e){
        document.getElementById('chartSourceText').innerHTML = '<b>Chart load error</b>';
        document.getElementById('chartStatus').textContent = String(e.message || e);
      }
    } else {
      window.GT_NOW_CHART && window.GT_NOW_CHART.redraw && window.GT_NOW_CHART.redraw();
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

  fetch("/.netlify/functions/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: window.location.pathname, referrer: document.referrer || "" })
  }).catch(()=>{});
})();

// netlify/functions/now-chart.js
exports.handler = async () => {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=60"
    },
    body: `
(() => {
  const { sb } = window.GT_NOW;
  const { fmt2, formatDateLabel } = window.GT_NOW_UTIL;

  const REL = "market_snapshots_fred_daily";

  let chartCache = null;
  let chartRel = REL;

  let chartEnabled = { fx:true, kr10:true, us10:true, sofr:true };

  function safeMsg(err){
    if (!err) return "";
    return err.message || err.details || err.hint || String(err);
  }

  function toTime(v){
    if (v == null) return null;
    const s = String(v).trim();
    if (!s) return null;
    const t = Date.parse(s.slice(0,10));
    return Number.isNaN(t) ? null : t;
  }

  function normalizeRows(data){
    const out = (data || []).map(r=>{
      const tt = toTime(r.snapshot_date);
      if (tt == null) return null;

      const parseNum = (val) => {
        if (val == null || val === "" || val === "null" || val === "undefined") return null;
        const num = Number(val);
        return (isNaN(num) || !isFinite(num)) ? null : num;
      };

      return {
        t: new Date(tt),
        _t: tt,
        fx:   parseNum(r.usdkrw_spot),
        kr10: parseNum(r.kor_10y),
        us10: parseNum(r.us_10y),
        sofr: parseNum(r.sofr_30d),
      };
    }).filter(Boolean);

    out.sort((a,b)=> a._t - b._t);
    
    console.log('[Chart] Total rows:', out.length);
    if (out.length > 0) {
      console.log('[Chart] Sample data:', {
        first: out[0],
        last: out[out.length-1],
        hasUS10: out.filter(r => r.us10 != null).length,
        hasSOFR: out.filter(r => r.sofr != null).length,
        hasKR10: out.filter(r => r.kr10 != null).length,
        hasFX: out.filter(r => r.fx != null).length
      });
    }
    
    return out;
  }

  function trimToMostRecent3Y(rows){
    if (!rows.length) return rows;
    const end = rows[rows.length-1]._t;
    const start = end - (365*3 + 10) * 24*60*60*1000;
    const cut = rows.filter(r => r._t >= start && r._t <= end);
    return cut.length ? cut : rows;
  }

  function forwardFill(rows, key, gapDays){
    let lastVal = null;
    let lastT = null;
    const maxGap = gapDays * 24*60*60*1000;

    for (const r of rows){
      if (r[key] != null && !Number.isNaN(r[key])){
        lastVal = r[key];
        lastT = r._t;
      } else {
        if (lastVal != null && lastT != null && (r._t - lastT) <= maxGap){
          r[key] = lastVal;
        }
      }
    }
  }

  function padRange(min, max, padRatio){
    if (min==null || max==null) return [min,max];
    if (min === max){
      const p = min === 0 ? 1 : Math.abs(min)*0.08;
      return [min-p, max+p];
    }
    const span = max - min;
    const pad = span * padRatio;
    return [min - pad, max + pad];
  }

  function setupCanvas(){
    const canvas = document.getElementById("chartCanvas");
    const wrap = document.getElementById("chartWrap") || canvas?.parentElement;
    if (!canvas || !wrap) return null;

    const rect = wrap.getBoundingClientRect();
    const W = Math.max(320, Math.floor(rect.width));
    const H = Math.max(320, Math.floor(rect.height));

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr,0,0,dpr,0,0);
    return { canvas, ctx, W, H, wrap };
  }

  function buildLegend(){
    const legend = document.getElementById("chartLegend");
    if (!legend) return;
    legend.innerHTML = "";

    const items = [
      { key:"fx",   label:"USD/KRW spot", color:"#111111" },
      { key:"kr10", label:"Korea 10Y",    color:"#2ca02c" },
      { key:"us10", label:"US 10Y",       color:"#0a66c2" },
      { key:"sofr", label:"SOFR 30d avg", color:"#ff7f0e" }
    ];

    items.forEach(it=>{
      const div = document.createElement("div");
      div.className = "item" + (chartEnabled[it.key] ? "" : " off");
      div.innerHTML = '<span class="dot" style="background:' + it.color + '"></span><span>' + it.label + '</span>';
      div.addEventListener("click", ()=>{
        chartEnabled[it.key] = !chartEnabled[it.key];
        buildLegend();
        drawChart();
      });
      legend.appendChild(div);
    });
  }

  function drawChart(){
    const status = document.getElementById("chartStatus");
    const srcText = document.getElementById("chartSourceText");
    const tip  = document.getElementById("chartTip");
    if (tip) tip.style.display = "none";

    const env = setupCanvas();
    if (!env) return;
    const { ctx, W, H } = env;

    ctx.clearRect(0,0,W,H);

    if (!chartCache?.length){
      ctx.save();
      ctx.fillStyle = "#777";
      ctx.font = "14px Pretendard, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No chart data", W/2, H/2);
      ctx.restore();
      if (srcText) srcText.innerHTML = "Source: <b>none</b>";
      if (status) status.textContent = "No data";
      return;
    }

    const margin = { left: 78, right: 78, top: 16, bottom: 54 };
    const plotW = W - margin.left - margin.right;
    const plotH = H - margin.top - margin.bottom;

    const xMin = chartCache[0]._t;
    const xMax = chartCache[chartCache.length-1]._t;

    const xScale = (dt)=>{
      const tt = dt._t;
      if (xMax===xMin) return margin.left;
      return margin.left + ((tt-xMin)/(xMax-xMin))*plotW;
    };

    const fxVals = chartEnabled.fx ? chartCache.map(d=>d.fx).filter(v=>v!=null && !isNaN(v)) : [];
    const rateVals = []
      .concat(chartEnabled.kr10 ? chartCache.map(d=>d.kr10).filter(v=>v!=null && !isNaN(v)) : [])
      .concat(chartEnabled.us10 ? chartCache.map(d=>d.us10).filter(v=>v!=null && !isNaN(v)) : [])
      .concat(chartEnabled.sofr ? chartCache.map(d=>d.sofr).filter(v=>v!=null && !isNaN(v)) : []);

    console.log('[Chart] Values count:', {
      fx: fxVals.length,
      rates: rateVals.length,
      us10: chartCache.filter(d => d.us10 != null && !isNaN(d.us10)).length,
      sofr: chartCache.filter(d => d.sofr != null && !isNaN(d.sofr)).length,
      kr10: chartCache.filter(d => d.kr10 != null && !isNaN(d.kr10)).length
    });

    let fxMin = fxVals.length ? Math.min(...fxVals) : 0;
    let fxMax = fxVals.length ? Math.max(...fxVals) : 1;
    let rMin  = rateVals.length ? Math.min(...rateVals) : 0;
    let rMax  = rateVals.length ? Math.max(...rateVals) : 1;

    var temp = padRange(fxMin, fxMax, 0.06);
    fxMin = temp[0]; fxMax = temp[1];
    temp = padRange(rMin, rMax, 0.12);
    rMin = temp[0]; rMax = temp[1];

    const yFX = (v)=>{
      if (fxMax===fxMin) return margin.top + plotH/2;
      return margin.top + (1-(v-fxMin)/(fxMax-fxMin))*plotH;
    };
    const yR = (v)=>{
      if (rMax===rMin) return margin.top + plotH/2;
      return margin.top + (1-(v-rMin)/(rMax-rMin))*plotH;
    };

    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#e9ecef";
    ctx.font = "12px Pretendard, system-ui, sans-serif";
    ctx.fillStyle = "#666";

    const gridN = 5;
    for (let i=0;i<=gridN;i++){
      const yy = margin.top + (plotH*i/gridN);
      ctx.beginPath();
      ctx.moveTo(margin.left, yy);
      ctx.lineTo(margin.left+plotW, yy);
      ctx.stroke();
    }

    ctx.strokeStyle = "#cfd4da";
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, margin.top+plotH);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(margin.left+plotW, margin.top);
    ctx.lineTo(margin.left+plotW, margin.top+plotH);
    ctx.stroke();

    ctx.fillStyle = "#444";
    for (let i=0;i<=4;i++){
      const v = fxMin + ((fxMax-fxMin)*(4-i)/4);
      const yy = margin.top + (plotH*i/4);
      ctx.fillText(Math.round(v).toLocaleString(), 10, yy+4);
    }

    for (let i=0;i<=4;i++){
      const v = rMin + ((rMax-rMin)*(4-i)/4);
      const yy = margin.top + (plotH*i/4);
      const txt = (Math.round(v*100)/100).toFixed(2) + "%";
      const w = ctx.measureText(txt).width;
      ctx.fillText(txt, W-10-w, yy+4);
    }

    const idxs = [0, Math.floor((chartCache.length-1)/2), chartCache.length-1];
    ctx.fillStyle = "#666";
    idxs.forEach((idx, k)=>{
      const xx = xScale(chartCache[idx]);
      const label = formatDateLabel(new Date(chartCache[idx]._t));
      const w = ctx.measureText(label).width;
      const lx = k===0 ? margin.left : (k===2 ? margin.left+plotW-w : xx - w/2);
      ctx.fillText(label, lx, margin.top+plotH+34);
    });

    ctx.restore();

    function drawSeries(getVal, yFn, color, width){
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineJoin = "round";
      ctx.lineCap  = "round";
      let started = false;
      let pointCount = 0;

      for (let i=0;i<chartCache.length;i++){
        const v = getVal(chartCache[i]);
        if (v==null || Number.isNaN(v) || !isFinite(v)){ 
          started=false; 
          continue; 
        }
        pointCount++;
        const xx = xScale(chartCache[i]);
        const yy = yFn(v);
        if (!started){
          ctx.beginPath();
          ctx.moveTo(xx,yy);
          started=true;
        }else{
          ctx.lineTo(xx,yy);
        }
      }
      if (started) ctx.stroke();
      console.log('[Chart] Drew series with ' + pointCount + ' points, color: ' + color);
      ctx.restore();
    }

    const C_FX   = "#111111";
    const C_KR10 = "#2ca02c";
    const C_US10 = "#0a66c2";
    const C_SOFR = "#ff7f0e";

    if (chartEnabled.fx)   drawSeries(d=>d.fx,   yFX, C_FX,   2.2);
    if (chartEnabled.kr10) drawSeries(d=>d.kr10, yR,  C_KR10, 1.8);
    if (chartEnabled.us10) drawSeries(d=>d.us10, yR,  C_US10, 1.8);
    if (chartEnabled.sofr) drawSeries(d=>d.sofr, yR,  C_SOFR, 1.8);

    window.__chartGeom = { margin, plotW, xMin, xMax, W };

    if (srcText) srcText.innerHTML =
      'Dual axis - Left: USD/KRW - Right: Rates - Source: <b>' + chartRel + '</b> - note: last 3y (most recent)';

    if (status && !status.textContent) status.textContent =
      'Loaded - rows: ' + chartCache.length;
  }

  function nearestIndexByX(px){
    const g = window.__chartGeom;
    if (!g || !chartCache?.length) return null;
    const { margin, plotW, xMin, xMax } = g;
    const x = Math.min(margin.left+plotW, Math.max(margin.left, px));
    const ratio = (x - margin.left) / plotW;
    const tt = xMin + ratio*(xMax-xMin);

    let lo=0, hi=chartCache.length-1;
    while (lo<hi){
      const mid = Math.floor((lo+hi)/2);
      if (chartCache[mid]._t < tt) lo = mid+1;
      else hi = mid;
    }
    const i = lo;
    if (i<=0) return 0;
    const t0 = chartCache[i-1]._t;
    const t1 = chartCache[i]._t;
    return (Math.abs(tt-t0) < Math.abs(tt-t1)) ? i-1 : i;
  }

  function attachTooltipOnce(){
    const wrap = document.getElementById("chartWrap");
    const tip  = document.getElementById("chartTip");
    const canvas = document.getElementById("chartCanvas");
    if (!wrap || !tip || !canvas || wrap.__tipBound) return;
    wrap.__tipBound = true;

    function showTip(x,y,html){
      tip.innerHTML = html;
      tip.style.left = x + "px";
      tip.style.top  = y + "px";
      tip.style.display = "block";
    }
    function hideTip(){ tip.style.display = "none"; }

    wrap.addEventListener("mousemove", (e)=>{
      if (!chartCache?.length) return;
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      const idx = nearestIndexByX(px);
      if (idx==null) return;
      const d = chartCache[idx];

      const lines = [];
      if (chartEnabled.fx)   lines.push({k:"USD/KRW", v: d.fx!=null ? Math.round(d.fx).toLocaleString() : "—"});
      if (chartEnabled.kr10) lines.push({k:"KOR10Y",  v: d.kr10!=null ? fmt2(d.kr10)+"%" : "—"});
      if (chartEnabled.us10) lines.push({k:"US10Y",   v: d.us10!=null ? fmt2(d.us10)+"%" : "—"});
      if (chartEnabled.sofr) lines.push({k:"SOFR",    v: d.sofr!=null ? fmt2(d.sofr)+"%" : "—"});

      const html = '<span class="tdate">' + formatDateLabel(new Date(d._t)) + '</span>' +
        lines.map(r=>'<div class="line"><span class="k">' + r.k + '</span><span class="v">' + r.v + '</span></div>').join("");
      showTip(px, py, html);
    });

    wrap.addEventListener("mouseleave", hideTip);
    window.addEventListener("resize", ()=> drawChart());
  }

  async function load(){
    const status = document.getElementById("chartStatus");
    const srcText = document.getElementById("chartSourceText");

    if (status) status.textContent = "Loading...";
    if (srcText) srcText.innerHTML = "Loading...";

    try{
      console.log('[Chart] Loading data from Supabase...');
      
      const resp = await sb
        .from(REL)
        .select("snapshot_date, usdkrw_spot, kor_10y, us_10y, sofr_30d")
        .order("snapshot_date", { ascending: false })
        .limit(2000);

      console.log('[Chart] Supabase response:', {
        error: resp.error,
        count: resp.data?.length || 0
      });

      if (resp.error){
        console.error('[Chart] Error:', resp.error);
        if (status) status.textContent = safeMsg(resp.error);
        chartCache = null;
        chartRel = REL;
        buildLegend();
        drawChart();
        attachTooltipOnce();
        if (srcText) srcText.innerHTML = 'Source: <b>' + REL + '</b>';
        return;
      }

      let rows = normalizeRows(resp.data || []);
      rows = trimToMostRecent3Y(rows);

      forwardFill(rows, "fx",   7);
      forwardFill(rows, "kr10", 31);
      forwardFill(rows, "us10", 7);
      forwardFill(rows, "sofr", 7);

      chartCache = rows;
      chartRel = REL;

      buildLegend();
      drawChart();
      attachTooltipOnce();

      const newest = chartCache[chartCache.length-1]?._t;
      const oldest = chartCache[0]?._t;

      if (status) status.textContent =
        'Loaded - rows: ' + chartCache.length + ' - range: ' + formatDateLabel(new Date(oldest)) + ' -> ' + formatDateLabel(new Date(newest));

      if (srcText) srcText.innerHTML =
        'Dual axis - Left: USD/KRW - Right: Rates - Source: <b>' + REL + '</b> - note: most recent 3y';
    }catch(e){
      console.error('[Chart] Exception:', e);
      if (status) status.textContent = safeMsg(e);
      if (srcText) srcText.innerHTML = 'Source: <b>' + REL + '</b>';
    }
  }

  function redraw(){
    buildLegend();
    drawChart();
  }

  window.GT_NOW_CHART = { load, redraw };
})();
`
  };
};

// netlify/functions/now-figures.js
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
  const { fmtInt, fmtPct, formatDateLabel } = window.GT_NOW_UTIL;

  // ✅ 테이블을 직접 사용
  const REL = "market_snapshots_fred_daily";

  function safeMsg(err){
    if (!err) return "";
    return err.message || err.details || err.hint || String(err);
  }

  function toTime(v){
    if (v == null) return null;

    if (typeof v === "number"){
      if (v > 1e12) return v;        // ms
      if (v > 1e9)  return v * 1000; // sec
      return null;
    }

    const s = String(v).trim();
    if (!s) return null;

    const t = Date.parse(s);
    if (!Number.isNaN(t)) return t;

    const s10 = s.slice(0,10).replace(/\\./g,"-").replace(/\\//g,"-");
    const t2 = Date.parse(s10);
    if (!Number.isNaN(t2)) return t2;

    return null;
  }

  function normalizeRows(data){
    const rows = (data || []).map(r=>{
      const rawDate = r.snapshot_date ?? null;
      const tt = toTime(rawDate);
      if (tt == null) return null;

      return {
        _t: tt,
        dateLabel: formatDateLabel(new Date(tt)),
        usdkrw: r.usdkrw_spot ?? null,
        kor10:  r.kor_10y ?? null,
        us10:   r.us_10y ?? null,
        sofr:   r.sofr_30d ?? null
      };
    }).filter(Boolean);

    // 최신 우선
    rows.sort((a,b)=> b._t - a._t);
    return rows;
  }

  async function load(){
    const tbody = document.getElementById("figTbody");
    const status = document.getElementById("figStatus");
    const srcText = document.getElementById("figSourceText");

    if (!tbody || !status || !srcText) return;

    tbody.innerHTML = \`<tr><td colspan="5" style="text-align:center;color:#888;padding:20px;">Loading…</td></tr>\`;
    status.textContent = "";
    srcText.innerHTML = "Loading…";

    try{
      const resp = await sb
        .from(REL)
        .select("snapshot_date, usdkrw_spot, kor_10y, us_10y, sofr_30d, source_type")
        .order("snapshot_date", { ascending: false })
        .limit(3000);

      if (resp.error){
        tbody.innerHTML = \`<tr><td colspan="5" style="text-align:center;color:#888;padding:20px;">Load failed</td></tr>\`;
        status.textContent = safeMsg(resp.error);
        srcText.innerHTML = \`Source: <b>\${REL}</b>\`;
        return;
      }

      const data = resp.data || [];
      if (!data.length){
        tbody.innerHTML = \`<tr><td colspan="5" style="text-align:center;color:#888;padding:20px;">No data</td></tr>\`;
        status.textContent = "No rows";
        srcText.innerHTML = \`Source: <b>\${REL}</b>\`;
        return;
      }

      let rows = normalizeRows(data);
      if (!rows.length){
        tbody.innerHTML = \`<tr><td colspan="5" style="text-align:center;color:#888;padding:20px;">No usable rows (missing snapshot_date)</td></tr>\`;
        status.textContent = "No usable rows";
        srcText.innerHTML = \`Source: <b>\${REL}</b>\`;
        return;
      }

      tbody.innerHTML = "";
      for (const r of rows){
        const tr = document.createElement("tr");
        tr.innerHTML = \`
          <td>\${r.dateLabel}</td>
          <td>\${r.usdkrw != null ? fmtInt(r.usdkrw) : "—"}</td>
          <td>\${r.kor10  != null ? fmtPct(r.kor10)  : "—"}</td>
          <td>\${r.us10   != null ? fmtPct(r.us10)   : "—"}</td>
          <td>\${r.sofr   != null ? fmtPct(r.sofr)   : "—"}</td>
        \`;
        tbody.appendChild(tr);
      }

      const newest = rows[0]?.dateLabel || "";
      const oldest = rows[rows.length-1]?.dateLabel || "";

      srcText.innerHTML =
        \`Source: <b>\${REL}</b> · note: kor_10y is daily forward-filled from monthly\`;

      status.textContent =
        \`Loaded · rows: \${rows.length} · newest: \${newest} · oldest: \${oldest}\`;
    }catch(e){
      tbody.innerHTML = \`<tr><td colspan="5" style="text-align:center;color:#888;padding:20px;">Load failed</td></tr>\`;
      status.textContent = safeMsg(e);
      srcText.innerHTML = \`Source: <b>\${REL}</b>\`;
    }
  }

  window.GT_NOW_FIGURES = { load };
})();
`
  };
};

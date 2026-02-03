// public/js/search/gt.search.export.js

function safeFilePart(s){
  return (s || "search")
    .toString()
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

function ymd(){
  const d = new Date();
  const yy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yy}${mm}${dd}`;
}

export function exportToXlsx(items, query){
  if (!window.XLSX) throw new Error("XLSX not loaded");

  const rows = (items || []).map(it => ({
    Date: it.date || "",
    Source: it.source || "",
    Title: it.title || "",
    URL: it.url || "",
    // snippet 컬럼은 요청대로 제외
  }));

  const ws = window.XLSX.utils.json_to_sheet(rows);
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, "Results");

  const filename = `GlobalTide_Search_${safeFilePart(query)}_${ymd()}.xlsx`;
  window.XLSX.writeFile(wb, filename);
}

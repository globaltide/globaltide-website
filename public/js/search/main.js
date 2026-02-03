import { $, setVisible, setError } from "./ui.js";
import { getSessionUser, loginWithGoogle, logout, onAuthChange } from "./auth.js";
import { listKeywords, addKeyword, deleteKeyword } from "./keywords.js";
import { searchNews } from "./searchData.js";
import { renderPosts, renderKeywordChips } from "./render.js";

const els = {
  qInput: $("qInput"),
  btnSearch: $("btnSearch"),
  btnLogin: $("btnLogin"),
  btnLogout: $("btnLogout"),
  btnKeywordManage: $("btnKeywordManage"),
  btnExportXlsx: $("btnExportXlsx"),

  kwPanel: $("kwPanel"),
  kwUserLine: $("kwUserLine"),
  kwInput: $("kwInput"),
  kwAddBtn: $("kwAddBtn"),
  kwChips: $("kwChips"),
  kwStatus: $("kwStatus"),

  status: $("status"),
  posts: $("posts"),
  errbox: $("errbox"),
  
  startDate: $("startDate"),
  endDate: $("endDate"),
};

let currentUser = null;
let activeUserKeyword = null;
let lastQuery = "";
let lastItems = [];
let dateFilter = { start: null, end: null };

function setStatus(text){
  els.status.textContent = text || "";
}

function showError(msg){
  setError(els.errbox, msg || "");
  els.errbox.style.display = msg ? "block" : "none";
}

function safeFileName(s){
  return (s || "search")
    .replace(/[\\/:*?"<>|]/g, "_")
    .slice(0, 80);
}

function todayKst(){
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function exportToXlsx(){
  if (!lastItems.length) {
    showError("엑셀로 내보낼 검색 결과가 없습니다.");
    return;
  }

  const rows = lastItems.map(it => ({
    query: lastQuery,
    title: it.title || "",
    source: it.source || "",
    date: it.date || "",
    url: it.url || "",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "results");

  const fname = `GlobalTide_Search_${todayKst()}_${safeFileName(lastQuery)}.xlsx`;
  XLSX.writeFile(wb, fname);
}

// 날짜 기간 계산
function calculateDateRange(period) {
  const end = new Date();
  let start = new Date();
  
  switch(period) {
    case '1m':
      start.setMonth(start.getMonth() - 1);
      break;
    case '3m':
      start.setMonth(start.getMonth() - 3);
      break;
    case '6m':
      start.setMonth(start.getMonth() - 6);
      break;
    case '1y':
      start.setFullYear(start.getFullYear() - 1);
      break;
    case 'all':
      return { start: null, end: null };
  }
  
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  };
}

// 날짜 필터 적용
function filterByDate(items, startDate, endDate) {
  if (!startDate && !endDate) return items;
  
  return items.filter(item => {
    if (!item.date) return true;
    
    const itemDate = new Date(item.date);
    if (isNaN(itemDate.getTime())) return true;
    
    if (startDate) {
      const start = new Date(startDate);
      if (itemDate < start) return false;
    }
    
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59);
      if (itemDate > end) return false;
    }
    
    return true;
  });
}

async function runSearch(query){
  showError("");
  const q = (query || "").trim();
  if (!q) return;

  lastQuery = q;
  lastItems = [];
  setVisible(els.btnExportXlsx, false);

  els.posts.innerHTML = `<div class="meta">검색 중...</div>`;

  try{
    const allItems = await searchNews(q);
    
    // 날짜 필터 적용
    const filteredItems = filterByDate(
      allItems, 
      dateFilter.start, 
      dateFilter.end
    );
    
    lastItems = filteredItems;

    renderPosts(els.posts, filteredItems);
    
    const dateInfo = dateFilter.start || dateFilter.end 
      ? ` · 기간: ${dateFilter.start || '시작'} ~ ${dateFilter.end || '종료'}` 
      : '';
    setStatus(`검색어: ${q}${dateInfo} · ${filteredItems.length}개`);

    setVisible(els.btnExportXlsx, filteredItems.length > 0);
  }catch(e){
    const msg = e?.message || String(e);
    showError(msg);
    els.posts.innerHTML = `<div class="meta">검색 실패: ${msg}</div>`;
    setStatus(`검색어: ${q} · 실패`);
  }
}

async function refreshKeywordUI(){
  if (!currentUser){
    els.kwUserLine.textContent = "";
    els.kwChips.innerHTML = "";
    els.kwStatus.textContent = "로그인이 필요합니다.";
    return;
  }

  els.kwUserLine.textContent = `현재 로그인: ${currentUser.email || ""}`;
  const list = await listKeywords(currentUser.id);
  renderKeywordChips(els.kwChips, list, activeUserKeyword);
}

function toggleKwPanel(){
  setVisible(els.kwPanel, els.kwPanel.style.display === "none");
  if (els.kwPanel.style.display !== "none") refreshKeywordUI();
}

function bindEvents(){
  els.btnSearch.addEventListener("click", () => runSearch(els.qInput.value));
  els.qInput.addEventListener("keydown", e => e.key === "Enter" && els.btnSearch.click());
  els.btnExportXlsx.addEventListener("click", exportToXlsx);

  els.btnLogin.addEventListener("click", loginWithGoogle);
  els.btnLogout.addEventListener("click", logout);
  els.btnKeywordManage.addEventListener("click", toggleKwPanel);

  els.kwAddBtn.addEventListener("click", async () => {
    if (!currentUser) return;
    await addKeyword(currentUser.id, els.kwInput.value.trim());
    els.kwInput.value = "";
    refreshKeywordUI();
  });

  els.kwChips.addEventListener("click", async e => {
    const chip = e.target.closest(".kw-chip[data-kw]");
    if (!chip) return;
    els.qInput.value = chip.dataset.kw;
    await runSearch(chip.dataset.kw);
  });
  
  // 날짜 프리셋 버튼
  document.querySelectorAll('.date-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // 버튼 active 상태 변경
      document.querySelectorAll('.date-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const period = btn.dataset.period;
      const range = calculateDateRange(period);
      
      dateFilter.start = range.start;
      dateFilter.end = range.end;
      
      // 입력 필드 업데이트
      els.startDate.value = range.start || '';
      els.endDate.value = range.end || '';
      
      // 검색어가 있으면 자동 재검색
      if (lastQuery) {
        runSearch(lastQuery);
      }
    });
  });
  
  // 수동 날짜 입력
  els.startDate.addEventListener('change', () => {
    dateFilter.start = els.startDate.value;
    document.querySelectorAll('.date-btn').forEach(b => b.classList.remove('active'));
    if (lastQuery) runSearch(lastQuery);
  });
  
  els.endDate.addEventListener('change', () => {
    dateFilter.end = els.endDate.value;
    document.querySelectorAll('.date-btn').forEach(b => b.classList.remove('active'));
    if (lastQuery) runSearch(lastQuery);
  });
}

async function init(){
  bindEvents();
  currentUser = await getSessionUser();
  setVisible(els.btnLogin, !currentUser);
  setVisible(els.btnLogout, !!currentUser);
  
  // 기본 종료일을 오늘로 설정
  els.endDate.value = todayKst();
}

init();

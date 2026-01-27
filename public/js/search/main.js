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
};

let currentUser = null;
let activeUserKeyword = null;
let lastQuery = "";
let lastItems = [];

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

// 서울 기준 날짜
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

async function runSearch(query){
  showError("");
  const q = (query || "").trim();
  if (!q) return;

  lastQuery = q;
  lastItems = [];
  setVisible(els.btnExportXlsx, false);

  els.posts.innerHTML = `<div class="meta">검색 중...</div>`;

  try{
    const items = await searchNews(q);
    lastItems = items;

    renderPosts(els.posts, items);
    setStatus(`검색어: ${q} · ${items.length}개`);

    setVisible(els.btnExportXlsx, items.length > 0);
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
}

async function init(){
  bindEvents();
  currentUser = await getSessionUser();
  setVisible(els.btnLogin, !currentUser);
  setVisible(els.btnLogout, !!currentUser);
}

init();

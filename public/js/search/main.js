// public/js/search/main.js
import { gtSearchNews } from "./gt.search.api.js";
import { setLoading, renderItems, setStatus, showError } from "./gt.search.ui.js";
import { exportToXlsx } from "./gt.search.export.js";
import { createSupabaseClient, getSessionUser, signInGoogle, signOut } from "./gt.search.auth.js";
import { showKwPanel, loadMyKeywords, addKeyword, bindKeywordUIHandlers } from "./gt.search.keywords.js";

function $(id){
  return document.getElementById(id);
}

function setAuthButtons(user){
  const btnLogin = $("btnLogin");
  const btnLogout = $("btnLogout");
  if (!btnLogin || !btnLogout) return;
  btnLogin.style.display = user ? "none" : "inline-block";
  btnLogout.style.display = user ? "inline-block" : "none";
}

function findDateButtonsContainer(){
  const section = document.querySelector(".date-filter-section");
  return section ? section.querySelector(".date-filter-buttons") : null;
}

function getActivePeriod(){
  const wrap = findDateButtonsContainer();
  const active = wrap?.querySelector(".date-btn.active");
  return active?.getAttribute("data-period") || "all";
}

function applyPeriodToDates(period){
  const startEl = $("startDate");
  const endEl = $("endDate");
  if (!startEl || !endEl) return;

  const now = new Date();
  const end = new Date(now);
  const start = new Date(now);

  if (period === "all"){
    startEl.value = "";
    endEl.value = end.toISOString().slice(0,10);
    return;
  }

  if (period === "1m") start.setMonth(start.getMonth() - 1);
  if (period === "3m") start.setMonth(start.getMonth() - 3);
  if (period === "6m") start.setMonth(start.getMonth() - 6);
  if (period === "1y") start.setFullYear(start.getFullYear() - 1);

  startEl.value = start.toISOString().slice(0,10);
  endEl.value = end.toISOString().slice(0,10);
}

async function main(){
  const qInput = $("qInput");
  const btnSearch = $("btnSearch");
  const btnExportXlsx = $("btnExportXlsx");
  const btnKeywordManage = $("btnKeywordManage");
  const kwInput = $("kwInput");
  const kwAddBtn = $("kwAddBtn");

  if (!qInput || !btnSearch){
    console.error("Search DOM missing");
    return;
  }

  const client = createSupabaseClient();
  let currentUser = await getSessionUser(client);
  setAuthButtons(currentUser);

  // default dates
  applyPeriodToDates(getActivePeriod());

  showKwPanel(false);

  bindKeywordUIHandlers({
    client,
    getUser: () => currentUser,
    onKeywordClicked: (kw) => {
      qInput.value = kw;
      btnSearch.click();
    },
    onDeleted: async () => {
      await loadMyKeywords(client, currentUser);
    }
  });

  $("btnLogin")?.addEventListener("click", async () => {
    try{
      await signInGoogle(client);
    } catch(e){
      showError("로그인에 실패했습니다.", e?.message || String(e));
    }
  });

  $("btnLogout")?.addEventListener("click", async () => {
    try{
      await signOut(client);
      currentUser = await getSessionUser(client);
      setAuthButtons(currentUser);
      showKwPanel(false);
      setStatus("로그아웃되었습니다.");
    }catch(e){
      showError("로그아웃에 실패했습니다.", e?.message || String(e));
    }
  });

  client.auth.onAuthStateChange(async () => {
    currentUser = await getSessionUser(client);
    setAuthButtons(currentUser);
    const kwPanel = $("kwPanel");
    if (kwPanel && kwPanel.style.display === "block" && currentUser){
      $("kwUserLine").innerHTML = `현재 로그인: <b>${currentUser.email || ""}</b>`;
      await loadMyKeywords(client, currentUser);
      if (btnExportXlsx) btnExportXlsx.style.display = "inline-block";
    }
    if (!currentUser) showKwPanel(false);
  });

  btnKeywordManage?.addEventListener("click", async () => {
    currentUser = await getSessionUser(client);
    if (!currentUser){
      try{
        await signInGoogle(client);
      } catch(e){
        showError("로그인이 필요합니다.", e?.message || String(e));
      }
      return;
    }
    const kwPanel = $("kwPanel");
    const open = kwPanel && kwPanel.style.display === "block";
    showKwPanel(!open);
    if (!open){
      $("kwUserLine").innerHTML = `현재 로그인: <b>${currentUser.email || ""}</b>`;
      await loadMyKeywords(client, currentUser);
      if (btnExportXlsx) btnExportXlsx.style.display = "inline-block";
    }
  });

  kwAddBtn?.addEventListener("click", async () => {
    currentUser = await getSessionUser(client);
    const ok = await addKeyword(client, currentUser, kwInput?.value || "");
    if (ok){
      if (kwInput) kwInput.value = "";
      await loadMyKeywords(client, currentUser);
      setStatus("키워드가 추가되었습니다.");
    }
  });

  kwInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") kwAddBtn?.click();
  });

  // date buttons click
  const dateButtons = findDateButtonsContainer();
  dateButtons?.addEventListener("click", (e) => {
    const btn = e.target.closest(".date-btn");
    if (!btn) return;
    dateButtons.querySelectorAll(".date-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const period = btn.getAttribute("data-period") || "all";
    applyPeriodToDates(period);
  });

  let lastItems = [];
  let lastQuery = "";

  async function runSearch(){
    const q = (qInput.value || "").trim();
    if (!q){
      setStatus("검색어를 입력하세요.");
      return;
    }
    setLoading();
    lastQuery = q;

    const s = ($("startDate")?.value || "").trim(); // YYYY-MM-DD
    const e = ($("endDate")?.value || "").trim();   // YYYY-MM-DD
    const metaDate = (s || e) ? ` · 기간: ${s || "전체"} ~ ${e || "오늘"}` : "";

    try{
      // ✅ 핵심 수정: 날짜를 gtSearchNews로 전달
      const items = await gtSearchNews(q, {
        limit: 30,
        startDate: s,
        endDate: e
      });

      lastItems = items;
      renderItems(items, `검색어: ${q} · 총 ${items.length}개${metaDate}`);
      if (btnExportXlsx){
        btnExportXlsx.style.display = items.length ? "inline-block" : "none";
      }
    }catch(e){
      lastItems = [];
      if (btnExportXlsx) btnExportXlsx.style.display = "none";
      showError("검색에 실패했습니다. 잠시 후 다시 시도해 주세요.", e?.message || String(e));
      setStatus(`검색어: ${q} · 실패`);
    }
  }

  btnSearch.addEventListener("click", runSearch);
  qInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runSearch();
  });

  btnExportXlsx?.addEventListener("click", () => {
    try{
      if (!lastItems.length){
        setStatus("엑셀로 내보낼 결과가 없습니다.");
        return;
      }
      exportToXlsx(lastItems, lastQuery);
      setStatus("엑셀 파일을 다운로드했습니다.");
    }catch(e){
      showError("엑셀 내보내기에 실패했습니다.", e?.message || String(e));
    }
  });
}

document.addEventListener("DOMContentLoaded", main);
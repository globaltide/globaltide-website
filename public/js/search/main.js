// public/js/search/main.js

import { gtSearchNews } from "./gt.search.api.js";
import { setLoading, renderItems, setStatus, showError } from "./gt.search.ui.js";
import { exportToXlsx } from "./gt.search.export.js";
import { createSupabaseClient, getSessionUser, signInGoogle, signOut } from "./gt.search.auth.js";
import { showKwPanel, loadMyKeywords, addKeyword, bindKeywordUIHandlers } from "./gt.search.keywords.js";

function $(id){ return document.getElementById(id); }

function setAuthButtons(user){
  const btnLogin = $("btnLogin");
  const btnLogout = $("btnLogout");
  if (!btnLogin || !btnLogout) return;

  if (user){
    btnLogin.style.display = "none";
    btnLogout.style.display = "inline-block";
  }else{
    btnLogin.style.display = "inline-block";
    btnLogout.style.display = "none";
  }
}

function getActivePeriod(){
  const wrap = document.getElementById("dateButtons");
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
  // DOM
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

  // Supabase
  const client = createSupabaseClient();
  let currentUser = await getSessionUser(client);
  setAuthButtons(currentUser);

  // ✅ default end date set
  applyPeriodToDates(getActivePeriod());

  // ---- keyword panel toggle ----
  showKwPanel(false);

  // bind keyword chip click -> put into search input and search
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

  // ---- auth buttons ----
  $("btnLogin")?.addEventListener("click", async () => {
    try{
      await signInGoogle(client);
    }catch(e){
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

  // auth state change
  client.auth.onAuthStateChange(async () => {
    currentUser = await getSessionUser(client);
    setAuthButtons(currentUser);

    // 키워드 패널이 열려 있으면 목록 갱신
    const kwPanel = $("kwPanel");
    if (kwPanel && kwPanel.style.display === "block" && currentUser){
      $("kwUserLine").innerHTML = `현재 로그인: <b>${currentUser.email || ""}</b>`;
      await loadMyKeywords(client, currentUser);
    }
    if (!currentUser) showKwPanel(false);
  });

  // keyword manage open/close
  btnKeywordManage?.addEventListener("click", async () => {
    currentUser = await getSessionUser(client);
    if (!currentUser){
      // 로그인 유도
      try{
        await signInGoogle(client);
      }catch(e){
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
    }
  });

  // add keyword
  kwAddBtn?.addEventListener("click", async () => {
    currentUser = await getSessionUser(client);
    const ok = await addKeyword(client, currentUser, kwInput?.value || "");
    if (ok){
      if (kwInput) kwInput.value = "";
      await loadMyKeywords(client, currentUser);
      setStatus("키워드가 추가되었습니다.");
    }
  });
  kwInput?.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") kwAddBtn?.click();
  });

  // date buttons behavior (set date inputs)
  const dateButtons = $("dateButtons");
  dateButtons?.addEventListener("click", (e) => {
    const btn = e.target.closest(".date-btn");
    if (!btn) return;
    const period = btn.getAttribute("data-period") || "all";
    applyPeriodToDates(period);
  });

  // ---- search state ----
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

    // ✅ 날짜 UI 값은 일단 meta로만 표시 (서버가 기간 지원하면 여기서 params로 붙이면 됨)
    const s = $("startDate")?.value || "";
    const e = $("endDate")?.value || "";
    const metaDate = (s || e) ? ` · 기간: ${s || "전체"} ~ ${e || "오늘"}` : "";

    try{
      const items = await gtSearchNews(q, { limit: 30 });
      lastItems = items;

      renderItems(items, `검색어: ${q} · 총 ${items.length}개${metaDate}`);

      // Excel 버튼: 결과가 있으면 보여줌 (kwPanel 안에 있으니 패널 열 때 보임)
      if (btnExportXlsx){
        btnExportXlsx.style.display = items.length ? "inline-block" : "none";
      }
    }catch(e){
      lastItems = [];
      if (btnExportXlsx) btnExportXlsx.style.display = "none";

      // ✅ 화면에는 친절하게
      showError(
        "검색에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        e?.message || String(e)
      );
      setStatus(`검색어: ${q} · 실패`);
    }
  }

  btnSearch.addEventListener("click", runSearch);
  qInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runSearch();
  });

  // Excel export (no snippet)
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

(() => {
  const SUPABASE_URL = 'https://toppqscjkkmmelpngzda.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_4eEtjEs8RtBFFWnpdTwRfg_DkXpAa7g';
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const postsEl = document.getElementById('posts');
  const statusEl = document.getElementById('status');
  const tabsEl = document.getElementById('tabs');

  const kwPanel = document.getElementById('kwPanel');
  const kwUserLine = document.getElementById('kwUserLine');
  const kwInput = document.getElementById('kwInput');
  const kwChips = document.getElementById('kwChips');
  const kwStatus = document.getElementById('kwStatus');
  const toastWrap = document.getElementById('toastWrap');

  let currentUser = null;
  let activeKeyword = 'Private Debt';
  let userKwFilter = null;

  // ✅ Private Debt 탭에서 관련 기사만 남기기 위한 동의어 세트
  const TAB_SYNONYMS = {
    'Private Debt': [
      'private debt',
      'private credit',
      'direct lending',
      'private lending',
      'middle market lending',
      'unitranche',
      'mezzanine',
      'senior secured',
      'loan fund',
      'credit fund',
      'private loan',
      'private loans',
      'private capital',
    ],
  };

  // ===== 안정화용: in-memory cache (같은 탭/키워드라면 2분 캐시) =====
  const _resultCache = new Map(); // key -> {ts, items}
  const RESULT_CACHE_MS = 2 * 60 * 1000;

  function escapeHTML(s){
    return (s ?? '')
      .toString()
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function showToast(text){
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    toastWrap.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 220);
    }, 1200);
  }

  function formatDateKo(d){
    if(!d) return '';
    try{ return new Date(d).toLocaleDateString('ko-KR'); }catch(e){ return ''; }
  }

  async function loadSession(){
    const { data } = await client.auth.getSession();
    currentUser = data?.session?.user ?? null;
  }

  // Login modal
  const loginModal = document.getElementById('loginModal');
  document.getElementById('closeLoginModal').addEventListener('click', () => {
    loginModal.style.display='none';
    document.body.style.overflow='';
  });
  loginModal.addEventListener('click', (e) => {
    if (e.target === loginModal){
      loginModal.style.display='none';
      document.body.style.overflow='';
    }
  });

  function openLoginModal(){
    loginModal.style.display='flex';
    document.body.style.overflow='hidden';
    renderLoginState();
  }

  async function renderLoginState(){
    const box = document.getElementById('loginStateBox');
    await loadSession();
    box.textContent = currentUser ? `현재 로그인: ${currentUser.email || ''}` : '현재 로그아웃 상태입니다.';
  }

  async function doGoogleOAuth(){
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname }
    });
    if (error) alert('로그인 실패: ' + error.message);
  }
  document.getElementById('btnGoogleLogin').addEventListener('click', doGoogleOAuth);
  document.getElementById('btnGoogleSignup').addEventListener('click', doGoogleOAuth);

  function showKwPanel(show){ kwPanel.style.display = show ? 'block' : 'none'; }

  function setActiveChipUI(){
    [...kwChips.querySelectorAll('.kw-chip')].forEach(ch => {
      ch.classList.toggle('active', ch.getAttribute('data-kw') === userKwFilter);
    });
  }

  // ✅ 테이블명: user_search_keywords
  async function loadMyKeywords(){
    kwStatus.textContent = '';
    kwChips.innerHTML = '<div class="muted" style="margin-top:0;">불러오는 중...</div>';
    if (!currentUser){ kwChips.innerHTML=''; kwStatus.textContent='로그인이 필요합니다.'; return; }

    const { data, error } = await client
      .from('user_search_keywords')
      .select('id, keyword, created_at')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending:false });

    if (error){ kwChips.innerHTML=''; kwStatus.textContent = error.message; return; }

    const rows = data || [];
    if (rows.length === 0){
      kwChips.innerHTML = '<div class="muted" style="margin-top:0;">저장된 키워드가 없습니다.</div>';
      return;
    }

    kwChips.innerHTML = rows.map(r => {
      const kw = (r.keyword || '').trim();
      return `
        <button class="kw-chip" data-kw="${escapeHTML(kw)}" type="button">
          <span>${escapeHTML(kw)}</span>
          <span class="kw-del" data-id="${escapeHTML(r.id)}" title="삭제">×</span>
        </button>
      `;
    }).join('');

    setActiveChipUI();
  }

  async function addKeyword(){
    const kw = (kwInput.value || '').trim();
    if (!kw){ kwStatus.textContent='키워드를 입력하세요.'; return; }
    if (!currentUser){ kwStatus.textContent='로그인이 필요합니다.'; return; }

    const { data: ex } = await client
      .from('user_search_keywords')
      .select('id')
      .eq('user_id', currentUser.id)
      .eq('keyword', kw)
      .limit(1);

    if (ex && ex.length){ kwStatus.textContent='이미 등록된 키워드입니다.'; return; }

    const { error } = await client
      .from('user_search_keywords')
      .insert([{ user_id: currentUser.id, keyword: kw }]);

    if (error){ kwStatus.textContent = error.message; return; }

    kwInput.value='';
    showToast('키워드가 추가되었습니다');
    await loadMyKeywords();
  }

  async function deleteKeyword(id){
    const { error } = await client
      .from('user_search_keywords')
      .delete()
      .eq('id', id)
      .eq('user_id', currentUser.id);

    if (error){ kwStatus.textContent = error.message; return; }

    if (userKwFilter){
      const stillExists = [...kwChips.querySelectorAll('.kw-del')].some(x => x.getAttribute('data-id') === id);
      if (!stillExists) userKwFilter = null;
    }

    showToast('키워드가 삭제되었습니다');
    await loadMyKeywords();
    await loadNews();
  }

  document.getElementById('kwAddBtn').addEventListener('click', addKeyword);
  kwInput.addEventListener('keydown', (e)=>{ if (e.key==='Enter') addKeyword(); });

  kwChips.addEventListener('click', async (e) => {
    const del = e.target.closest('.kw-del[data-id]');
    if (del){ e.stopPropagation(); await deleteKeyword(del.getAttribute('data-id')); return; }

    const chip = e.target.closest('.kw-chip');
    if (!chip) return;

    const kw = chip.getAttribute('data-kw');
    userKwFilter = (userKwFilter === kw) ? null : kw;
    setActiveChipUI();
    showToast(userKwFilter ? `키워드: ${userKwFilter}` : '키워드 해제');
    await loadNews();
  });

  document.getElementById('kwLogoutBtn').addEventListener('click', async () => {
    await client.auth.signOut();
    await loadSession();
    userKwFilter = null;
    showKwPanel(false);
    kwChips.innerHTML='';
    kwStatus.textContent='';
    kwUserLine.textContent='';
    showToast('로그아웃되었습니다');
    await loadNews();
  });

  document.getElementById('btnKeywordManage').addEventListener('click', async () => {
    await loadSession();
    if (!currentUser){ openLoginModal(); return; }

    const open = (kwPanel.style.display === 'block');
    showKwPanel(!open);

    if (!open){
      kwUserLine.innerHTML = '현재 로그인: <b>' + escapeHTML(currentUser.email || '') + '</b>';
      await loadMyKeywords();
    }
  });

  // 탭 클릭 → activeKeyword 변경 → 검색
  tabsEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('.tab');
    if (!btn) return;

    [...tabsEl.querySelectorAll('.tab')].forEach(t => t.classList.remove('active'));
    btn.classList.add('active');

    activeKeyword = btn.dataset.kw || 'Private Debt';
    showToast(`탭: ${activeKeyword}`);
    await loadNews();
  });

  function buildQueryKeyword(){
    return userKwFilter ? `${activeKeyword} ${userKwFilter}`.trim() : activeKeyword;
  }

  function normalizeText(s){
    return (s ?? '').toString().replace(/\s+/g,' ').trim().toLowerCase();
  }

  function isRelevantForTab(tab, item){
    const syns = TAB_SYNONYMS[tab];
    if (!syns || syns.length === 0) return true;

    const hay = normalizeText([
      item?.title,
      item?.snippet,
      item?.body,
      item?.content,
      item?.description
    ].filter(Boolean).join(' '));

    return syns.some(k => hay.includes(k.toLowerCase()));
  }

  function isRelevantForUserKeyword(userKw, item){
    if (!userKw) return true;
    const k = normalizeText(userKw);
    const hay = normalizeText([
      item?.title,
      item?.snippet,
      item?.body,
      item?.content,
      item?.description
    ].filter(Boolean).join(' '));
    return hay.includes(k);
  }

  function renderPosts(items, keyword, meta){
    if (!items.length){
      postsEl.innerHTML = `
        <div class="muted">표시할 기사가 없습니다.</div>
        <div class="muted" style="margin-top:10px;">
          <span class="pill">검색어: ${escapeHTML(keyword)}</span>
          ${meta?.hint ? `<span class="pill warn">${escapeHTML(meta.hint)}</span>` : ''}
        </div>
      `;
      statusEl.textContent = `검색어: ${keyword}`;
      return;
    }

    postsEl.innerHTML = items.map(it => {
      const title = it.title || '';
      const link = it.url || it.link || '#';
      const source = it.source || it.publisher || '';
      const date = it.date || it.pubDate || it.published_at || '';
      const snip = (it.snippet || it.body || it.description || '').toString().replace(/\s+/g,' ').trim();

      return `
        <div class="post">
          <div class="h">
            <h3 class="t">
              <a href="${escapeHTML(link)}" target="_blank" rel="noopener">${escapeHTML(title)}</a>
            </h3>
            <div class="d">${escapeHTML(formatDateKo(date) || date)}</div>
          </div>
          <div class="s">${escapeHTML(snip)}</div>
          <div class="muted" style="margin-top:8px;">
            ${source ? `<span class="pill">${escapeHTML(source)}</span>` : ``}
            <span class="pill">${escapeHTML(activeKeyword)}</span>
            ${userKwFilter ? `<span class="pill">${escapeHTML(userKwFilter)}</span>` : ``}
          </div>
        </div>
      `;
    }).join('');

    statusEl.textContent = `검색어: ${keyword}` + (meta?.note ? ` · ${meta.note}` : '');
  }

  // ===== 네트워크 안정화: timeout + retry + JSON 검사 =====
  function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

  async function fetchWithTimeout(url, ms, options = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      return await fetch(url, { ...options, signal: ctrl.signal });
    } finally {
      clearTimeout(t);
    }
  }

  async function fetchJsonRobust(url, {
    timeoutMs = 9000,
    retries = 2,
    baseDelayMs = 500,
    maxDelayMs = 2500
  } = {}) {
    let lastErr = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) {
          const jitter = Math.floor(Math.random() * 120);
          const backoff = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1)) + jitter;
          await sleep(backoff);
        }

        const res = await fetchWithTimeout(url, timeoutMs, { cache: 'no-store' });

        const ct = (res.headers.get('content-type') || '').toLowerCase();

        // JSON이 아닌 HTML 에러 페이지가 내려오면 여기서 잡아낸다
        if (!ct.includes('application/json')) {
          const txt = await res.text().catch(() => '');
          throw new Error(`non-json response (${res.status}): ${txt.slice(0, 120)}`);
        }

        const j = await res.json().catch(() => null);
        if (!res.ok) {
          const msg = (j && (j.error || j.message)) ? (j.error || j.message) : `Function error (${res.status})`;
          throw new Error(msg);
        }

        return j;
      } catch (e) {
        lastErr = e;
      }
    }

    throw lastErr || new Error('fetch failed');
  }

  function cacheKeyForResult(activeKeyword, userKwFilter){
    return `${activeKeyword}::${(userKwFilter || '').toLowerCase()}`;
  }

  async function loadNews(){
    postsEl.innerHTML = '<div class="muted">기사를 불러오는 중...</div>';
    statusEl.textContent = '';

    const keyword = buildQueryKeyword();

    // 2분 캐시: 되다말다 완화 + 체감 속도 향상
    const rKey = cacheKeyForResult(activeKeyword, userKwFilter);
    const cached = _resultCache.get(rKey);
    if (cached && (Date.now() - cached.ts) < RESULT_CACHE_MS) {
      renderPosts(cached.items, keyword, { note: `총 ${cached.items.length}개 (cache)` });
      return;
    }

    try{
      const url = `/.netlify/functions/investor-news?keyword=${encodeURIComponent(keyword)}`;

      // ✅ robust fetch
      const j = await fetchJsonRobust(url, {
        timeoutMs: 10000,
        retries: 2,
        baseDelayMs: 600,
        maxDelayMs: 2400
      });

      const rawItems = Array.isArray(j?.items) ? j.items : [];

      // ✅ 1차: 탭 관련성 필터
      const tabFiltered = rawItems.filter(it => isRelevantForTab(activeKeyword, it));

      // ✅ 2차: 내 키워드 본문 포함 필터
      const finalItems = tabFiltered.filter(it => isRelevantForUserKeyword(userKwFilter, it));

      // ✅ 결과 0 처리
      if (finalItems.length === 0 && rawItems.length > 0){
        if (userKwFilter){
          renderPosts(tabFiltered, keyword, { hint: '내 키워드가 기사 본문 또는 제목에 포함된 결과가 없습니다' });
          _resultCache.set(rKey, { ts: Date.now(), items: tabFiltered });
          return;
        }
      }

      if (tabFiltered.length === 0 && rawItems.length > 0){
        renderPosts(rawItems, keyword, { hint: '서버 결과가 탭과 무관해 보여 전체를 표시합니다' });
        _resultCache.set(rKey, { ts: Date.now(), items: rawItems });
        return;
      }

      renderPosts(finalItems, keyword, { note: `총 ${finalItems.length}개` });
      _resultCache.set(rKey, { ts: Date.now(), items: finalItems });

    }catch(err){
      postsEl.innerHTML = '<div class="muted">기사를 불러오는 중 오류가 발생했습니다.</div>';
      statusEl.textContent = err?.message ? err.message : String(err);
    }
  }

  (async function init(){
    await loadSession();
    await loadNews();

    client.auth.onAuthStateChange(async () => {
      await loadSession();
      if (kwPanel.style.display === 'block' && currentUser){
        kwUserLine.innerHTML = '현재 로그인: <b>' + escapeHTML(currentUser.email || '') + '</b>';
        await loadMyKeywords();
      }
      if (!currentUser) showKwPanel(false);
    });
  })();
})();

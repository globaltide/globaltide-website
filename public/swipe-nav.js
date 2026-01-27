// swipe-nav.js (IFRAME PREVIEW + FIX: no double-click)
(() => {
  const ROUTES = [
    { key: 'index',  paths: ['/', '/index.html'] },
    { key: 'board',  paths: ['/board', '/board.html'] },
    { key: 'now',    paths: ['/now', '/now.html'] },
    { key: 'search', paths: ['/search', '/search.html'] },
  ];
  const ORDER = ROUTES.map(r => r.paths[0]);

  const ARM_PX = 12;          // ✅ 이 거리 이상 움직여야 스와이프 시작
  const MIN_SWIPE_PX = 70;
  const TRIGGER_RATIO = 0.22;
  const MAX_OFF_AXIS = 90;
  const EDGE_IGNORE = 10;

  const ANIM_MS = 220;
  const PREVIEW_OVERLAY_Z = 2147483646;

  const WHEEL_MIN = 90;
  const WHEEL_LOCK_MS = 650;

  function normalizePath(p) {
    if (!p) return '/';
    if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
    return p;
  }
  function getIndexByPath(pathname) {
    const p = normalizePath(pathname);
    for (let i = 0; i < ROUTES.length; i++) {
      if (ROUTES[i].paths.map(normalizePath).includes(p)) return i;
    }
    return -1;
  }

  const pathname = normalizePath(location.pathname || '/');
  const idx = getIndexByPath(pathname);
  if (idx < 0) return;

  function injectCSS() {
    if (document.getElementById('swipe-nav-style')) return;
    const style = document.createElement('style');
    style.id = 'swipe-nav-style';
    style.textContent = `
      html, body { overscroll-behavior-x: none; }
      #swipe-root{
        height:100%;
        will-change:transform;
        transform:translate3d(0,0,0);
        backface-visibility:hidden;
        touch-action:pan-y;
      }

      .swipe-preview-layer{
        position:fixed;
        inset:0;
        z-index:${PREVIEW_OVERLAY_Z};
        pointer-events:none;
        overflow:hidden;
        background:transparent;
      }
      .swipe-preview-frame{
        position:absolute;
        top:0; bottom:0;
        width:100vw;
        border:0;
        background:#fff;
      }
      .swipe-preview-shadow{
        position:absolute;
        top:0; bottom:0;
        width:14px;
        background:linear-gradient(to right, rgba(0,0,0,0.10), rgba(0,0,0,0));
      }
    `;
    document.head.appendChild(style);
  }

  function rafTransform(el){
    let rafId = 0;
    let pendingX = 0;
    return {
      set(x){
        pendingX = x;
        if (!rafId){
          rafId = requestAnimationFrame(() => {
            rafId = 0;
            el.style.transform = `translate3d(${pendingX}px,0,0)`;
          });
        }
      }
    };
  }

  function ensureSwipeRoot(){
    let root = document.getElementById('swipe-root');
    if (root) return root;

    root = document.createElement('div');
    root.id = 'swipe-root';

    const keepOutsideSelectors = ['#loginModal'];
    const keepOutside = new Set(
      keepOutsideSelectors.map(sel => Array.from(document.querySelectorAll(sel))).flat()
    );

    const nodes = Array.from(document.body.childNodes);
    for (const n of nodes){
      if (n.nodeType === Node.ELEMENT_NODE){
        let cur = n;
        let keep = false;
        while (cur && cur !== document.body){
          if (keepOutside.has(cur)){ keep = true; break; }
          cur = cur.parentElement;
        }
        if (keep) continue;
      }
      root.appendChild(n);
    }
    document.body.insertBefore(root, document.body.firstChild);
    return root;
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function init(){
    injectCSS();
    const root = ensureSwipeRoot();
    const tx = rafTransform(root);

    let locked = false;

    function setTransition(on){
      root.style.transition = on ? `transform ${ANIM_MS}ms cubic-bezier(.2,.8,.2,1)` : 'none';
    }

    // ---- Preview Layer ----
    let layer = null, prevFrame = null, nextFrame = null, prevShadow = null, nextShadow = null;
    let previewActive = false;

    function createPreviewLayer(){
      if (layer) return;

      layer = document.createElement('div');
      layer.className = 'swipe-preview-layer';

      prevFrame = document.createElement('iframe');
      prevFrame.className = 'swipe-preview-frame';
      prevFrame.setAttribute('aria-hidden', 'true');
      prevFrame.loading = 'eager';

      nextFrame = document.createElement('iframe');
      nextFrame.className = 'swipe-preview-frame';
      nextFrame.setAttribute('aria-hidden', 'true');
      nextFrame.loading = 'eager';

      prevShadow = document.createElement('div');
      prevShadow.className = 'swipe-preview-shadow';

      nextShadow = document.createElement('div');
      nextShadow.className = 'swipe-preview-shadow';

      layer.appendChild(prevFrame);
      layer.appendChild(prevShadow);
      layer.appendChild(nextFrame);
      layer.appendChild(nextShadow);

      document.body.appendChild(layer);
    }

    function destroyPreviewLayer(){
      if (!layer) return;
      layer.remove();
      layer = null; prevFrame = null; nextFrame = null; prevShadow = null; nextShadow = null;
      previewActive = false;
    }

    function preparePreviews(){
      createPreviewLayer();
      const vw = window.innerWidth;

      prevFrame.style.left = (-vw) + 'px';
      nextFrame.style.left = (vw) + 'px';

      prevShadow.style.left = '0px';
      prevShadow.style.opacity = '0';

      nextShadow.style.left = (vw - 14) + 'px';
      nextShadow.style.opacity = '0';

      if (idx > 0) prevFrame.src = ORDER[idx - 1]; else prevFrame.removeAttribute('src');
      if (idx < ORDER.length - 1) nextFrame.src = ORDER[idx + 1]; else nextFrame.removeAttribute('src');

      previewActive = true;
    }

    function movePreviews(dx){
      if (!previewActive || !layer) return;
      const vw = window.innerWidth;
      const t = `translate3d(${dx}px,0,0)`;

      prevFrame.style.transform = t;
      nextFrame.style.transform = t;

      if (dx > 0 && idx > 0) {
        prevShadow.style.transform = t;
        prevShadow.style.opacity = String(clamp(dx / (vw * 0.25), 0, 1));
        nextShadow.style.opacity = '0';
      } else if (dx < 0 && idx < ORDER.length - 1) {
        nextShadow.style.transform = t;
        nextShadow.style.opacity = String(clamp((-dx) / (vw * 0.25), 0, 1));
        prevShadow.style.opacity = '0';
      } else {
        prevShadow.style.opacity = '0';
        nextShadow.style.opacity = '0';
      }
    }

    function resetAll(){
      setTransition(true);
      tx.set(0);
      movePreviews(0);
      setTimeout(() => {
        setTransition(false);
        destroyPreviewLayer();
      }, ANIM_MS + 40);
    }

    function go(to){
      if (locked) return;
      if (to < 0 || to >= ORDER.length) return;
      locked = true;
      setTimeout(() => { location.href = ORDER[to]; }, 60);
    }

    // ---- Gesture state ----
    let armed = false;     // ✅ 눌렀지만 아직 스와이프 시작 전
    let dragging = false;  // ✅ 실제 스와이프 모드
    let sx = 0, sy = 0, dx = 0;

    function arm(x,y){
      if (locked) return;
      if (x <= EDGE_IGNORE) return;
      armed = true;
      dragging = false;
      sx = x; sy = y; dx = 0;
      // ✅ 여기서는 프리뷰/트랜스폼 아무것도 안 함 (클릭 방해 X)
    }

    function shouldStartSwipe(x,y){
      const ox = x - sx;
      const oy = y - sy;
      const ax = Math.abs(ox);
      const ay = Math.abs(oy);
      // 가로가 세로보다 크고, ARM_PX 이상 움직였을 때만 시작
      return ax >= ARM_PX && ax > ay;
    }

    function startSwipe(){
      dragging = true;
      setTransition(false);
      preparePreviews();
    }

    function move(x,y){
      if (!armed || locked) return;

      const ox = x - sx;
      const oy = y - sy;

      // 세로로 많이 움직이면 그냥 취소 (스크롤 의도)
      if (Math.abs(oy) > MAX_OFF_AXIS && Math.abs(oy) > Math.abs(ox)) {
        armed = false;
        if (dragging) resetAll();
        return;
      }

      // 아직 스와이프 모드가 아니면 "가로 의도"가 생길 때만 시작
      if (!dragging) {
        if (!shouldStartSwipe(x,y)) return;
        startSwipe();
      }

      dx = ox;
      const vw = Math.min(window.innerWidth, 900);
      const limit = vw * 0.60;
      const val = clamp(dx, -limit, limit);

      tx.set(val);
      movePreviews(val);
    }

    function end(){
      if (!armed || locked) return;

      // ✅ armed만 하고 dragging이 아니면: 그냥 탭(클릭) 처리로 둔다
      if (!dragging) {
        armed = false;
        return;
      }

      armed = false;
      dragging = false;

      const vw = Math.min(window.innerWidth, 900);
      const trigger = Math.max(MIN_SWIPE_PX, vw * TRIGGER_RATIO);

      if (dx < -trigger && idx < ORDER.length - 1){
        setTransition(true);
        tx.set(-vw);
        movePreviews(-vw);
        setTimeout(() => go(idx + 1), ANIM_MS * 0.55);
        return;
      }
      if (dx > trigger && idx > 0){
        setTransition(true);
        tx.set(vw);
        movePreviews(vw);
        setTimeout(() => go(idx - 1), ANIM_MS * 0.55);
        return;
      }

      resetAll();
    }

    // Touch
    window.addEventListener('touchstart', e=>{
      if (e.touches?.length === 1){
        const t = e.touches[0];
        arm(t.clientX, t.clientY);
      }
    }, { passive:true });

    window.addEventListener('touchmove', e=>{
      const t = e.touches?.[0];
      if (t) move(t.clientX, t.clientY);
    }, { passive:true });

    window.addEventListener('touchend', end, { passive:true });
    window.addEventListener('touchcancel', ()=>{ armed=false; dragging=false; resetAll(); }, { passive:true });

    // Pointer
    let pDown = false;
    window.addEventListener('pointerdown', e=>{
      if (e.button !== 0) return;
      pDown = true;
      arm(e.clientX, e.clientY);
    }, { passive:true });

    window.addEventListener('pointermove', e=>{
      if (!pDown) return;
      move(e.clientX, e.clientY);
    }, { passive:true });

    window.addEventListener('pointerup', ()=>{
      if (!pDown) return;
      pDown = false;
      end();
    }, { passive:true });

    window.addEventListener('pointercancel', ()=>{
      pDown = false;
      armed = false;
      dragging = false;
      resetAll();
    }, { passive:true });

    // Trackpad wheel fallback (quick nav)
    let wheelLock = false;
    window.addEventListener('wheel', e=>{
      if (locked || wheelLock) return;

      const wx = e.deltaX || 0;
      const wy = e.deltaY || 0;
      if (Math.abs(wx) <= Math.abs(wy)) return;
      if (Math.abs(wx) < WHEEL_MIN) return;

      wheelLock = true;
      setTimeout(()=>wheelLock=false, WHEEL_LOCK_MS);

      if (wx > 0) go(idx + 1);
      else go(idx - 1);
    }, { passive:true });

    window.addEventListener('resize', () => {
      armed = false;
      dragging = false;
      resetAll();
    }, { passive:true });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init, { once:true });
  } else {
    init();
  }
})();

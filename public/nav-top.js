// nav-top.js — GlobalTide top nav injector (AUTO HEIGHT)
(() => {
  const TOP_NAV = {
    brand: { label: "GT", href: "/" },
    items: [
      { label: "Board", href: "/board", match: ["/board", "/board.html"] },
      { label: "Now", href: "/now", match: ["/now", "/now.html"] },
      { label: "Search", href: "/search", match: ["/search", "/search.html"] },

      { label: "InvNews", title: "Investor News", href: "/investor-news", match: ["/investor-news", "/investor-news.html"] },

      { label: "RFP", href: "/rfp", match: ["/rfp", "/rfp.html"] },
      { label: "PD", href: "/pd", match: ["/pd", "/pd.html"] },
      { label: "PE", href: "/pe", match: ["/pe", "/pe.html"] },
      { label: "INFRA", href: "/infra", match: ["/infra", "/infra.html"] },
      { label: "RE", href: "/re", match: ["/re", "/re.html"] },
      { label: "Interval", href: "/interval", match: ["/interval", "/interval.html"] },
    ],
  };

  function norm(p){
    if (!p) return "/";
    p = p.split("?")[0].split("#")[0];
    if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
    return p;
  }

  function isActive(item, path){
    const p = norm(path);
    return (item.match || []).map(norm).includes(p);
  }

  function ensureCSS(){
    if (document.getElementById("gt-topnav-style")) return;
    const s = document.createElement("style");
    s.id = "gt-topnav-style";
    s.textContent = `
      :root{
        --gt-border:#e5e7eb;
        --gt-active:#111;
      }
      .gt-topnav{
        position:sticky;
        top:0;
        z-index:50;
        background:#fff;
        border-bottom:1px solid var(--gt-border);
      }
      .gt-topnav-inner{
        max-width:1100px;
        margin:0 auto;
        padding:10px 14px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
      }
      .gt-home{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        height:34px;
        padding:0 12px;
        border-radius:12px;
        background:#f3f4f6;
        border:1px solid var(--gt-border);
        color:#111;
        text-decoration:none;
        font-weight:900;
      }
      .gt-topmenu{
        display:flex;
        gap:6px;
        align-items:center;
        flex-wrap:nowrap;
      }
      .gt-topmenu a{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        height:34px;
        padding:0 12px;
        border-radius:12px;
        border:1px solid var(--gt-border);
        background:#fff;
        color:#111;
        text-decoration:none;
        font-weight:900;
        font-size:14px;
        white-space:nowrap;
      }
      .gt-topmenu a.active{
        background:var(--gt-active);
        color:#fff;
        border-color:var(--gt-active);
      }
      @media (max-width:420px){
        .gt-topmenu{
          overflow:auto;
          -webkit-overflow-scrolling:touch;
          scrollbar-width:none;
        }
        .gt-topmenu::-webkit-scrollbar{ display:none; }
        .gt-topmenu a{ padding:0 10px; font-size:13px; }
      }
    `;
    document.head.appendChild(s);
  }

  function removeExistingTop(){
    document.querySelectorAll(".topnav, .gt-topnav").forEach(el => el.remove());
  }

  function buildTop(path){
    const nav = document.createElement("nav");
    nav.className = "gt-topnav";

    const inner = document.createElement("div");
    inner.className = "gt-topnav-inner";

    const home = document.createElement("a");
    home.className = "gt-home";
    home.href = TOP_NAV.brand.href;
    home.textContent = TOP_NAV.brand.label;

    const menu = document.createElement("div");
    menu.className = "gt-topmenu";

    TOP_NAV.items.forEach(item => {
      const a = document.createElement("a");
      a.href = item.href;
      a.textContent = item.label;
      if (item.title) a.title = item.title;
      if (isActive(item, path)) a.classList.add("active");
      menu.appendChild(a);
    });

    inner.appendChild(home);
    inner.appendChild(menu);
    nav.appendChild(inner);
    return nav;
  }

  function setTopNavHeightVar(){
    const el = document.querySelector(".gt-topnav");
    if (!el) return;

    const apply = () => {
      const h = Math.ceil(el.getBoundingClientRect().height || 0);
      if (h > 0) document.documentElement.style.setProperty("--gt-topnav-h", h + "px");
    };

    apply();
    window.addEventListener("resize", apply, { passive:true });

    if (document.fonts?.ready) document.fonts.ready.then(apply).catch(()=>{});

    if (window.ResizeObserver) {
      const ro = new ResizeObserver(apply);
      ro.observe(el);
    }
  }

  function mount(){
    ensureCSS();
    removeExistingTop();
    document.body.insertBefore(buildTop(location.pathname), document.body.firstChild);
    setTopNavHeightVar();
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", mount, { once:true });
  } else {
    mount();
  }
})();

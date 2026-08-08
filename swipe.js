// 모바일 좌/우 스와이프 페이지 이동 (≤760px) — 손가락 추종 드래그 + 슬라이드 전환
(function () {
  const PAGES = ["index.html", "history.html", "pnl.html", "positions.html", "orders.html", "risk.html"];
  const cur = (location.pathname.split("/").pop() || "index.html");
  const idx = PAGES.indexOf(cur);
  const shell = () => document.querySelector(".app-shell");

  // 진입 애니메이션: 이전 페이지에서 스와이프로 넘어온 경우 슬라이드 인
  const dir = sessionStorage.getItem("swipeDir");
  if (dir) {
    sessionStorage.removeItem("swipeDir");
    const boot = () => {
      const s = shell();
      if (!s) return;
      s.style.transition = "none";
      s.style.transform = `translateX(${dir === "left" ? "" : "-"}30vw)`;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        s.style.transition = "transform .26s ease-out";
        s.style.transform = "translateX(0)";
        setTimeout(() => { s.style.transition = ""; s.style.transform = ""; }, 320);
      }));
    };
    (document.readyState === "loading") ? document.addEventListener("DOMContentLoaded", boot) : boot();
  }

  if (idx < 0) return;   // settings 등은 스와이프 순환 제외
  let sx = 0, sy = 0, st = 0, lock = null;

  function blockedTarget(t) {
    const el = t instanceof Element ? t : (t && t.parentElement);
    return el && el.closest(".table-wrap,.order-table,.risk-table,.hist-table,.cmdbox,.uni-results,input");
  }

  document.addEventListener("touchstart", e => {
    if (window.innerWidth > 760) return;
    const login = document.getElementById("login");
    if (login && !login.hidden) return;
    if (blockedTarget(e.target)) { st = 0; return; }
    const t = e.touches[0];
    sx = t.clientX; sy = t.clientY; st = Date.now(); lock = null;
  }, { passive: true });

  document.addEventListener("touchmove", e => {
    if (!st || window.innerWidth > 760) return;
    const t = e.touches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    if (lock === null) {
      if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.4) lock = "h";
      else if (Math.abs(dy) > 14) lock = "v";
    }
    if (lock !== "h") return;
    e.preventDefault();                      // 수평 제스처 중 세로 스크롤 방지
    const s = shell(); if (!s) return;
    const next = dx < 0 ? idx + 1 : idx - 1;
    const edge = next < 0 || next >= PAGES.length;
    s.style.transition = "none";
    s.style.transform = `translateX(${edge ? dx * 0.25 : dx * 0.85}px)`;   // 끝 페이지=저항감
  }, { passive: false });

  document.addEventListener("touchend", e => {
    if (!st || lock !== "h") { st = 0; lock = null; return; }
    const t = e.changedTouches[0];
    const dx = t.clientX - sx;
    st = 0; lock = null;
    const s = shell(); if (!s) return;
    const next = dx < 0 ? idx + 1 : idx - 1;
    const go = Math.abs(dx) > Math.min(90, window.innerWidth * 0.24) && next >= 0 && next < PAGES.length;
    if (go) {
      // 현재 페이지 슬라이드 아웃 → 다음 페이지가 반대편에서 슬라이드 인
      s.style.transition = "transform .18s ease-in";
      s.style.transform = `translateX(${dx < 0 ? "-" : ""}100vw)`;
      sessionStorage.setItem("swipeDir", dx < 0 ? "left" : "right");
      setTimeout(() => { location.href = PAGES[next]; }, 160);
    } else {
      // 스냅백
      s.style.transition = "transform .22s cubic-bezier(.2,.8,.3,1)";
      s.style.transform = "translateX(0)";
      setTimeout(() => { s.style.transition = ""; s.style.transform = ""; }, 260);
    }
  }, { passive: true });
})();

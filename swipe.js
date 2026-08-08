// 모바일 좌/우 스와이프 → 메뉴 순서대로 페이지 이동 (≤760px에서만)
(function () {
  const PAGES = ["index.html", "history.html", "pnl.html", "positions.html", "orders.html", "risk.html"];
  const cur = (location.pathname.split("/").pop() || "index.html");
  const idx = PAGES.indexOf(cur);
  if (idx < 0) return;                       // settings 등은 스와이프 순환 제외
  let sx = 0, sy = 0, st = 0;

  document.addEventListener("touchstart", e => {
    if (window.innerWidth > 760) return;
    const t = e.touches[0];
    sx = t.clientX; sy = t.clientY; st = Date.now();
  }, { passive: true });

  document.addEventListener("touchend", e => {
    if (window.innerWidth > 760 || !st) return;
    // 로그인 화면·가로스크롤 요소 위에서는 무시
    const login = document.getElementById("login");
    if (login && !login.hidden) return;
    const el = e.target instanceof Element ? e.target : (e.target && e.target.parentElement);
    if (el && el.closest(".table-wrap,.order-table,.risk-table,.hist-table,.cmdbox,.uni-results,input")) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy, dt = Date.now() - st;
    st = 0;
    if (dt > 600 || Math.abs(dx) < 70 || Math.abs(dy) > 50) return;   // 빠른 수평 스와이프만
    const next = dx < 0 ? idx + 1 : idx - 1;   // 왼쪽 스와이프=다음, 오른쪽=이전
    if (next >= 0 && next < PAGES.length) location.href = PAGES[next];
  }, { passive: true });
})();

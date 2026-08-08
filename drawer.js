// 모바일 좌측 드로어 — 햄버거(≡) → 사이드바가 좌측에서 슬라이드
(function () {
  function init() {
    const sidebar = document.querySelector(".app-shell .sidebar");
    if (!sidebar || document.getElementById("navToggle")) return;

    // 햄버거 버튼(좌상단) + 딤 오버레이 주입
    const btn = document.createElement("button");
    btn.id = "navToggle"; btn.setAttribute("aria-label", "메뉴");
    btn.innerHTML = "<span></span><span></span><span></span>";
    const dim = document.createElement("div");
    dim.id = "navDim";
    document.body.appendChild(btn);
    document.body.appendChild(dim);

    const open = () => { document.body.classList.add("nav-open"); };
    const close = () => { document.body.classList.remove("nav-open"); };
    btn.addEventListener("click", () => document.body.classList.toggle("nav-open"));
    dim.addEventListener("click", close);
    // 메뉴 항목 누르면 닫힘(이동 전)
    sidebar.addEventListener("click", e => { if (e.target.closest("a")) close(); });
    // 데스크톱으로 리사이즈되면 강제 닫기
    window.addEventListener("resize", () => { if (window.innerWidth > 760) close(); });
  }
  (document.readyState === "loading") ? document.addEventListener("DOMContentLoaded", init) : init();
  // 사이드바가 JS로 뒤늦게 주입되는 페이지(common.js) 대응
  setTimeout(init, 300);
})();

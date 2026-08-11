// 공용 차트 툴팁 — 모든 SVG 차트에서 라인/포인트를 선택(호버·탭)하면 해당 일자 데이터를 표시.
// 드릴다운과 독립. 의존성 없음(전역 window.attachChartTip 하나만 노출).
//
// 사용: attachChartTip(svgId, points, {W,H})
//   points = [{ x, label, rows:[{k, v, cls}] }]   // x=viewBox X좌표(0..W), label=일자/시각, rows=키·값
//   같은 svgId로 다시 호출하면 포인트만 갱신(리스너 중복 방지). preserveAspectRatio=none(stretch) 가정.
(function () {
  function tipEl() {
    let t = document.getElementById("__chartTip");
    if (!t) {
      t = document.createElement("div");
      t.id = "__chartTip";
      t.style.cssText =
        "position:fixed;z-index:99999;pointer-events:none;display:none;" +
        "background:#12201b;border:1px solid #2c4239;border-radius:8px;padding:7px 10px;" +
        "font:12px/1.55 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;color:#e6f0ea;" +
        "box-shadow:0 6px 22px rgba(0,0,0,.45);min-width:118px;white-space:nowrap";
      document.body.appendChild(t);
    }
    return t;
  }

  window.attachChartTip = function (svgId, points, opts) {
    opts = opts || {};
    var svg = document.getElementById(svgId);
    if (!svg || !points || !points.length) return;
    svg.__tipPts = points;
    svg.__tipW = opts.W || 620;
    svg.__tipH = opts.H || 200;
    if (svg.__tipBound) return;      // 리스너는 최초 1회만 (재렌더 시 포인트만 갱신)
    svg.__tipBound = true;
    var tip = tipEl();

    function nearest(clientX) {
      var r = svg.getBoundingClientRect();
      if (!r.width) return null;
      var ratio = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
      var vbx = ratio * svg.__tipW, pts = svg.__tipPts, best = pts[0], bd = Infinity;
      for (var i = 0; i < pts.length; i++) {
        var dd = Math.abs(pts[i].x - vbx);
        if (dd < bd) { bd = dd; best = pts[i]; }
      }
      return best;
    }
    function cross(x) {
      var ln = svg.querySelector(".__xcross");
      if (!ln) {
        ln = document.createElementNS("http://www.w3.org/2000/svg", "line");
        ln.setAttribute("class", "__xcross");
        ln.setAttribute("stroke", "#f5c969");
        ln.setAttribute("stroke-width", "1");
        ln.setAttribute("stroke-dasharray", "3 3");
        ln.setAttribute("vector-effect", "non-scaling-stroke");
        ln.style.pointerEvents = "none";
        svg.appendChild(ln);
      }
      ln.setAttribute("x1", x); ln.setAttribute("x2", x);
      ln.setAttribute("y1", 0); ln.setAttribute("y2", svg.__tipH);
      ln.style.display = "";
    }
    function move(e) {
      var cx = e.touches ? e.touches[0].clientX : e.clientX;
      var cy = e.touches ? e.touches[0].clientY : e.clientY;
      var p = nearest(cx);
      if (!p) return;
      cross(p.x);
      tip.innerHTML =
        '<div style="font-weight:600;margin-bottom:3px;color:#f5c969">' + p.label + "</div>" +
        p.rows.map(function (r) {
          return '<div style="display:flex;justify-content:space-between;gap:16px">' +
            '<span style="color:#8fa89e">' + r.k + "</span>" +
            '<span class="' + (r.cls || "") + '" style="font-variant-numeric:tabular-nums">' + r.v + "</span></div>";
        }).join("");
      tip.style.display = "block";
      var tw = tip.offsetWidth, th = tip.offsetHeight, left = cx + 14, top = cy - th / 2;
      if (left + tw > window.innerWidth - 8) left = cx - tw - 14;
      if (top < 8) top = 8;
      if (top + th > window.innerHeight - 8) top = window.innerHeight - th - 8;
      tip.style.left = left + "px"; tip.style.top = top + "px";
    }
    function leave() {
      tip.style.display = "none";
      var ln = svg.querySelector(".__xcross");
      if (ln) ln.style.display = "none";
    }
    svg.style.cursor = "crosshair";
    svg.addEventListener("pointermove", move);
    svg.addEventListener("pointerdown", move);
    svg.addEventListener("pointerleave", leave);
    svg.addEventListener("touchmove", move, { passive: true });
    svg.addEventListener("touchend", leave);
  };
})();

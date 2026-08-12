// Orders — 주문 생명주기 (읽기 전용, 브로커ID·clientOrderId 미노출)
const STATUS_KO = {
  INTENT_CREATED: ["의도 생성", "muted"], SUBMITTING: ["전송 중", "amber"],
  ACCEPTED: ["접수", "green"], PARTIALLY_FILLED: ["부분 체결", "amber"],
  FILLED: ["전량 체결", "green"], REJECTED: ["거절", "red"],
  CANCEL_PENDING: ["취소 대기", "amber"], CANCELLED: ["취소 완료", "muted"],
  BLOCKED: ["정책 차단", "amber"], UNKNOWN: ["RECONCILING", "amber"],
};
const FILTERS = {
  all: () => true,
  filled: o => o.status === "FILLED" || o.status === "PARTIALLY_FILLED",
  open: o => ["INTENT_CREATED", "SUBMITTING", "ACCEPTED", "PARTIALLY_FILLED", "UNKNOWN"].includes(o.status),
  blocked: o => o.status === "REJECTED" || o.status === "BLOCKED",
  cancelled: o => o.status === "CANCEL_PENDING" || o.status === "CANCELLED",
};
let ORDERS = [];

let STATUS_F = "all", STOCK_F = "all";

function drawRows() {
  const rows = ORDERS.filter(FILTERS[STATUS_F] || FILTERS.all)
                     .filter(o => STOCK_F === "all" || o.code === STOCK_F);
  document.getElementById("ordRows").innerHTML = rows.length ? rows.map(o => {
    const [ko, tone] = STATUS_KO[o.status] || [o.status, "muted"];
    const price = o.price ? "₩" + o.price.toLocaleString("ko-KR") : "—";
    const totAmt = (o.qty > 1 && o.amount) ? `<small>총 ₩${o.amount.toLocaleString("ko-KR")}</small>` : "";
    return `<div class="order-row">
      <span class="mono">${o.time}</span>
      <span><b>${o.name}</b><small>${o.code}</small></span>
      <span><b class="${o.side === "BUY" ? "up" : "down"}">${o.side === "BUY" ? "매수" : "매도"}</b><small>${o.qty}주 · PAPER</small></span>
      <span><b class="${o.side === "BUY" ? "up" : "down"}">${price}</b>${totAmt}</span>
      <span><em class="pill ${tone}">${ko}</em></span>
      <span>${o.reason || "—"}</span>
    </div>`;
  }).join("") : `<p class="empty-note">해당 조건의 체결 내역이 없습니다.</p>`;
}

function buildStockFilter() {
  const seen = new Map();
  ORDERS.forEach(o => { if (!seen.has(o.code)) seen.set(o.code, o.name || o.code); });
  const chips = [`<button class="active" data-s="all">전체 종목</button>`]
    .concat([...seen].map(([code, name]) => `<button data-s="${code}">${name}</button>`));
  const box = document.getElementById("ordStockFilters");
  if (!box) return;
  box.innerHTML = seen.size ? chips.join("") : "";
  box.querySelectorAll("button").forEach(b => b.onclick = () => {
    box.querySelectorAll("button").forEach(x => x.classList.remove("active"));
    b.classList.add("active"); STOCK_F = b.dataset.s; drawRows();
  });
}

function render(d) {
  document.getElementById("sideNav").innerHTML = sideNav("orders");
  wireLock(); metaBadge(d);
  const op = d.ordersPage || { summary: {}, orders: [] };
  ORDERS = op.orders || [];
  const s = op.summary;

  $("ordStats").innerHTML = `
    <div><small>주문 의도</small><b>${s.intentCount ?? 0}</b><em>PAPER 모드</em></div>
    <div><small>체결</small><b class="up">${s.filledCount ?? 0}</b><em>부분체결 포함</em></div>
    <div><small>차단·취소</small><b>${s.blockedOrCancelledCount ?? 0}</b><em>정책·거절 포함</em></div>
    <div><small>미정합 주문</small><b class="${(s.unreconciledCount || 0) > 0 ? 'down' : 'up'}">${s.unreconciledCount ?? 0}</b><em>${(s.unreconciledCount || 0) > 0 ? "RECONCILING" : "Reconciliation 정상"}</em></div>`;

  buildStockFilter();
  drawRows();
  document.querySelectorAll("#ordFilters button").forEach(b => b.onclick = () => {
    document.querySelectorAll("#ordFilters button").forEach(x => x.classList.remove("active"));
    b.classList.add("active"); STATUS_F = b.dataset.f; drawRows();
  });

  const healthy = (s.unreconciledCount || 0) === 0;
  const rh = $("reconHealth");
  rh.className = "health" + (healthy ? "" : " warn");
  rh.innerHTML = `<i></i> ${healthy ? "HEALTHY" : "RECONCILING"}`;
  $("reconList").innerHTML = `
    <li><span>로컬 주문 의도</span><b>${s.intentCount ?? 0}건</b></li>
    <li><span>체결 확정</span><b>${s.filledCount ?? 0}건</b></li>
    <li><span>미체결/부분체결</span><b>${s.unreconciledCount ?? 0}건</b></li>
    <li><span>데이터 기준</span><b>${d.generatedAt || "—"}</b></li>`;

  // 정책 카드: FAIL_CLOSED·킬스위치·매수잠금 시 표시
  const rp = d.riskPage || {};
  const blockedGates = (rp.gates || []).filter(g => g.state !== "PASS");
  if (blockedGates.length) {
    $("policyCard").hidden = false;
    const buyBlocked = rp.failClosed && rp.failClosed.buyFailClosed;
    $("policyTitle").textContent = buyBlocked ? "신규 매수는 차단 상태입니다." : "일부 게이트가 통과되지 않았습니다.";
    $("policyBody").textContent = blockedGates.map(g => `${g.label}: ${g.reason}`).join(" · ")
      + " — 보호 매도와 정합성 확인은 계속 실행됩니다.";
    $("policyCode").textContent = buyBlocked ? "BUY_FAIL_CLOSED" : blockedGates.map(g => g.code).join(" · ");
  }
}
guardAndLoad(render);

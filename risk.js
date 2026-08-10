// Risk monitor — 방어선·게이트·점수(산정 항목 포함). 읽기 전용.
function render(d) {
  document.getElementById("sideNav").innerHTML = sideNav("risk");
  wireLock(); metaBadge(d);
  const rp = d.riskPage || {};
  const m = rp.metrics || {};

  // 상단 경고 (PAUSED/STOPPED)
  if (["BUY_PAUSED", "CHALLENGE_STOPPED"].includes(rp.strategyMode)) {
    const el = $("stateAlert"); el.hidden = false;
    el.textContent = rp.strategyMode === "CHALLENGE_STOPPED"
      ? "⚠️ 3개월 도전 종료선 도달 — 신규매수 전면 중단, 자본보존 모드입니다."
      : "⚠️ 신규매수 일시중단 상태입니다. 손절·추적 매도는 계속 실행됩니다.";
  }

  // 게이지 + 점수 구성
  const score = rp.riskScore ?? 0;
  $("riskScore").textContent = score;
  const gcol = score < 34 ? "var(--green)" : score < 67 ? "var(--amber)" : "#ff7f78";
  $("gauge").style.background = `conic-gradient(${gcol} 0 ${score}%, #1a3028 ${score}%)`;
  $("riskLevelKo").textContent = rp.riskLevel === "LOW" ? "위험도 낮음" : rp.riskLevel === "MEDIUM" ? "위험도 중간" : "위험도 높음";
  const breached = (rp.defenseLines || []).filter(x => x.state !== "SAFE").length;
  $("riskDesc").textContent = breached ? `방어선 ${breached}개 위반 — 자동 대응 작동` : "모든 계좌 방어선까지 여유가 있습니다.";
  $("compList").innerHTML = (rp.components || []).map(c => `<li><span>${c.name}</span><b>+${c.score}</b></li>`).join("");
  $("stratMode").textContent = rp.strategyMode || "—";
  attachModeTip("stratMode");
  const mp = $("mktPill");
  mp.textContent = rp.marketState || "—";
  mp.className = "pill " + (rp.marketState === "RISK_ON" ? "green" : rp.marketState === "RISK_OFF" ? "blue" : "amber");

  // 지표
  $("riskStats").innerHTML = `
    <div><small>월간 손익(근사)</small><b class="${sgnK(m.monthlyReturnRate)}">${m.monthlyReturnRate == null ? "—" : pctS(m.monthlyReturnRate)}</b><em>중단선 -6%</em></div>
    <div><small>최대 낙폭 MDD</small><b class="${sgnK(m.mddRate)}">${pctS(m.mddRate || 0)}</b><em>기록 구간 기준</em></div>
    <div><small>최대 종목 비중</small><b>${m.maxPositionWeight}%</b><em>한도 60%</em></div>
    <div><small>가용 현금</small><b>${won0(m.cashAmount || 0)}</b><em>${m.cashWeight}%</em></div>`;

  // 방어선
  $("defenseRows").innerHTML = (rp.defenseLines || []).map(l => {
    const cur = l.isPct ? pctS(l.current) : won0(l.current);
    const thr = l.isPct ? pctS(l.threshold) : won0(l.threshold);
    const margin = l.isPct ? pctS(l.margin) + " 여유" : won0(l.margin) + " 여유";
    const stateTxt = l.state === "SAFE" ? margin : "⚠️ 위반";
    return `<div class="risk-row"><span>${l.label}</span><span>${cur}</span><span>${thr}</span>
      <span class="${l.state === "SAFE" ? "up" : "down"}" style="color:${l.state === "SAFE" ? "var(--green)" : "#ff7f78"}!important">${stateTxt}</span></div>`;
  }).join("");

  // 게이트
  $("gateList").innerHTML = (rp.gates || []).map(g => {
    const cls = g.state === "PASS" ? "ok" : g.state === "UNKNOWN" ? "unk" : "stop";
    const icon = g.state === "PASS" ? "✓" : g.state === "UNKNOWN" ? "?" : "!";
    const emCls = g.state === "PASS" ? "pass" : g.state === "UNKNOWN" ? "unk" : "block";
    const label = g.state === "PASS" ? "통과" : g.state === "UNKNOWN" ? "UNKNOWN·매수차단" : "차단";
    return `<li><i class="${cls}">${icon}</i><span><b>${g.label}</b><small>${g.reason}</small></span><em class="${emCls}">${label}</em></li>`;
  }).join("");
}
guardAndLoad(render);

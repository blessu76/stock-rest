// Positions — 보유·평가손익·전략 상태 (읽기 전용)
function render(d) {
  document.getElementById("sideNav").innerHTML = sideNav("positions");
  wireLock(); metaBadge(d);
  const pp = d.positionsPage || { summary: {}, positions: [] };
  const s = pp.summary;

  $("posStats").innerHTML = `
    <div><small>총 평가금액</small><b>${won0(s.marketValue || 0)}</b><em>현금 제외</em></div>
    <div><small>평가손익</small><b class="${sgnK(s.unrealizedPnl)}">${wonS(s.unrealizedPnl || 0)}</b><em class="${sgnK(s.unrealizedPnlRate)}">${pctS(s.unrealizedPnlRate || 0)}</em></div>
    <div><small>현금 비중</small><b>${s.cashWeight}%</b><em>최소 ${s.minCashWeight}% 이상</em></div>
    <div><small>최대 집중도</small><b>${s.maxPositionWeight}%</b><em>한도 ${s.maxWeightLimit}% · 추천슬롯 ${s.maxFreeWeight || 25}%</em></div>`;

  const badge = $("reconBadge");
  badge.className = "health" + (pp.reconciled ? "" : " warn");
  badge.innerHTML = `<i></i> ${pp.reconciled ? "RECONCILED" : "RECONCILIATION_REQUIRED"}`;

  $("posCards").innerHTML = (pp.positions || []).map(p => {
    const pillTone = p.tone === "green" ? "green" : p.tone === "amber" ? "amber" : "red";
    const roleBadge = p.role === "free"
      ? `<em class="pill muted" title="프리슬롯(추천종목): 전량매도 자유(0주 가능) · 최대 비중 25% 상한">FREE</em>`
      : `<em class="pill green" title="코어: 최소 1주 항상 보유·평단 낮추기">CORE</em>`;
    return `<article class="position">
      <div class="ticker"><div><h3>${p.name} ${roleBadge}</h3><small>${p.code}</small></div><span>RS ${p.rsRank ?? "—"}</span></div>
      <div class="price"><b>${won0(p.price)}</b><em class="${sgnK(p.pnlRate)}">${pctS(p.pnlRate)}</em></div>
      <dl>
        <div><dt>보유수량</dt><dd>${p.qty}주</dd></div>
        <div><dt>평균단가</dt><dd>${won0(p.avg)}</dd></div>
        <div><dt>평가금액</dt><dd>${won0(p.marketValue)}</dd></div>
        <div><dt>평가손익</dt><dd class="${sgnK(p.pnl)}">${wonS(p.pnl)}</dd></div>
        <div><dt>비중</dt><dd>${p.weight}%</dd></div>
      </dl>
      <div class="level">
        <span>60일선 <b>${p.aboveMa60 == null ? "—" : p.aboveMa60 ? "위" : "아래"}</b></span>
        <span>60일선까지 <b class="${sgnK(p.distToMa60)}">${p.distToMa60 == null ? "—" : pctS(p.distToMa60)}</b></span>
      </div>
      ${p.grid ? `<div class="level" title="코어 그리드(1주 오실레이션): 기준가 위·아래 ±폭에서 1주씩 매도/재매수">
        <span>그리드 기준가 <b>${won0(p.grid.anchor)}</b></span>
        <span>▲매도 <b class="pos">${won0(p.grid.sellTrigger)}</b> · ▼매수 <b class="neg">${won0(p.grid.buyTrigger)}</b></span>
        <span>누적재매수 <b>${p.grid.extra}/${p.grid.maxExtra}</b></span>
      </div>` : ""}
      <footer><span class="pill ${pillTone}">${p.decision}</span><span class="mono" style="color:#75968a;font-size:9px">${p.code}</span></footer>
    </article>`;
  }).join("") || `<p class="empty-note">보유 종목이 없습니다.</p>`;
}
guardAndLoad(render);

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
    <div><small>최대 집중도</small><b>${s.maxPositionWeight}%</b><em>한도 ${s.maxWeightLimit}%</em></div>`;

  const badge = $("reconBadge");
  badge.className = "health" + (pp.reconciled ? "" : " warn");
  badge.innerHTML = `<i></i> ${pp.reconciled ? "RECONCILED" : "RECONCILIATION_REQUIRED"}`;

  $("posCards").innerHTML = (pp.positions || []).map(p => {
    const pillTone = p.tone === "green" ? "green" : p.tone === "amber" ? "amber" : "red";
    return `<article class="position">
      <div class="ticker"><div><h3>${p.name}</h3><small>${p.code}</small></div><span>RS ${p.rsRank ?? "—"}</span></div>
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
      <footer><span class="pill ${pillTone}">${p.decision}</span><span class="mono" style="color:#75968a;font-size:9px">${p.code}</span></footer>
    </article>`;
  }).join("") || `<p class="empty-note">보유 종목이 없습니다.</p>`;
}
guardAndLoad(render);

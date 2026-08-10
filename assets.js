// Assets — 총자산 일별 원장. 종가로 재구성(PAPER·수량 불변). 읽기 전용.
function render(d) {
  document.getElementById("sideNav").innerHTML = sideNav("assets");
  wireLock(); metaBadge(d);

  const led = d.assetLedger || { codes: [], rows: [], target: 0 };
  const codes = led.codes || [];
  const rows = led.rows || [];
  const target = led.target || 0;

  // 데이터 부족 처리 — 요약·표 모두 안전한 빈 상태
  if (!rows.length) {
    $("assetStats").innerHTML =
      `<div><small>오늘 총자산</small><b>—</b><em>데이터 없음</em></div>
       <div><small>어제 증감</small><b>—</b><em>—</em></div>
       <div><small>목표까지 잔여</small><b>—</b><em>—</em></div>`;
    $("assetTable").innerHTML =
      `<tbody><tr><td style="color:#7f9a91">보유 종목 종가 이력이 아직 없습니다. 거래일마다 재구성됩니다.</td></tr></tbody>`;
    return;
  }

  const today = rows[0];               // 최신이 위(desc)
  const yest = rows[1] || null;        // 직전 거래일

  // 요약카드 3장: ①오늘 총자산+오늘 증감 ②어제 증감 ③목표까지 잔여+회복률
  const tChg = today.change, tPct = today.changePct;
  const yChg = yest ? yest.change : null, yPct = yest ? yest.changePct : null;
  const shortfall = target - today.equity;
  const chgCell = (c, p) => c == null
    ? `<b>—</b><em>기준일</em>`
    : `<b class="${sgnK(c)}">${wonS(c)}</b><em class="${sgnK(p)}">${p == null ? "—" : pctS(p)}</em>`;
  $("assetStats").innerHTML =
    `<div><small>오늘 총자산</small><b>${won0(today.equity)}</b>` +
      (tChg == null ? `<em>기준일</em>` : `<em class="${sgnK(tChg)}">${wonS(tChg)} · ${tPct == null ? "—" : pctS(tPct)}</em>`) + `</div>
     <div><small>어제 증감</small>${chgCell(yChg, yPct)}</div>
     <div><small>목표까지 잔여</small><b class="${sgnK(-shortfall)}">${won0(shortfall)}</b><em>회복률 ${Number(today.recoveryPct || 0).toFixed(2)}%</em></div>`;

  // 테이블: 날짜 | 총자산 | 전일대비(₩) | 전일대비(%) | 회복률 | [종목별 N개] | 현금
  const head = `<thead><tr>
    <th>날짜</th><th>총자산</th><th>전일대비</th><th>전일대비%</th><th>회복률</th>` +
    codes.map(c => `<th>${c.name}</th>`).join("") +
    `<th>현금</th></tr></thead>`;
  const body = rows.map((r, i) => {
    const cls = i === 0 ? ' class="today-row"' : "";
    const chg = r.change == null ? "—" : `<span class="${sgnK(r.change)}">${wonS(r.change)}</span>`;
    const chgP = r.changePct == null ? "—" : `<span class="${sgnK(r.changePct)}">${pctS(r.changePct)}</span>`;
    const per = codes.map(c => `<td>${won0((r.perStock || {})[c.code] || 0)}</td>`).join("");
    return `<tr${cls}><td><b>${r.date}</b></td><td>${won0(r.equity)}</td>
      <td>${chg}</td><td>${chgP}</td><td>${Number(r.recoveryPct || 0).toFixed(2)}%</td>
      ${per}<td>${won0(r.cash)}</td></tr>`;
  }).join("");
  $("assetTable").innerHTML = head + `<tbody>${body}</tbody>`;
}
guardAndLoad(render);

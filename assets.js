// Assets — 총자산 일별 원장. 종가로 재구성(PAPER·수량 불변). 읽기 전용.
function render(d) {
  try { renderAssets(d); }
  catch (e) {
    console.error("assets render error:", e);
    const s = document.getElementById("assetStats");
    if (s) s.innerHTML = `<div><small>표시 오류</small><b>—</b><em>새로고침(Cmd+Shift+R) 후에도 계속되면 알려주세요</em></div>`;
  }
}
function renderAssets(d) {
  const sn = document.getElementById("sideNav");
  if (sn) sn.innerHTML = sideNav("assets");
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

  // 차트(주별 스택막대 + 총자산 라인) — from~to 주 선택
  renderAssetChart(rows, codes);

  // 테이블: 날짜 | 총자산 | 전일대비(₩) | 전일대비(%) | 회복률 | [종목별 N개] | 현금 — 월별 필터
  const head = `<thead><tr>
    <th>날짜</th><th>총자산</th><th>전일대비</th><th>전일대비%</th><th>회복률</th>` +
    codes.map(c => `<th>${c.name}</th>`).join("") +
    `<th>현금</th></tr></thead>`;
  const todayDate = today.date;
  const months = [...new Set(rows.map(r => r.date.slice(0, 7)))];   // 이미 최신순(desc)
  let selMonth = months[0];

  function renderTable() {
    const mrows = rows.filter(r => r.date.slice(0, 7) === selMonth);
    const body = mrows.map(r => {
      const cls = r.date === todayDate ? ' class="today-row"' : "";
      const chg = r.change == null ? "—" : `<span class="${sgnK(r.change)}">${wonS(r.change)}</span>`;
      const chgP = r.changePct == null ? "—" : `<span class="${sgnK(r.changePct)}">${pctS(r.changePct)}</span>`;
      const per = codes.map(c => `<td>${won0((r.perStock || {})[c.code] || 0)}</td>`).join("");
      return `<tr${cls}><td><b>${r.date}</b></td><td>${won0(r.equity)}</td>
        <td>${chg}</td><td>${chgP}</td><td>${Number(r.recoveryPct || 0).toFixed(2)}%</td>
        ${per}<td>${won0(r.cash)}</td></tr>`;
    }).join("");
    $("assetTable").innerHTML = head + `<tbody>${body || `<tr><td colspan="${6 + codes.length}" style="color:#7f9a91">해당 월 데이터 없음</td></tr>`}</tbody>`;
  }

  const sel = $("monthSelect");
  if (sel) {
    sel.innerHTML = months.map(m => `<option value="${m}"${m === selMonth ? " selected" : ""}>${m.replace("-", ".")}</option>`).join("");
    sel.onchange = () => { selMonth = sel.value; renderTable(); };
  }
  renderTable();
}
// ISO 주 계산 → {key:"YYYY-Www", num: 년*100+주} (input type=week 값과 동일 포맷)
function isoWeek(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const t = new Date(d);
  t.setDate(t.getDate() - ((d.getDay() + 6) % 7) + 3);   // 그 주의 목요일
  const y = t.getFullYear();
  const ft = new Date(y, 0, 4);
  ft.setDate(ft.getDate() - ((ft.getDay() + 6) % 7) + 3);
  const week = 1 + Math.round((t - ft) / (7 * 24 * 3600 * 1000));
  return { key: y + "-W" + String(week).padStart(2, "0"), num: y * 100 + week };
}
function weekNum(val) {   // "2026-W32" → 202632
  const m = /^(\d{4})-W(\d{2})$/.exec(val || "");
  return m ? +m[1] * 100 + +m[2] : null;
}

const SEG_COLORS = ["#4ade80", "#f59e0b", "#a78bfa", "#2dd4bf", "#e879f9"];   // 종목(빨강·파랑·회색 제외)
const CASH_COLOR = "#8a94a6";                                                  // 현금=회색
const LINE_COLOR = "#eaf6f0";                                                  // 총자산 라인=흰색

function renderAssetChart(rows, codes) {
  const svg = $("assetChart");
  if (!svg) return;
  // 주별 집계: ISO주별로 그 주 마지막 거래일 행 채택(오름차순)
  const asc = rows.slice().reverse();
  const wmap = new Map();
  for (const r of asc) { const w = isoWeek(r.date); wmap.set(w.key, { ...r, wkey: w.key, wnum: w.num }); }
  const allWeeks = [...wmap.values()].sort((a, b) => a.wnum - b.wnum);
  if (!allWeeks.length) { svg.innerHTML = ""; return; }

  const fromEl = $("chartFrom"), toEl = $("chartTo");
  const minKey = allWeeks[0].wkey, maxKey = allWeeks[allWeeks.length - 1].wkey;
  if (fromEl && !fromEl.value) { fromEl.value = minKey; fromEl.min = minKey; fromEl.max = maxKey; }
  if (toEl && !toEl.value) { toEl.value = maxKey; toEl.min = minKey; toEl.max = maxKey; }

  function draw() {
    const fromN = weekNum(fromEl && fromEl.value) || allWeeks[0].wnum;
    const toN = weekNum(toEl && toEl.value) || allWeeks[allWeeks.length - 1].wnum;
    const lo = Math.min(fromN, toN), hi = Math.max(fromN, toN);
    const weeks = allWeeks.filter(w => w.wnum >= lo && w.wnum <= hi);
    if (!weeks.length) { svg.innerHTML = ""; return; }

    const W = 620, H = 240, padL = 6, padR = 6, padT = 12, padB = 20;
    const cw = W - padL - padR, ch = H - padT - padB;
    const maxEq = Math.max(...weeks.map(w => w.equity)) * 1.05 || 1;
    const n = weeks.length, slot = cw / n, bw = Math.min(slot * 0.66, 30);
    const y = v => padT + ch - (v / maxEq) * ch;

    let bars = "";
    weeks.forEach((w, i) => {
      const cx = padL + slot * i + slot / 2, x = cx - bw / 2;
      let acc = 0;
      codes.forEach((c, ci) => {
        const val = (w.perStock || {})[c.code] || 0;
        const y0 = y(acc), y1 = y(acc + val);
        bars += `<rect x="${x.toFixed(1)}" y="${y1.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0, y0 - y1).toFixed(1)}" fill="${SEG_COLORS[ci % SEG_COLORS.length]}"/>`;
        acc += val;
      });
      const y0 = y(acc), y1 = y(acc + (w.cash || 0));
      bars += `<rect x="${x.toFixed(1)}" y="${y1.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0, y0 - y1).toFixed(1)}" fill="${CASH_COLOR}"/>`;
    });
    const pts = weeks.map((w, i) => `${(padL + slot * i + slot / 2).toFixed(1)},${y(w.equity).toFixed(1)}`).join(" ");
    const dots = weeks.map((w, i) => `<circle cx="${(padL + slot * i + slot / 2).toFixed(1)}" cy="${y(w.equity).toFixed(1)}" r="1.8" fill="${LINE_COLOR}"/>`).join("");
    svg.innerHTML = bars + `<polyline points="${pts}" fill="none" stroke="${LINE_COLOR}" stroke-width="1.6" vector-effect="non-scaling-stroke"/>` + dots;
    if (typeof attachChartTip === "function")
      attachChartTip("assetChart", weeks.map((w, i) => ({
        x: padL + slot * i + slot / 2, label: (w.date || w.wkey || ""),
        rows: [
          { k: "총자산", v: "₩" + Math.round(w.equity || 0).toLocaleString("ko-KR") }
        ].concat(codes.map(c => ({
          k: c.name || c.code, v: "₩" + Math.round((w.perStock || {})[c.code] || 0).toLocaleString("ko-KR")
        }))).concat([{ k: "현금", v: "₩" + Math.round(w.cash || 0).toLocaleString("ko-KR") }])
      })), { W: 620, H: 240 });
  }

  if (fromEl) fromEl.onchange = draw;
  if (toEl) toEl.onchange = draw;
  const leg = $("assetChartLegend");
  if (leg) leg.innerHTML =
    codes.map((c, ci) => `<span><i style="background:${SEG_COLORS[ci % SEG_COLORS.length]}"></i>${c.name}</span>`).join("") +
    `<span><i style="background:${CASH_COLOR}"></i>현금(예수금)</span><span><i style="background:${LINE_COLOR}"></i>총자산</span>`;
  draw();
}

guardAndLoad(render);

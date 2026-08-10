// Sectors — 업종 상대강도(RS) 트래커. 탑다운: 리딩 업종 → 구성 종목 드릴다운.
// 데이터는 일 1회 크론(sector_rs.py)이 계산·저장한 것을 export가 실어온 것(읽기 전용).
function render(d) {
  try { renderSectors(d); }
  catch (e) {
    console.error("sectors render error:", e);
    const s = document.getElementById("sectorStats");
    if (s) s.innerHTML = `<div><small>표시 오류</small><b>—</b><em>새로고침 후에도 계속되면 알려주세요</em></div>`;
  }
}

const rsFmt = v => v == null ? "—" : (v > 0 ? "+" : "") + Number(v).toFixed(2) + "%";
const relFmt = v => v == null ? "—" : (v > 0 ? "+" : "") + Number(v).toFixed(2) + "%p";

let SEC = null;          // 섹터 랭킹 배열
let CONST = {};          // {sector: [구성종목]}
let SORT_KEY = "rs60";
let SELECTED = null;     // 드릴다운 선택 업종

function renderSectors(d) {
  const sn = document.getElementById("sideNav");
  if (sn) sn.innerHTML = sideNav("sectors");
  wireLock(); metaBadge(d);

  const s = (d && d.sectorRs) || { date: null, sectors: [], constituents: {}, indexOk: false };
  SEC = (s.sectors || []).slice();
  CONST = s.constituents || {};

  // 첫 크론 전 안전한 빈 상태
  if (!SEC.length) {
    $("sectorStats").innerHTML =
      `<div><small>리딩 업종</small><b>—</b><em>데이터 없음</em></div>
       <div><small>집계 업종</small><b>0</b><em>—</em></div>
       <div><small>기준일</small><b>—</b><em>장마감 후 자동 집계</em></div>`;
    $("sectorTable").innerHTML =
      `<tbody><tr><td style="color:#7f9a91">업종 RS는 매 거래일 장마감 후(16:10) 자동 계산됩니다. 첫 집계 전에는 표시할 데이터가 없습니다.</td></tr></tbody>`;
    $("sectorBars").innerHTML = "";
    $("constTable").innerHTML = `<tbody><tr><td style="color:#7f9a91">—</td></tr></tbody>`;
    return;
  }

  // 요약카드: ①리딩 업종(60일) ②집계 업종 수 ③기준일/지수대비 여부
  const leader = [...SEC].sort((a, b) => (b.rs60 ?? -1e9) - (a.rs60 ?? -1e9))[0];
  $("sectorStats").innerHTML =
    `<div><small>리딩 업종 (60일 RS)</small><b class="${leader.rs60 > 0 ? "up" : leader.rs60 < 0 ? "down" : ""}">${leader.sector}</b><em class="${leader.rs60 > 0 ? "up" : "down"}">${rsFmt(leader.rs60)}</em></div>
     <div><small>집계 업종</small><b>${SEC.length}개</b><em>${s.indexOk ? "KOSPI 지수 대비 포함" : "절대 RS 기준"}</em></div>
     <div><small>기준일</small><b>${s.date || "—"}</b><em>장마감 후 자동 집계</em></div>`;

  bindSortTabs();
  renderTable();
  renderBars();
  // 기본 드릴다운 = 리딩 업종
  selectSector(leader.sector);
}

function bindSortTabs() {
  document.querySelectorAll("#sortTabs button").forEach(btn => btn.onclick = () => {
    document.querySelectorAll("#sortTabs button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    SORT_KEY = btn.dataset.k;
    const lb = SORT_KEY.replace("rs", "");
    $("barCaption").textContent = `${lb}일 상대강도 · 클릭하면 구성 종목`;
    renderTable();
    renderBars();
  });
}

function sortedSectors() {
  return [...SEC].sort((a, b) => {
    const av = a[SORT_KEY], bv = b[SORT_KEY];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return bv - av;
  });
}

// ① 랭킹 표 — 정렬키 기준 리딩 상단. 20/60/120 + 지수대비 rel60.
function renderTable() {
  const rows = sortedSectors();
  const head = `<thead><tr>
    <th>#</th><th>업종</th><th>프록시</th>
    <th>RS 20일</th><th>RS 60일</th><th>RS 120일</th><th>지수대비(60)</th></tr></thead>`;
  const body = rows.map((r, i) => {
    const sel = r.sector === SELECTED ? ' class="sel-row"' : "";
    const cell = v => `<td class="${v > 0 ? "up" : v < 0 ? "down" : ""}">${rsFmt(v)}</td>`;
    const rel = `<td class="${r.rel60 > 0 ? "up" : r.rel60 < 0 ? "down" : ""}">${relFmt(r.rel60)}</td>`;
    const tag = r.proxyKind === "basket" ? '<span class="pk">바스켓</span>' : '<span class="pk etf">ETF</span>';
    return `<tr${sel} data-sec="${r.sector}" style="cursor:pointer">
      <td><b>${i + 1}</b></td><td><b>${r.sector}</b></td><td class="proxy">${tag}<small>${r.proxy}</small></td>
      ${cell(r.rs20)}${cell(r.rs60)}${cell(r.rs120)}${rel}</tr>`;
  }).join("");
  $("sectorTable").innerHTML = head + `<tbody>${body}</tbody>`;
  $("sectorTable").querySelectorAll("tr[data-sec]").forEach(tr =>
    tr.onclick = () => selectSector(tr.dataset.sec));
}

// ② RS 막대 (반응형 SVG, 가로스크롤 없음) — 상승=빨강, 하락=파랑
function renderBars() {
  const svg = $("sectorBars");
  if (!svg) return;
  const rows = sortedSectors();
  const n = rows.length;
  const W = 620, rowH = 26, padL = 92, padR = 44, padT = 8;
  const H = padT * 2 + n * rowH;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.style.height = H + "px";
  const vals = rows.map(r => r[SORT_KEY]).filter(v => v != null);
  const maxAbs = Math.max(0.001, ...vals.map(v => Math.abs(v)));
  const zeroX = padL + (W - padL - padR) * 0.5;   // 중앙=0 (양/음 양방향)
  const half = (W - padL - padR) * 0.5;
  let out = `<line x1="${zeroX}" y1="${padT}" x2="${zeroX}" y2="${H - padT}" stroke="#1d312c" stroke-width="1"/>`;
  rows.forEach((r, i) => {
    const y = padT + i * rowH + 4;
    const v = r[SORT_KEY];
    const sel = r.sector === SELECTED;
    out += `<text x="${padL - 8}" y="${y + 13}" text-anchor="end" font-size="11" fill="${sel ? "#eef7f3" : "#a9bcb5"}" font-weight="${sel ? 700 : 400}">${r.sector}</text>`;
    if (v == null) {
      out += `<text x="${zeroX + 6}" y="${y + 13}" font-size="10" fill="#7f9a91">데이터 부족</text>`;
      return;
    }
    const w = (Math.abs(v) / maxAbs) * half;
    const up = v >= 0;
    const x = up ? zeroX : zeroX - w;
    const col = up ? "#f45b5b" : "#4c8dff";
    out += `<rect x="${x.toFixed(1)}" y="${y}" width="${Math.max(1, w).toFixed(1)}" height="${rowH - 9}" rx="3" fill="${col}" opacity="${sel ? 1 : 0.72}" data-sec="${r.sector}" style="cursor:pointer"/>`;
    const lx = up ? x + w + 5 : x - 5;
    out += `<text x="${lx.toFixed(1)}" y="${y + 13}" text-anchor="${up ? "start" : "end"}" font-size="10" fill="${col}" font-weight="600">${rsFmt(v)}</text>`;
  });
  svg.innerHTML = out;
  svg.querySelectorAll("rect[data-sec]").forEach(rect =>
    rect.onclick = () => selectSector(rect.dataset.sec));
}

// ③ 구성 종목 드릴다운 — 현재가·RS20/60·MA60 상하·매수가능여부(추세 관점)
function selectSector(sector) {
  SELECTED = sector;
  $("drillTitle").textContent = `${sector} · 구성 종목`;
  const list = CONST[sector] || [];
  $("drillSub").textContent = list.length
    ? "대표 대형주의 개별 추세·상대강도 — RS 높고 MA60 위(상승추세)일수록 매수 근거 강함"
    : "이 업종의 구성 종목 데이터가 아직 없습니다.";
  if (!list.length) {
    $("constTable").innerHTML = `<tbody><tr><td style="color:#7f9a91">—</td></tr></tbody>`;
    renderTable(); renderBars();
    return;
  }
  const head = `<thead><tr>
    <th>종목</th><th>코드</th><th>현재가</th><th>RS 20일</th><th>RS 60일</th><th>MA60</th><th>이격</th><th>추세 판단</th></tr></thead>`;
  const body = list.map(c => {
    const cell = v => `<td class="${v > 0 ? "up" : v < 0 ? "down" : ""}">${rsFmt(v)}</td>`;
    const ma = c.aboveMa60 == null ? `<span class="pill">—</span>`
      : c.aboveMa60 ? `<span class="pill up-pill">MA60 위</span>` : `<span class="pill down-pill">MA60 아래</span>`;
    const dist = c.distToMa60 == null ? "—" : `<span class="${c.distToMa60 > 0 ? "up" : "down"}">${c.distToMa60 > 0 ? "+" : ""}${Number(c.distToMa60).toFixed(2)}%</span>`;
    // 추세 판단: MA60 위 + RS60 양수 = 순풍 / MA60 위 = 관찰 / 아래 = 약세
    let verdict, vcls;
    if (c.aboveMa60 == null) { verdict = "데이터 부족"; vcls = ""; }
    else if (c.aboveMa60 && (c.rs60 ?? -1) > 0) { verdict = "순풍 · 매수 근거 유효"; vcls = "up"; }
    else if (c.aboveMa60) { verdict = "추세 위 · 관찰"; vcls = ""; }
    else { verdict = "추세 아래 · 신중"; vcls = "down"; }
    const price = c.price == null ? "—" : "₩" + Number(c.price).toLocaleString("ko-KR");
    return `<tr><td><b>${c.name}</b></td><td class="proxy"><small>${c.code}</small></td>
      <td>${price}</td>${cell(c.rs20)}${cell(c.rs60)}<td>${ma}</td><td>${dist}</td>
      <td class="${vcls}">${verdict}</td></tr>`;
  }).join("");
  $("constTable").innerHTML = head + `<tbody>${body}</tbody>`;
  renderTable();   // 선택 하이라이트 반영
  renderBars();
}

guardAndLoad(render);

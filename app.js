// recovery.console 대시보드 — 로그인(davy.kim + 패스프레이즈) → 암호화 data.json 복호화 → 스키마 v1.0 렌더
const USERNAME = "davy.kim";
const $ = id => document.getElementById(id);
const won = n => (n == null ? "—" : (n < 0 ? "-₩" : "₩") + Math.abs(Math.round(n)).toLocaleString("ko-KR"));
const pct = n => (n == null ? "—" : (n > 0 ? "+" : "") + Number(n).toFixed(2) + "%");
const sign = n => (n > 0 ? "positive" : n < 0 ? "negative" : "");
let ENVELOPE = null;

// ---- 복호화 (export의 PBKDF2-SHA256 + AES-GCM 호환) ----
async function decryptEnvelope(env, passphrase) {
  const dec = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const baseKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: dec(env.salt), iterations: env.iter, hash: "SHA-256" },
    baseKey, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: dec(env.iv) }, key, dec(env.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}

function loginError(m) { const n = $("loginErr"); n.textContent = m; n.classList.add("err"); }

async function tryLogin() {
  const uid = $("uid").value.trim();
  const pw = $("pw").value;
  if (uid !== USERNAME) return loginError("아이디가 올바르지 않습니다.");
  if (!ENVELOPE || !ENVELOPE.encrypted) return loginError("데이터를 불러올 수 없습니다.");
  try {
    const data = await decryptEnvelope(ENVELOPE, pw);
    sessionStorage.setItem("auth", JSON.stringify({ u: uid, p: pw }));
    enterApp(data);
  } catch (e) { loginError("비밀번호가 올바르지 않습니다."); }
}

function enterApp(data) { $("login").hidden = true; $("app").hidden = false; try { render(data); } catch (e) { console.warn("render 오류"); } }

// ---- 렌더 ----
const WD = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const MO = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function greet(h) {
  const t = h < 5 ? "늦은 밤이네요" : h < 8 ? "이른 아침입니다" : h < 12 ? "좋은 아침입니다"
    : h < 14 ? "점심 잘 챙기세요" : h < 18 ? "좋은 오후입니다" : h < 22 ? "좋은 저녁입니다" : "편안한 밤 되세요";
  return `${t}, Davy.`;
}

function renderHoldingsLive(d) {
  const held = (d.positions || []).filter(p => p.qty > 0);
  const upd = document.getElementById("holdLiveUpd");
  if (upd) {
    const g = d.generatedAt || "";   // "2026-08-13T08:50:03+09:00" → 날짜+시:분
    const stamp = g.length >= 16 ? `${g.slice(0, 10)} ${g.slice(11, 16)}` : (d.marketDate || "");
    upd.textContent = "업데이트 " + stamp;
  }
  const box = document.getElementById("holdLiveRows");
  if (!box) return;
  box.innerHTML = held.length ? held.map(p =>
    `<div class="hold-live">
      <div class="hl-name"><b>${p.name}</b><small>${p.code} · ${p.qty}주</small></div>
      <div class="hl-price">₩${(p.price || 0).toLocaleString("ko-KR")}</div>
      <div class="hl-chg"><b class="${sign(p.dailyChgRate)}">${pct(p.dailyChgRate)}</b><small class="${sign(p.dailyChg)}">${won(p.dailyChg)}</small></div>
    </div>`).join("") : `<p style="color:#7f9a91;font-size:12px;padding:4px 2px">보유 종목이 없습니다.</p>`;
}

function daySummary(d) {
  const a = d.account, s = d.strategy;
  const mkt = { RISK_ON: "매수 가능 국면", RISK_OFF: "관망 국면", UNKNOWN: "데이터 확인 중" }[s.marketState] || s.marketState;
  const parts = [`시장 ${mkt}`];
  if (a.dailyPnl) parts.push(`오늘 ${a.dailyReturnPct > 0 ? "+" : ""}${a.dailyReturnPct}%`);
  // 당일 체결만 집계 (todayFills=export 정확집계, 없으면 marketDate 매칭 폴백)
  const todayFilled = (typeof d.todayFills === "number")
    ? d.todayFills
    : (d.orders || []).filter(o => o.state === "FILLED" && (!o.date || o.date === d.marketDate)).length;
  if (todayFilled) parts.push(`오늘 ${todayFilled}건 체결`);
  else if ((d.pendingTrims || []).length) parts.push(`${d.pendingTrims.length}종목 반등 매도 대기`);
  else parts.push("신규 주문 없음");
  if (d.system.killSwitch === "ON") parts.push("⚠️ 킬스위치 ON");
  if (d.dataState === "STALE") parts.push("데이터 지연");
  // 장중 코어 그리드 왕복 실현손익(재원) — 있으면 요약에 병기
  const ig = d.intradayGrid;
  if (ig && ig.enabled && ig.harvestedTotal) {
    parts.push(`그리드 실현 ${ig.harvestedTotal > 0 ? "+" : ""}${ig.harvestedTotal.toLocaleString("ko-KR")}원`);
  }
  return parts.join("  ·  ");
}

// 전략 모드 설명 툴팁 (index.html은 common.js 미로드 → 여기 자체정의)
const MODE_TIP = `<b>전략 모드 — 총자산 수준별 자동 전환</b>` +
  `<span class="mt-row"><i class="mt-dot g"></i><b>AGGRESSIVE</b> 정상 매수(100%)</span>` +
  `<span class="mt-row"><i class="mt-dot y"></i><b>REDUCED_RISK</b> 자산 368만↓ · 매수 50% 축소</span>` +
  `<span class="mt-row"><i class="mt-dot o"></i><b>BUY_PAUSED</b> 자산 350만↓ 또는 월 −6% · 신규매수·물타기 중단</span>` +
  `<span class="mt-row"><i class="mt-dot r"></i><b>CHALLENGE_STOPPED</b> 자산 341.5만↓ · 도전종료·자본보존</span>` +
  `<span class="mt-row"><i class="mt-dot b"></i><b>RECOVERED</b> 원금 682만 회복 · 매수중단(수익보존)</span>` +
  `<span class="mt-note">※ 손절·추적매도는 모든 모드에서 작동. 실제 매수는 시장 RISK_ON일 때만. 물타기는 AGGRESSIVE·REDUCED에서만.</span>`;
function attachModeTip(afterElId) {
  const el = document.getElementById(afterElId);
  if (!el || (el.parentElement && el.parentElement.querySelector(".mode-tip"))) return;
  const tip = document.createElement("span");
  tip.className = "mode-tip"; tip.tabIndex = 0; tip.setAttribute("role", "button");
  tip.setAttribute("aria-label", "전략 모드 설명 보기");
  tip.innerHTML = `ⓘ<span class="mode-pop">${MODE_TIP}</span>`;
  el.insertAdjacentElement("afterend", tip);
}

function render(d) {
  const a = d.account, s = d.strategy, sys = d.system;
  DISP = d.displayOrder || [];   // 종목 표시 순서(JS 정수키 재정렬 보정)

  // 상태/신선도
  let state = d.dataState || "FRESH";
  const ageH = (Date.now() - Date.parse(d.generatedAt)) / 3.6e6;
  if (state === "FRESH" && ageH > 20) state = "STALE";
  const badge = $("dataBadge");
  badge.className = "market" + (state === "STALE" ? " stale" : state === "ERROR" ? " error" : "");
  badge.innerHTML = `<i></i> ${state === "FRESH" ? "DATA FRESH" : state}`;
  // (i) 박스 = 그날의 요약 (항상 표시), 상태 경고는 색/문구로 병기
  const banner = $("stateBanner");
  banner.className = "sample-banner " + (state === "ERROR" ? "err" : state === "FRESH" ? "" : "warn");
  let sum = daySummary(d);
  if (state === "STALE") sum += "  ·  데이터 지연(최신 아닐 수 있음)";
  else if (state === "PARTIAL") sum += "  ·  일부 데이터 누락";
  else if (state === "ERROR") sum = "데이터 오류 — 읽기 실패";
  $("summaryText").innerHTML = `<b>오늘의 요약</b> ${sum}`;

  // 모드 배지
  const mb = $("modeBadge"); const mode = (d.mode || "OFF");
  mb.textContent = mode; mb.className = "badge-mode " + mode.toLowerCase();

  // 상단 — 날짜/인사말은 '실제 현재 시각'(KST) 기준, 데이터 거래일(marketDate)과 별개
  const now = new Date();
  $("dateLine").textContent = `${WD[now.getDay()]} · ${String(now.getDate()).padStart(2, "0")} ${MO[now.getMonth()]} ${now.getFullYear()}`;
  $("greeting").textContent = greet(now.getHours());

  // 총자산 카드
  $("equity").textContent = won(a.equity);
  if ($("cashNote")) $("cashNote").innerHTML =
    `예수금 <b>${won(a.cash)}</b> <small>· 예수금 포함 합계 ${won((a.equity || 0) + (a.cash || 0))}</small>`;
  const dp = $("dailyPnl"); dp.textContent = (a.dailyPnl > 0 ? "+" : "") + won(a.dailyPnl); dp.className = sign(a.dailyPnl);
  $("dailyRate").textContent = pct(a.dailyReturnPct) + " 오늘";
  $("recoveryPct").textContent = a.recoveryPct + "%";
  $("progressFill").style.width = Math.min(100, a.recoveryPct) + "%";
  $("principal").textContent = won(a.principal);
  $("shortfall").textContent = won(a.shortfall);

  // 도전 카드
  $("daysLeft").textContent = s.daysRemaining;
  $("needReturn").textContent = pct(a.needReturnPct);
  const monthly = a.needReturnPct != null ? (Math.pow(1 + a.needReturnPct / 100, 1 / 3) - 1) * 100 : null;
  $("monthlyNeed").textContent = monthly != null ? `월평균 ${monthly > 0 ? "+" : ""}${monthly.toFixed(1)}% 필요` : "";
  $("ckptAmt").textContent = won(s.nextCheckpointAmount);
  $("ckptDate").textContent = (s.nextCheckpointDate || "").replace(/-/g, ". ");
  $("ring").style.background = `conic-gradient(var(--green) 0 ${Math.min(100, a.recoveryPct)}%,#193028 ${Math.min(100, a.recoveryPct)}%)`;

  // 위험 카드
  $("riskState").textContent = s.riskState;
  attachModeTip("riskState");
  $("marketStateLine").textContent = "시장 " + s.marketState;
  const riskLevel = { AGGRESSIVE: 1, RECOVERED: 1, REDUCED_RISK: 2, UNKNOWN: 3, BUY_PAUSED: 3, CHALLENGE_STOPPED: 5 }[s.riskState] || 3;
  [...$("riskBars").children].forEach((el, i) => el.className = i < riskLevel ? "on" : "");
  const rd = $("riskDaily");
  rd.textContent = `${pct(a.dailyReturnPct)} (${a.dailyPnl > 0 ? "+" : ""}${won(a.dailyPnl)})`;
  rd.className = sign(a.dailyReturnPct);
  $("riskShort").textContent = won(a.shortfall);
  $("riskCash").textContent = a.equity ? (a.cash / a.equity * 100).toFixed(1) + "%" : "—";
  $("riskBadge").textContent = s.marketState === "RISK_ON" ? "RISK ON" : s.marketState === "RISK_OFF" ? "RISK OFF" : "UNKNOWN";

  // 차트
  $("chartEquity").textContent = won(a.equity);
  $("chartRate").textContent = a.recoveryPct + "%";
  renderChart(d.assetHistory || [], a.equity, a.principal);

  // 활동 타임라인
  $("ordersDate").textContent = d.marketDate + " 실행 결과";
  $("ordersMode").textContent = mode + " · " + (sys.cycleState || "");
  $("cycleMsg").textContent = sys.cycleState === "OK" ? "사이클 정상 종료" : sys.cycleState === "FAIL_CLOSED" ? "FAIL_CLOSED (신규매수 차단)" : "대기";
  $("lastCycle").textContent = "마지막 사이클 " + (sys.lastCycleAt || "—");
  const orders = d.orders || [];
  $("timeline").innerHTML = orders.length ? orders.slice(0, 6).map(o => {
    const cls = o.state === "FILLED" ? (o.side === "SELL" ? "sell" : "buy") : "muted";
    const sideKo = o.side === "SELL" ? "매도" : "매수";
    const amt = o.amount ? " · ₩" + o.amount.toLocaleString("ko-KR") : "";
    const req = o.requestTime || "—", fil = o.fillTime || "—";
    const times = (req !== fil) ? `요청 ${req} · 체결 ${fil}` : `체결 ${fil}`;
    const rsn = o.reason ? `<small class="ord-reason">${o.reason}</small>` : "";
    return `<div><span class="time">${sideKo}</span><i class="${cls}"></i><p><b>${o.name || o.code} ${o.qty}주${amt}</b><small>${times} · ${o.state}</small>${rsn}</p></div>`;
  }).join("") : `<div><span class="time">—</span><i class="muted"></i><p><b>주문 없음</b><small>기존 포지션 유지</small></p></div>`;

  // 종목
  $("posUpdated").textContent = "업데이트 " + d.marketDate;
  $("posBody").innerHTML = (d.positions || []).map(p => `
    <tr><td><b>${p.name}</b><small>${p.code}</small></td><td>${p.qty}</td>
      <td>₩${p.avg.toLocaleString("ko-KR")}</td><td>₩${p.price.toLocaleString("ko-KR")}</td>
      <td class="${sign(p.pnl)}">${(p.pnl > 0 ? "+" : "") + won(p.pnl)}</td>
      <td class="${sign(p.pnlRate)}">${pct(p.pnlRate)}</td></tr>`).join("");

  // 보유 종목 실시간 등락(전일 대비)
  renderHoldingsLive(d);

  // 장중 현황
  renderIntradaySection(d.intraday || { stocks: {} });

  // 다음 거래일 계획
  renderPlan(d.plan || {}, d.marketDate);

  // 킬스위치
  $("killLabel").textContent = sys.killSwitch === "ON" ? "KILL SWITCH ON" : "Trading engine · " + mode;
}

// ---- 장중 현황 ----
let INTRA = null, INTRA_SEL = null, DISP = [];
const ordIdx = (k) => { const i = DISP.indexOf(k); return i < 0 ? 999 : i; };   // 표시순서 인덱스
function renderIntradaySection(intr) {
  INTRA = intr || { stocks: {} };
  // JS는 "105560" 같은 정수형 키를 앞으로 재정렬 → displayOrder로 강제 정렬
  const codes = Object.keys(INTRA.stocks || {}).sort((a, b) => ordIdx(a) - ordIdx(b));
  const tabs = $("intradayTabs"), svg = $("intradaySvg");
  if (!codes.length) {
    tabs.innerHTML = ""; svg.innerHTML = ""; $("intradayAxis").innerHTML = "";
    $("intradayNow").textContent = "—";
    $("intradayVs").textContent = "장중 데이터 수집 전 (장 시작 후 10분마다 기록)";
    $("intradayVs").className = ""; $("intradayDrill").hidden = true; return;
  }
  INTRA_SEL = (INTRA_SEL && codes.includes(INTRA_SEL)) ? INTRA_SEL : codes[0];
  tabs.innerHTML = codes.map(c => `<button data-c="${c}" class="${c === INTRA_SEL ? "active" : ""}">${INTRA.stocks[c].name}</button>`).join("");
  tabs.querySelectorAll("button").forEach(b => b.onclick = () => {
    INTRA_SEL = b.dataset.c;
    tabs.querySelectorAll("button").forEach(x => x.classList.toggle("active", x.dataset.c === INTRA_SEL));
    $("intradayDrill").hidden = true; drawIntraday();
  });
  svg.onclick = toggleIntradayDrill;
  drawIntraday();
}
function drawIntraday() {
  const st = INTRA.stocks[INTRA_SEL], pts = st.points || [], avg = st.avg || 0;
  $("intradayTabs").querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.c === INTRA_SEL));
  const svg = $("intradaySvg");
  if (!pts.length) { svg.innerHTML = ""; $("intradayNow").textContent = "—"; $("intradayVs").textContent = "데이터 없음"; return; }
  const W = 620, H = 200, prices = pts.map(p => p.price);
  const vmin = Math.min(...prices, avg) * 0.999, vmax = Math.max(...prices, avg) * 1.001;
  const X = i => pts.length < 2 ? W / 2 : (i / (pts.length - 1)) * W;
  const Y = v => vmax === vmin ? H / 2 : H - ((v - vmin) / (vmax - vmin)) * H;
  const line = prices.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
  const col = prices[prices.length - 1] >= prices[0] ? "#f45b5b" : "#4c8dff";
  const avgY = Y(avg).toFixed(1);
  const tlabel = (i) => `<text x="${X(i).toFixed(1)}" y="214" fill="#526a62" font-size="8" text-anchor="middle" font-family="Geist Mono">${pts[i].t}</text>`;
  const times = pts.length > 1 ? [tlabel(0), tlabel(Math.floor(pts.length / 2)), tlabel(pts.length - 1)].join("") : tlabel(0);
  svg.innerHTML =
    `<line x1="0" y1="44" x2="620" y2="44" class="grid-line"/><line x1="0" y1="99" x2="620" y2="99" class="grid-line"/><line x1="0" y1="154" x2="620" y2="154" class="grid-line"/>
     <line x1="0" y1="${avgY}" x2="620" y2="${avgY}" class="avg-line"/>
     <text x="616" y="${(avgY - 4)}" fill="#f5c969" font-size="9" text-anchor="end" font-family="Geist Mono">평단 ${avg.toLocaleString("ko-KR")}</text>
     <polyline points="${line}" class="price-line" style="stroke:${col}"/>${times}`;
  if (typeof attachChartTip === "function")
    attachChartTip("intradaySvg", pts.map((p, i) => ({
      x: X(i), label: `${INTRA.date || ""} ${p.t}`,
      rows: [
        { k: "주가", v: "₩" + p.price.toLocaleString("ko-KR") },
        { k: "평단대비", v: (p.price >= avg ? "+" : "") + ((p.price / avg - 1) * 100).toFixed(2) + "%", cls: p.price >= avg ? "positive" : "negative" }
      ]
    })), { W: 620, H: 200 });
  const axisV = [vmax, (vmax + vmin) / 2, vmin].map(v => `<span>${Math.round(v / 10000)}만</span>`);
  $("intradayAxis").innerHTML = axisV.join("");
  const last = prices[prices.length - 1], vsAvg = (last / avg - 1) * 100;
  $("intradayNow").textContent = "₩" + last.toLocaleString("ko-KR");
  const vs = $("intradayVs"); vs.textContent = `평단 대비 ${vsAvg > 0 ? "+" : ""}${vsAvg.toFixed(2)}%  ·  ${pts.length}틱`;
  vs.className = vsAvg > 0 ? "positive" : vsAvg < 0 ? "negative" : "";
}
function toggleIntradayDrill() {
  const d = $("intradayDrill");
  if (!d.hidden) { d.hidden = true; return; }
  const st = INTRA.stocks[INTRA_SEL], pts = st.points || [];
  let rows = "";
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i], prev = i > 0 ? pts[i - 1].price : p.price;
    const tick = (p.price / prev - 1) * 100, va = (p.price / st.avg - 1) * 100;
    rows += `<tr><td>${p.t}</td><td>₩${p.price.toLocaleString("ko-KR")}</td><td class="${sign(tick)}">${tick > 0 ? "+" : ""}${tick.toFixed(2)}%</td><td class="${sign(va)}">${va > 0 ? "+" : ""}${va.toFixed(2)}%</td></tr>`;
  }
  d.innerHTML = `<h4>${st.name} 장중 상세 · ${INTRA.date || ""}</h4><div class="hist-table"><table><thead><tr><th>시각</th><th>주가</th><th>전틱</th><th>평단대비</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  d.hidden = false;
}

function renderPlan(plan, marketDate) {
  $("planDate").textContent = (plan.decisionDate || marketDate || "") + " 종가 기준";
  const li = (arr, empty) => (arr && arr.length)
    ? arr.map(x => `<li><b>${x.name}</b> ${x.qty ? x.qty + "주 " : ""}<small>${x.reason || x.note || ""}</small></li>`).join("")
    : `<li class="none">${empty}</li>`;
  $("planBuys").innerHTML = li(plan.buys, "매수 예정 없음");
  $("planSells").innerHTML = li(plan.sells, "매도 예정 없음");
  $("planWait").innerHTML = li(plan.waiting, "대기 종목 없음");
}

function renderChart(hist, equity, principal) {
  const W = 620, H = 200;
  // hist = [{date, equity}] (하루 1점, 신규) 또는 [숫자] (구버전 호환)
  const dated = hist.length && typeof hist[0] === "object";
  let eqs = dated ? hist.map(h => h.equity) : hist.slice();
  const dates = dated ? hist.map(h => h.date) : [];
  let tgts = dated ? hist.map(h => h.target) : null;
  if (eqs.length < 2) { eqs = [equity, equity]; if (tgts) tgts = [tgts[0] || equity, tgts[0] || equity]; }
  const n = eqs.length;
  const start = eqs[0];
  // 목표선: 서버가 챌린지 경과일 기준으로 계산한 값(있으면) 사용 — 초반엔 완만, 90일에 원금 도달.
  //   (구버전 폴백: 보이는 구간 등비 — 부정확)
  const target = (tgts && tgts.length === n && tgts.every(t => typeof t === "number"))
    ? tgts
    : Array.from({ length: n }, (_, i) => start * Math.pow(principal / start, i / (n - 1)));
  const all = eqs.concat(target);
  const min = Math.min(...all) * 0.98, max = Math.max(...all) * 1.02;
  const X = i => n < 2 ? W / 2 : (i / (n - 1)) * W;
  const Y = v => H - ((v - min) / (max - min)) * H;
  const poly = arr => arr.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
  // 한국식: 기간 상승=빨강, 하락=파랑
  const col = eqs[n - 1] >= eqs[0] ? "#f45b5b" : "#4c8dff";
  // x축 날짜 라벨(시작·중간·끝) — MM-DD
  const dlabel = (i, anch) => dates[i]
    ? `<text x="${X(i).toFixed(1)}" y="214" fill="#526a62" font-size="8" text-anchor="${anch}" font-family="Geist Mono">${dates[i].slice(5)}</text>` : "";
  const xlabels = (dated && n > 1)
    ? dlabel(0, "start") + dlabel(Math.floor((n - 1) / 2), "middle") + dlabel(n - 1, "end") : "";
  $("chartSvg").innerHTML =
    `<defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".26"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
     <line x1="0" y1="44" x2="620" y2="44" class="grid-line"/><line x1="0" y1="99" x2="620" y2="99" class="grid-line"/><line x1="0" y1="154" x2="620" y2="154" class="grid-line"/>
     <polyline points="${poly(target)}" class="target-line"/>
     <polygon points="${poly(eqs)} 620,200 0,200" fill="url(#area)"/>
     <polyline points="${poly(eqs)}" class="asset-line" style="stroke:${col}"/>${xlabels}`;
  if (typeof attachChartTip === "function")
    attachChartTip("chartSvg", eqs.map((v, i) => ({
      x: X(i), label: dates[i] || "총자산 추이",
      rows: [
        { k: "총자산", v: "₩" + Math.round(v).toLocaleString("ko-KR") },
        { k: "목표선", v: "₩" + Math.round(target[i]).toLocaleString("ko-KR") }
      ]
    })), { W: 620, H: 200 });
  const lo = Math.round(max / 10000), hi = Math.round(min / 10000);
  $("axis").innerHTML = [lo, Math.round((lo + hi) / 2), hi].map(v => `<span>${v}만</span>`).join("");
}

// ---- init ----
async function init() {
  try { ENVELOPE = await (await fetch("data.json?t=" + Date.now())).json(); }
  catch (e) { loginError("데이터 로드 실패 (ERROR)"); return; }
  const saved = sessionStorage.getItem("auth");
  if (saved && ENVELOPE.encrypted) {
    try { const { u, p } = JSON.parse(saved); if (u === USERNAME) return enterApp(await decryptEnvelope(ENVELOPE, p)); }
    catch (e) { sessionStorage.removeItem("auth"); }
  }
  $("loginBtn").onclick = tryLogin;
  $("pw").addEventListener("keydown", e => { if (e.key === "Enter") tryLogin(); });
  $("uid").addEventListener("keydown", e => { if (e.key === "Enter") tryLogin(); });
  $("lockBtn").onclick = e => { e.preventDefault(); sessionStorage.removeItem("auth"); location.reload(); };
}
init();

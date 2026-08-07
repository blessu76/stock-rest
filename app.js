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

function render(d) {
  const a = d.account, s = d.strategy, sys = d.system;

  // 상태/신선도
  let state = d.dataState || "FRESH";
  const ageH = (Date.now() - Date.parse(d.generatedAt)) / 3.6e6;
  if (state === "FRESH" && ageH > 20) state = "STALE";
  const badge = $("dataBadge");
  badge.className = "market" + (state === "STALE" ? " stale" : state === "ERROR" ? " error" : "");
  badge.innerHTML = `<i></i> ${state === "FRESH" ? "DATA FRESH" : state}`;
  const banner = $("stateBanner");
  if (state !== "FRESH") {
    banner.hidden = false;
    banner.className = "sample-banner " + (state === "ERROR" ? "err" : "warn");
    $("stateMsg").innerHTML = state === "STALE" ? "<b>데이터 지연</b> · 마지막 생성 이후 시간이 지났습니다. 최신이 아닐 수 있어요."
      : state === "PARTIAL" ? "<b>일부 데이터 누락</b> · 계좌/포지션 일부가 비어 있습니다." : "<b>데이터 오류</b>";
  } else banner.hidden = true;

  // 모드 배지
  const mb = $("modeBadge"); const mode = (d.mode || "OFF");
  mb.textContent = mode; mb.className = "badge-mode " + mode.toLowerCase();

  // 상단
  const md = new Date(d.marketDate + "T00:00:00");
  $("dateLine").textContent = `${WD[md.getDay()]} · ${String(md.getDate()).padStart(2, "0")} ${MO[md.getMonth()]} ${md.getFullYear()}`;
  const h = new Date().getHours();
  $("greeting").textContent = `좋은 ${h < 11 ? "아침" : h < 18 ? "오후" : "저녁"}입니다, Davy.`;

  // 총자산 카드
  $("equity").textContent = won(a.equity);
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
  $("marketStateLine").textContent = "시장 " + s.marketState;
  const riskLevel = { AGGRESSIVE: 1, RECOVERED: 1, REDUCED_RISK: 2, UNKNOWN: 3, BUY_PAUSED: 3, CHALLENGE_STOPPED: 5 }[s.riskState] || 3;
  [...$("riskBars").children].forEach((el, i) => el.className = i < riskLevel ? "on" : "");
  const rd = $("riskDaily"); rd.textContent = pct(a.dailyReturnPct); rd.className = sign(a.dailyReturnPct);
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
    return `<div><span class="time">${o.side}</span><i class="${cls}"></i><p><b>${o.code} ${o.qty}주 ${o.side === "SELL" ? "매도" : "매수"}</b><small>${o.state}</small></p></div>`;
  }).join("") : `<div><span class="time">—</span><i class="muted"></i><p><b>주문 없음</b><small>기존 포지션 유지</small></p></div>`;

  // 종목
  $("posUpdated").textContent = "업데이트 " + d.marketDate;
  $("posBody").innerHTML = (d.positions || []).map(p => `
    <tr><td><b>${p.name}</b><small>${p.code}</small></td><td>${p.qty}</td>
      <td>₩${p.avg.toLocaleString("ko-KR")}</td><td>₩${p.price.toLocaleString("ko-KR")}</td>
      <td class="${sign(p.pnl)}">${(p.pnl > 0 ? "+" : "") + won(p.pnl)}</td>
      <td class="${sign(p.pnlRate)}">${pct(p.pnlRate)}</td></tr>`).join("");

  // 킬스위치
  $("killLabel").textContent = sys.killSwitch === "ON" ? "KILL SWITCH ON" : "Trading engine · " + mode;
}

function renderChart(hist, equity, principal) {
  const W = 620, H = 200;
  const live = hist.length >= 2 ? hist.slice() : [equity, equity];
  const n = Math.max(live.length, 11);
  const start = live[0];
  const target = Array.from({ length: n }, (_, i) => start * Math.pow(principal / start, i / (n - 1)));
  const liveR = Array.from({ length: n }, (_, i) => live[Math.min(i, live.length - 1)]);
  const all = liveR.concat(target);
  const min = Math.min(...all) * 0.98, max = Math.max(...all) * 1.02;
  const X = i => (i / (n - 1)) * W;
  const Y = v => H - ((v - min) / (max - min)) * H;
  const poly = arr => arr.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
  $("chartSvg").innerHTML =
    `<defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#32d69b" stop-opacity=".28"/><stop offset="1" stop-color="#32d69b" stop-opacity="0"/></linearGradient></defs>
     <line x1="0" y1="44" x2="620" y2="44" class="grid-line"/><line x1="0" y1="99" x2="620" y2="99" class="grid-line"/><line x1="0" y1="154" x2="620" y2="154" class="grid-line"/>
     <polyline points="${poly(target)}" class="target-line"/>
     <polygon points="${poly(liveR)} 620,220 0,220" fill="url(#area)"/>
     <polyline points="${poly(liveR)}" class="asset-line"/>`;
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

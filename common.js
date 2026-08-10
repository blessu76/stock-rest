// 공통 — 세션 인증·복호화·헬퍼 (positions/orders/risk 페이지 공유)
const USERNAME = "davy.kim";
const $ = id => document.getElementById(id);
const wonS = n => (n < 0 ? "-₩" : "+₩") + Math.abs(Math.round(n)).toLocaleString("ko-KR");
const won0 = n => (n < 0 ? "-₩" : "₩") + Math.abs(Math.round(n)).toLocaleString("ko-KR");
const pctS = n => (n > 0 ? "+" : "") + Number(n).toFixed(2) + "%";
const sgnK = n => (n > 0 ? "up" : n < 0 ? "down" : "");   // 한국식: up=빨강, down=파랑

async function decryptEnvelope(env, passphrase) {
  const dec = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const baseKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: dec(env.salt), iterations: env.iter, hash: "SHA-256" },
    baseKey, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: dec(env.iv) }, key, dec(env.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}

// 인증 가드: 세션 없으면 로그인(index)으로. 성공 시 render(data) 호출.
async function guardAndLoad(render) {
  const saved = sessionStorage.getItem("auth");
  if (!saved) { location.href = "index.html"; return; }
  let env;
  try { env = await (await fetch("data.json?t=" + Date.now())).json(); }
  catch (e) { location.href = "index.html"; return; }
  try {
    const { u, p } = JSON.parse(saved);
    if (u !== USERNAME) throw 0;
    const data = await decryptEnvelope(env, p);
    document.getElementById("app").hidden = false;
    render(data);
  } catch (e) { sessionStorage.removeItem("auth"); location.href = "index.html"; }
}

function wireLock() {
  const b = document.getElementById("lockBtn");
  if (b) b.onclick = e => { e.preventDefault(); sessionStorage.removeItem("auth"); location.href = "index.html"; };
}

function metaBadge(d) {
  const el = document.getElementById("metaDate");
  if (el) el.innerHTML = `<i></i> ${d.marketDate || ""} · ${d.mode || ""}`;
  const smp = document.getElementById("sampleNote");
  if (smp) smp.textContent = d.mode === "PAPER"
    ? "PAPER(모의) 데이터 · 실제 주문 없음 · 데이터 기준 " + (d.generatedAt || "")
    : "데이터 기준 " + (d.generatedAt || "");
}

function sideNav(active) {
  return `<div class="brand"><span>R</span><strong>recovery<br>.console</strong></div>
  <nav aria-label="Main menu">
    <a ${active==='overview'?'class="active"':''} href="index.html"><i>⌁</i>Overview</a>
    <a ${active==='history'?'class="active"':''} href="history.html"><i>↗</i>Daily changes</a>
    <a ${active==='pnl'?'class="active"':''} href="pnl.html"><i>Σ</i>Daily P&L</a>
    <a ${active==='positions'?'class="active"':''} href="positions.html"><i>▦</i>Positions</a>
    <a ${active==='orders'?'class="active"':''} href="orders.html"><i>⇄</i>Orders</a>
    <a ${active==='risk'?'class="active"':''} href="risk.html"><i>◇</i>Risk monitor</a>
    <a ${active==='lotto'?'class="active"':''} href="lotto.html"><i>◎</i>Lotto</a>
  </nav>
  <div class="sidebar-bottom">
    <a ${active==='settings'?'class="active"':''} href="settings.html"><i>⚙</i>Settings</a>
    <a href="#" id="lockBtn"><i>⏻</i>Log out</a>
    <div class="profile"><span>DK</span><div><b>Davy Kim</b><small>Private account</small></div></div>
  </div>`;
}

// 전략 모드 설명 툴팁 (Overview·Risk 공용, 단일 소스)
const MODE_TIP = `<b>전략 모드 — 총자산 수준별 자동 전환</b>` +
  `<span class="mt-row"><i class="mt-dot g"></i><b>AGGRESSIVE</b> 정상 매수(100%)</span>` +
  `<span class="mt-row"><i class="mt-dot y"></i><b>REDUCED_RISK</b> 자산 418만↓ · 매수 50% 축소</span>` +
  `<span class="mt-row"><i class="mt-dot o"></i><b>BUY_PAUSED</b> 자산 400만↓ 또는 월 −6% · 신규매수·물타기 중단</span>` +
  `<span class="mt-row"><i class="mt-dot r"></i><b>CHALLENGE_STOPPED</b> 자산 391.5만↓ · 도전종료·자본보존</span>` +
  `<span class="mt-row"><i class="mt-dot b"></i><b>RECOVERED</b> 원금 682만 회복 · 매수중단(수익보존)</span>` +
  `<span class="mt-note">※ 손절·추적매도는 모든 모드에서 작동. 실제 매수는 시장 RISK_ON일 때만. 물타기는 AGGRESSIVE·REDUCED에서만.</span>`;

function attachModeTip(afterElId) {
  const el = document.getElementById(afterElId);
  if (!el || (el.parentElement && el.parentElement.querySelector(".mode-tip"))) return;
  const tip = document.createElement("span");
  tip.className = "mode-tip";
  tip.tabIndex = 0;
  tip.setAttribute("role", "button");
  tip.setAttribute("aria-label", "전략 모드 설명 보기");
  tip.innerHTML = `ⓘ<span class="mode-pop">${MODE_TIP}</span>`;
  el.insertAdjacentElement("afterend", tip);
}

// 일일손익 이력 — 종목별 일일손익·누적 표시. 로그인 세션 필요.
const USERNAME = "davy.kim";
const $ = id => document.getElementById(id);
const won = n => (n < 0 ? "-₩" : "+₩") + Math.abs(Math.round(n)).toLocaleString("ko-KR");
const won0 = n => (n < 0 ? "-₩" : "₩") + Math.abs(Math.round(n)).toLocaleString("ko-KR");
const sgn = n => (n > 0 ? "positive" : n < 0 ? "negative" : "");

async function decryptEnvelope(env, passphrase) {
  const dec = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const baseKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: dec(env.salt), iterations: env.iter, hash: "SHA-256" },
    baseKey, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: dec(env.iv) }, key, dec(env.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}

function cumBar(rows) {
  // 누적 손익 미니 바차트 (시간순)
  const vals = rows.map(r => r.cum).reverse();
  if (!vals.length) return "";
  const W = 300, H = 46, max = Math.max(...vals.map(Math.abs), 1);
  const bw = Math.max(2, W / vals.length - 2);
  const mid = H / 2;
  const bars = vals.map((v, i) => {
    const h = Math.max(1, Math.abs(v) / max * (H / 2 - 2));
    const y = v >= 0 ? mid - h : mid;
    const col = v >= 0 ? "#f45b5b" : "#4c8dff";
    return `<rect x="${(i * (W / vals.length)).toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" fill="${col}" opacity=".85"/>`;
  }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><line x1="0" y1="${mid}" x2="${W}" y2="${mid}" stroke="#1d312c"/>${bars}</svg>`;
}

function render(d) {
  $("app").hidden = false;
  $("asOf").innerHTML = `<i></i> ${d.marketDate || ""}`;
  const ph = d.dailyPnlHistory || {};
  const codes = Object.keys(ph);
  if (!codes.length) {
    $("pnlGrid").innerHTML = "<p style='color:#7f9a91;font-size:12px'>기록이 아직 없습니다. 거래일마다 자동 누적됩니다.</p>";
    return;
  }
  // 상단 합계 카드: 종목별 누적 + 전체
  let grandCum = 0, grandToday = 0;
  const totals = codes.map(c => {
    const rows = ph[c].rows || [];
    const cum = rows.length ? rows[0].cum : 0;
    const today = rows.length ? rows[0].amount : 0;
    grandCum += cum; grandToday += today;
    return `<article class="pnl-total"><div class="card-head"><span>${ph[c].name}</span></div>
      <div class="pnl-cum ${sgn(cum)}">${won(cum)}</div><small>누적 · 최근 ${won(today)}</small></article>`;
  });
  totals.unshift(`<article class="pnl-total grand"><div class="card-head"><span>전체 누적</span></div>
    <div class="pnl-cum ${sgn(grandCum)}">${won(grandCum)}</div><small>최근 거래일 합계 ${won(grandToday)}</small></article>`);
  $("pnlTotals").innerHTML = totals.join("");

  // 종목별 카드: 누적 바차트 + 일자별 테이블
  $("pnlGrid").innerHTML = codes.map(c => {
    const rows = ph[c].rows || [];
    const body = rows.map(r =>
      `<tr><td>${r.date}</td><td class="${sgn(r.amount)}">${won(r.amount)}</td>
       <td class="${sgn(r.rate)}">${r.rate > 0 ? "+" : ""}${r.rate.toFixed(2)}%</td>
       <td class="${sgn(r.cum)}">${won(r.cum)}</td></tr>`).join("");
    return `<div class="hist-card">
      <div class="section-title"><div><h3>${ph[c].name}</h3><span class="hcode">${c}</span></div></div>
      <div class="hist-spark">${cumBar(rows)}</div>
      <div class="hist-table"><table><thead><tr><th>날짜</th><th>일일손익</th><th>등락</th><th>누적</th></tr></thead><tbody>${body}</tbody></table></div>
    </div>`;
  }).join("");
  $("lockBtn").onclick = e => { e.preventDefault(); sessionStorage.removeItem("auth"); location.href = "index.html"; };
}

async function init() {
  const saved = sessionStorage.getItem("auth");
  if (!saved) { location.href = "index.html"; return; }
  let env;
  try { env = await (await fetch("data.json?t=" + Date.now())).json(); }
  catch (e) { location.href = "index.html"; return; }
  try {
    const { u, p } = JSON.parse(saved);
    if (u !== USERNAME) throw 0;
    render(await decryptEnvelope(env, p));
  } catch (e) { sessionStorage.removeItem("auth"); location.href = "index.html"; }
}
init();

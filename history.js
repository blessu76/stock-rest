// 일자별 등락 페이지 — 로그인 세션(sessionStorage) 필요. 없으면 로그인으로.
const USERNAME = "davy.kim";
const $ = id => document.getElementById(id);
const pct = n => (n > 0 ? "+" : "") + Number(n).toFixed(2) + "%";
const sgn = n => (n > 0 ? "positive" : n < 0 ? "negative" : "");
const wonS = n => (n > 0 ? "+" : n < 0 ? "−" : "") + "₩" + Math.abs(Math.round(n)).toLocaleString("ko-KR");

async function decryptEnvelope(env, passphrase) {
  const dec = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const baseKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: dec(env.salt), iterations: env.iter, hash: "SHA-256" },
    baseKey, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: dec(env.iv) }, key, dec(env.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}

function sparkline(rows) {
  // rows: 최신 먼저 → 시간순으로 뒤집어 그림
  const vals = rows.map(r => r.close).reverse();
  if (vals.length < 2) return "";
  const W = 300, H = 46, min = Math.min(...vals), max = Math.max(...vals);
  const up = vals[vals.length - 1] >= vals[0];
  const pts = vals.map((v, i) => `${(i / (vals.length - 1) * W).toFixed(1)},${(H - (max === min ? H / 2 : (v - min) / (max - min) * H)).toFixed(1)}`).join(" ");
  const col = up ? "#f45b5b" : "#4c8dff";   // 한국식: 상승=빨강, 하락=파랑
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
}

let DATA = null;

function draw(days) {
  const ph = (DATA && DATA.priceHistory) || {};
  const cards = Object.keys(ph).map(code => {
    const item = ph[code], rows = (item.rows || []).slice(0, days);   // rows=최신 먼저
    const body = rows.map(r => {
      const amt = r.chgAmt == null ? "—" : wonS(r.chgAmt);
      return `<tr><td>${r.date}</td><td>₩${r.close.toLocaleString("ko-KR")}</td><td class="${sgn(r.chgAmt)}">${amt}</td><td class="${sgn(r.chg)}">${pct(r.chg)}</td></tr>`;
    }).join("");
    return `<div class="hist-card">
      <div class="section-title"><div><h3>${item.name}</h3><span class="hcode">${code}</span></div></div>
      <div class="hist-spark">${sparkline(rows)}</div>
      <div class="hist-table"><table><thead><tr><th>날짜</th><th>종가</th><th>등락금액</th><th>등락률</th></tr></thead><tbody>${body}</tbody></table></div>
    </div>`;
  }).join("");
  $("histGrid").innerHTML = cards || "<p style='color:#7f9a91;font-size:12px'>일자별 데이터가 아직 없습니다.</p>";
}

function render(d) {
  DATA = d;
  $("app").hidden = false;
  $("asOf").innerHTML = `<i></i> ${d.marketDate || ""}`;
  draw(60);
  document.querySelectorAll("#rangeTabs button").forEach(btn => btn.onclick = () => {
    document.querySelectorAll("#rangeTabs button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    draw(parseInt(btn.dataset.d, 10));
  });
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

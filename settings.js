// 설정 — 종목관리(KRX 검색→추가 명령) + 로그아웃
const UNI_CLI = "/Users/davy.kim/Desktop/Ipe/investments/autotrade/.venv/bin/python /Users/davy.kim/Desktop/Ipe/investments/autotrade/universe.py";
let MASTER = [], ADMIN = [];

function render(d) {
  document.getElementById("sideNav").innerHTML = sideNav("settings");
  wireLock(); metaBadge(d);
  ADMIN = d.universeAdmin || [];
  drawUniverse();

  // KRX 마스터(공개정보, 평문) 로드
  fetch("stocks_master.json?v=1").then(r => r.json()).then(m => {
    MASTER = m;
    $("masterInfo").innerHTML = `<i></i> KRX ${m.length.toLocaleString()}종목`;
  }).catch(() => { $("masterInfo").innerHTML = `<i></i> 마스터 로드 실패`; });

  const q = $("q"), res = $("results");
  q.addEventListener("input", () => {
    const t = q.value.trim().toLowerCase();
    if (t.length < 1) { res.hidden = true; return; }
    const inUni = new Set(ADMIN.filter(a => a.enabled).map(a => a.code));
    const hits = MASTER.filter(s => s.name.toLowerCase().includes(t) || s.code.startsWith(t)).slice(0, 8);
    res.innerHTML = hits.map(s =>
      `<div class="uni-hit" data-code="${s.code}" data-name="${s.name}" data-market="${s.market}">
        <b>${s.name}</b><span class="hcode">${s.code} · ${s.market}</span>
        ${inUni.has(s.code) ? '<em class="pill green">등록됨</em>' : ""}</div>`).join("")
      || `<div class="uni-hit none">검색 결과 없음</div>`;
    res.hidden = false;
    res.querySelectorAll(".uni-hit[data-code]").forEach(el => el.onclick = () => pick(el.dataset));
  });
  document.addEventListener("click", e => { if (!e.target.closest(".uni-search")) res.hidden = true; });

  $("logoutBtn").onclick = () => { sessionStorage.removeItem("auth"); location.href = "index.html"; };
}

function pick(s) {
  $("results").hidden = true;
  $("pickBox").hidden = false; $("copiedMsg").hidden = true;
  $("pickName").textContent = s.name;
  $("pickMeta").textContent = `${s.code} · ${s.market}`;
  const cmd = `${UNI_CLI} add ${s.code} ${s.name} ${s.market}`;
  $("cmdText").textContent = cmd;
  $("copyBtn").onclick = async () => {
    try { await navigator.clipboard.writeText(cmd); $("copiedMsg").hidden = false; }
    catch (e) { /* http 환경 등 */ prompt("복사가 차단됐습니다. 직접 복사하세요:", cmd); }
  };
}

function drawUniverse() {
  $("uniRows").innerHTML = ADMIN.length ? ADMIN.map(u => {
    const rmCmd = `${UNI_CLI} ${u.enabled ? "disable" : "enable"} ${u.code}`;
    const role = u.role || "core";
    const roleBadge = role === "free"
      ? `<em class="pill muted" title="프리슬롯: 전량매도 자유">FREE</em>`
      : `<em class="pill green" title="코어: 최소 1주 보유·물타기">CORE</em>`;
    return `<div class="order-row uni-row">
      <span><em class="pill ${u.enabled ? "green" : "muted"}">${u.enabled ? "활성" : "비활성"}</em> ${roleBadge}</span>
      <span><b>${u.name}</b><small>${u.code}</small></span>
      <span class="mono">${u.market}</span>
      <span class="mono">${u.added_at || "—"}</span>
      <span><button class="mini-copy" data-cmd="${rmCmd}">${u.enabled ? "제거 명령 복사" : "활성 명령 복사"}</button></span>
    </div>`;
  }).join("") : `<p class="empty-note">등록 종목이 없습니다.</p>`;
  document.querySelectorAll(".mini-copy").forEach(b => b.onclick = async () => {
    try { await navigator.clipboard.writeText(b.dataset.cmd); b.textContent = "✓ 복사됨"; }
    catch (e) { prompt("직접 복사하세요:", b.dataset.cmd); }
  });
}
guardAndLoad(render);

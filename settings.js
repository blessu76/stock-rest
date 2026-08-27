// 설정 — 종목관리(KRX 검색→추가 명령) + 로그아웃
const UNI_CLI = "/Users/davy.kim/Desktop/Ipe/investments/autotrade/.venv/bin/python /Users/davy.kim/Desktop/Ipe/investments/autotrade/universe.py";
let MASTER = [], ADMIN = [];

function render(d) {
  document.getElementById("sideNav").innerHTML = sideNav("settings");
  wireLock(); metaBadge(d);
  ADMIN = d.universeAdmin || [];
  drawUniverse();
  renderSettingsPanel(d);

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
// ── 현재 설정값(읽기전용) — config.yaml 그룹 카드 렌더 ──────────────
// data.settings 는 export_dashboard.py 가 채운다(프론트는 렌더만). 없으면 안전한 빈 상태.
// __MOCK_SETTINGS: data.settings 부재 시에만 쓰이는 무해한 폴백(실배포엔 항상 data.settings 존재).
function cfgEsc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
function renderSettingsPanel(d) {
  const grid = $("cfgGrid");
  if (!grid) return;
  const s = (d && d.settings) || (typeof window !== "undefined" && window.__MOCK_SETTINGS) || null;

  if (s && s.source) $("cfgSub").textContent = s.source;
  const meta = $("cfgMeta");
  if (meta) meta.innerHTML = s && s.updatedAt ? `<i></i> ${cfgEsc(s.updatedAt)}` : `<i></i> —`;
  const note = $("cfgNote");
  if (note) { note.innerHTML = s && s.note ? cfgEsc(s.note) : ""; note.hidden = !(s && s.note); }

  const groups = (s && Array.isArray(s.groups)) ? s.groups : [];
  if (!groups.length) {
    grid.className = "";                 // 빈 상태는 grid 해제(단일 메시지)
    grid.innerHTML = `<p class="cfg-empty">설정 데이터 없음 — 다음 export에서 채워집니다.</p>`;
    return;
  }
  grid.className = "cfg-grid";

  grid.innerHTML = groups.map(g => {
    const locked = !!g.locked;
    const items = (Array.isArray(g.items) ? g.items : []).map(it =>
      `<div class="cfg-item">
        <span class="cfg-item-l"><b>${cfgEsc(it.label)}</b>${it.note ? `<small>${cfgEsc(it.note)}</small>` : ""}</span>
        <span class="cfg-item-v">${cfgEsc(it.value)}</span>
      </div>`).join("") || `<p class="cfg-empty">항목 없음</p>`;
    return `<div class="cfg-card${locked ? " locked" : ""}">
      <div class="cfg-card-head">
        <h3>${cfgEsc(g.title)}</h3>
        ${locked ? `<span class="cfg-lock">🔒 LOCKED</span>` : ""}
      </div>
      ${items}
    </div>`;
  }).join("");
}

guardAndLoad(render);

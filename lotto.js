// 로또 6/45 — 동행복권 당첨번호(읽기 전용). 색상=번호대별 공식 색.
function ballColor(n) {
  return n <= 10 ? "#fbc400" : n <= 20 ? "#69c8f2" : n <= 30 ? "#ff7272" : n <= 40 ? "#aaa" : "#b0d840";
}
function ball(n, bonus) {
  return `<span class="lb" style="background:${ballColor(n)}">${n}</span>`;
}

// 시드 랜덤(방문마다 다르게) — Date.now 기반
function rng() { let s = (Date.now() ^ (Math.random() * 1e9)) >>> 0; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; }

// 알고리즘형: 균형 규칙 세트 생성(과거데이터 불필요)
function genAlgorithmic() {
  const r = rng();
  for (let tries = 0; tries < 2000; tries++) {
    const pool = [...Array(45)].map((_, i) => i + 1);
    const pick = [];
    for (let k = 0; k < 6; k++) pick.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    pick.sort((a, b) => a - b);
    const sum = pick.reduce((a, b) => a + b, 0);
    const odd = pick.filter(n => n % 2).length;
    const low = pick.filter(n => n <= 22).length;
    let maxRun = 1, run = 1;
    for (let i = 1; i < 6; i++) { run = pick[i] === pick[i - 1] + 1 ? run + 1 : 1; maxRun = Math.max(maxRun, run); }
    if (sum >= 100 && sum <= 175 && odd >= 2 && odd <= 4 && low >= 2 && low <= 4 && maxRun <= 2)
      return { nums: pick, sum, odd, low };
  }
  return null;
}

// 통계형: 과거 빈도 가중 추천
function genStatistical(freq) {
  const r = rng();
  const weights = [];
  for (let n = 1; n <= 45; n++) weights.push([n, (freq[n] || freq[String(n)] || 0) + 1]);
  const pick = [];
  const w = weights.slice();
  for (let k = 0; k < 6; k++) {
    const tot = w.reduce((a, x) => a + x[1], 0);
    let t = r() * tot, idx = 0;
    while (t > w[idx][1]) { t -= w[idx][1]; idx++; }
    pick.push(w[idx][0]); w.splice(idx, 1);
  }
  return pick.sort((a, b) => a - b);
}

function render(d) {
  document.getElementById("sideNav").innerHTML = sideNav("lotto");
  wireLock(); metaBadge(d);
  const lt = d.lotto || { latest: null, history: [], stats: { count: 0 } };
  const stats = lt.stats || { count: 0 };

  // 알고리즘형 (즉시 작동)
  const drawAlgo = () => {
    const g = genAlgorithmic();
    document.getElementById("algoBalls").innerHTML = g ? g.nums.map(n => ball(n)).join("") : "";
    document.getElementById("algoMeta").textContent = g ? `합계 ${g.sum} · 홀 ${g.odd}/짝 ${6 - g.odd} · 저 ${g.low}/고 ${6 - g.low}` : "";
  };
  drawAlgo();
  document.getElementById("genAlgo").onclick = drawAlgo;

  // 통계형 (데이터 있을 때만)
  const drawStat = () => {
    if (!stats.count) return;
    document.getElementById("statBalls").innerHTML = genStatistical(stats.freq).map(n => ball(n)).join("");
  };
  if (stats.count) {
    document.getElementById("statCount").textContent = `${stats.count}회 데이터`;
    document.getElementById("statMeta").textContent = "빈도 가중 랜덤 · 재미용";
    drawStat();
    document.getElementById("genStat").onclick = drawStat;
    // 통계 요약: 최다 번호 + 자리별 최다
    document.getElementById("statSummary").hidden = false;
    document.getElementById("statSummarySub").textContent = `${stats.count}회 데이터 · 예측력 없음, 참고용`;
    if (stats.topNumber) {
      document.getElementById("topNumBall").innerHTML = ball(stats.topNumber.number);
      document.getElementById("topNumCount").textContent = `${stats.topNumber.count}회 출현`;
    }
    document.getElementById("posTop").innerHTML = (stats.posTop || []).map(p =>
      `<div class="pos-item"><span class="pos-label">${p.pos}번째</span><span class="lb sm" style="background:${ballColor(p.number)}">${p.number}</span><small>${p.count}회</small></div>`).join("");
    // 빈도표
    document.getElementById("freqCard").hidden = false;
    const mx = Math.max(...Object.values(stats.freq));
    document.getElementById("freqGrid").innerHTML = Object.keys(stats.freq).map(n => {
      const c = stats.freq[n], h = mx ? Math.round(c / mx * 100) : 0;
      const hot = stats.hot.includes(+n), cold = stats.cold.includes(+n);
      return `<div class="freq-cell ${hot ? 'hot' : cold ? 'cold' : ''}"><span class="fb" style="background:${ballColor(+n)}">${n}</span><i style="height:${Math.max(4, h * 0.4)}px"></i><small>${c}</small></div>`;
    }).join("");
  } else {
    document.getElementById("genStat").disabled = true;
  }

  if (lt.latest) {
    document.getElementById("latestCard").hidden = false;
    document.getElementById("pending").hidden = true;
    document.getElementById("latestRound").textContent = `${lt.latest.round}회`;
    document.getElementById("latestDate").textContent = lt.latest.date;
    document.getElementById("latestBalls").innerHTML =
      lt.latest.nums.map(n => ball(n)).join("") +
      `<span class="lb-plus">+</span><span class="lb bonus" style="background:${ballColor(lt.latest.bonus)}">${lt.latest.bonus}</span>`;
  } else {
    document.getElementById("pending").hidden = false;
  }

  document.getElementById("lottoRows").innerHTML = (lt.history || []).map(r =>
    `<tr><td><b>${r.round}회</b></td><td class="mono">${r.date}</td>
     <td><div class="lotto-balls sm">${r.nums.map(n => ball(n)).join("")}</div></td>
     <td><span class="lb sm bonus" style="background:${ballColor(r.bonus)}">${r.bonus}</span></td></tr>`).join("")
    || `<tr><td colspan="4" class="empty-note">이력이 없습니다.</td></tr>`;
}
guardAndLoad(render);

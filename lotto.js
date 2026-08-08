// 로또 6/45 — 당첨번호(읽기전용) + 예측 4종(서버 생성, 불러오기만). 색상=번호대별 공식 색.
function ballColor(n) {
  return n <= 10 ? "#fbc400" : n <= 20 ? "#69c8f2" : n <= 30 ? "#ff7272" : n <= 40 ? "#aaa" : "#b0d840";
}
function ball(n, hit) {
  return `<span class="lb${hit ? " hit" : ""}" style="background:${ballColor(n)}">${n}</span>`;
}

// 예측 4종 (서버 lotto_predictions 에서 생성, 여기선 표시만)
const PRED_KINDS = [
  { key: "algo",    label: "🎲 알고리즘형" },
  { key: "statFun", label: "📊 통계형(재미)" },
  { key: "statTop", label: "① 많이나온숫자" },
  { key: "statAvg", label: "② 평균값" },
];

function render(d) {
  document.getElementById("sideNav").innerHTML = sideNav("lotto");
  wireLock(); metaBadge(d);
  const lt = d.lotto || { latest: null, history: [], stats: { count: 0 }, predictions: {} };
  const stats = lt.stats || { count: 0 };
  const preds = lt.predictions || {};
  const latestRound = lt.latest ? lt.latest.round : 0;
  const targetRound = latestRound + 1;
  const target = preds[targetRound] || preds[String(targetRound)];

  // 이번 회차 예측번호 (서버 생성값 표시)
  document.getElementById("predRound").textContent = `${targetRound}회`;
  if (target) {
    document.getElementById("predList").innerHTML = PRED_KINDS.map(k => {
      const nums = target[k.key] || [];
      return `<div class="pred-item"><div class="pred-head"><span class="pred-label">${k.label}</span><span class="pred-fixed">고정</span></div>` +
        `<div class="lotto-balls">${nums.map(n => ball(n)).join("") || "—"}</div></div>`;
    }).join("");
  } else {
    document.getElementById("predList").innerHTML =
      `<p class="empty-note">${targetRound}회 예측번호는 토요일 추첨 기록 시(21:10·22:00) 서버에서 자동 생성됩니다.</p>`;
  }

  // 통계 요약 + 빈도표
  if (stats.count) {
    document.getElementById("statSummary").hidden = false;
    document.getElementById("statSummarySub").textContent = `${stats.count}회 데이터 · 예측력 없음, 참고용`;
    if (stats.topNumber) {
      document.getElementById("topNumBall").innerHTML = ball(stats.topNumber.number);
      document.getElementById("topNumCount").textContent = `${stats.topNumber.count}회 출현`;
    }
    document.getElementById("posTop").innerHTML = (stats.posTop || []).map(p =>
      `<div class="pos-item"><span class="pos-label">${p.pos}번째</span><span class="lb sm" style="background:${ballColor(p.number)}">${p.number}</span><small>최다 ${p.count}회</small>${p.avg != null ? `<small class="pos-avg">평균 ${p.avg}</small>` : ""}</div>`).join("");
    document.getElementById("freqCard").hidden = false;
    const mx = Math.max(...Object.values(stats.freq));
    document.getElementById("freqGrid").innerHTML = Object.keys(stats.freq).map(n => {
      const c = stats.freq[n], h = mx ? Math.round(c / mx * 100) : 0;
      const hot = stats.hot.includes(+n), cold = stats.cold.includes(+n);
      return `<div class="freq-cell ${hot ? "hot" : cold ? "cold" : ""}"><span class="fb" style="background:${ballColor(+n)}">${n}</span><i style="height:${Math.max(4, h * 0.4)}px"></i><small>${c}</small></div>`;
    }).join("");
  }

  // 최신 회차
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

  // 지난 회차 + 예측 채점 하위그리드(1236회~)
  document.getElementById("lottoRows").innerHTML = (lt.history || []).map(r => {
    let row = `<tr><td><b>${r.round}회</b></td><td class="mono">${r.date}</td>` +
      `<td><div class="lotto-balls sm">${r.nums.map(n => ball(n)).join("")}</div></td>` +
      `<td><span class="lb sm bonus" style="background:${ballColor(r.bonus)}">${r.bonus}</span></td></tr>`;
    const pred = preds[r.round] || preds[String(r.round)];
    if (r.round >= 1236 && pred) {
      const actual = new Set(r.nums);
      const items = PRED_KINDS.map(k => {
        const nums = pred[k.key] || [];
        const m = nums.filter(n => actual.has(n)).length;
        const bonusHit = nums.includes(r.bonus);
        return `<div class="pred-sg-item"><span class="pred-sg-label">${k.label}</span>` +
          `<div class="lotto-balls sm">${nums.map(n => ball(n, actual.has(n))).join("") || "—"}</div>` +
          `<span class="pred-sg-rate">적중 ${m}/6${bonusHit ? ` <i class="bh">+보너스</i>` : ""}</span></div>`;
      }).join("");
      row += `<tr class="pred-row"><td colspan="4"><div class="pred-sg-title">🎯 ${r.round}회 예측번호 채점</div><div class="pred-subgrid">${items}</div></td></tr>`;
    }
    return row;
  }).join("") || `<tr><td colspan="4" class="empty-note">이력이 없습니다.</td></tr>`;
}
guardAndLoad(render);

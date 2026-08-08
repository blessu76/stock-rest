// 로또 6/45 — 동행복권 당첨번호(읽기 전용). 색상=번호대별 공식 색.
function ballColor(n) {
  return n <= 10 ? "#fbc400" : n <= 20 ? "#69c8f2" : n <= 30 ? "#ff7272" : n <= 40 ? "#aaa" : "#b0d840";
}
function ball(n, bonus) {
  return `<span class="lb" style="background:${ballColor(n)}">${n}</span>`;
}

function render(d) {
  document.getElementById("sideNav").innerHTML = sideNav("lotto");
  wireLock(); metaBadge(d);
  const lt = d.lotto || { latest: null, history: [] };

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

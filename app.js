// stock() 대시보드 — data.json fetch 후 렌더 (외부 의존성 없음)
const won = n => (n == null ? '—' : (n < 0 ? '-' : '') + Math.abs(Math.round(n)).toLocaleString('ko-KR') + '원');
const pct = n => (n == null ? '—' : (n > 0 ? '+' : '') + n.toFixed(2) + '%');
const sign = n => (n > 0 ? 'up' : n < 0 ? 'down' : '');
const $ = id => document.getElementById(id);

// ---- 복호화 (WebCrypto, export의 PBKDF2-SHA256 + AES-GCM 과 호환) ----
async function decryptEnvelope(env, passphrase) {
  const dec = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const baseKey = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: dec(env.salt), iterations: env.iter, hash: 'SHA-256' },
    baseKey, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: dec(env.iv) }, key, dec(env.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}

function showLock(env, err) {
  document.querySelector('.wrap').style.filter = 'blur(6px)';
  let ov = document.getElementById('lock');
  if (!ov) {
    ov = document.createElement('div'); ov.id = 'lock';
    ov.innerHTML = `<div class="lockbox">
      <div class="locklogo">stock()</div>
      <div class="lockmsg">비밀번호를 입력하세요</div>
      <input id="pw" type="password" autocomplete="current-password" placeholder="passphrase">
      <button id="pwbtn">열기</button>
      <div id="pwerr" class="lockerr"></div></div>`;
    document.body.appendChild(ov);
    const tryOpen = async () => {
      const pw = document.getElementById('pw').value;
      try {
        const payload = await decryptEnvelope(env, pw);
        sessionStorage.setItem('pw', pw);
        ov.remove(); document.querySelector('.wrap').style.filter = '';
        render(payload);
      } catch (e) {
        document.getElementById('pwerr').textContent = '비밀번호가 올바르지 않습니다';
        sessionStorage.removeItem('pw');
      }
    };
    document.getElementById('pwbtn').onclick = tryOpen;
    document.getElementById('pw').addEventListener('keydown', e => { if (e.key === 'Enter') tryOpen(); });
  }
  if (err) document.getElementById('pwerr').textContent = err;
  document.getElementById('pw').focus();
}

async function load() {
  let d;
  try {
    const r = await fetch('data.json?t=' + Date.now());
    d = await r.json();
  } catch (e) {
    document.body.innerHTML = '<p style="font-family:monospace;color:#E5534B;padding:40px">data.json 로드 실패: ' + e + '</p>';
    return;
  }
  if (d && d.encrypted) {
    const saved = sessionStorage.getItem('pw');
    if (saved) {
      try { return render(await decryptEnvelope(d, saved)); }
      catch (e) { sessionStorage.removeItem('pw'); }
    }
    return showLock(d);
  }
  render(d);
}

function render(d) {
  const a = d.account;

  // badges / meta
  $('asOf').textContent = d.asOf || '—';
  const mode = $('mode'); mode.textContent = 'MODE ' + (d.mode || '—');
  mode.classList.add(d.mode === 'LIVE' ? 'live' : 'off');
  $('risk').textContent = d.riskState || '—';
  $('note').textContent = d.note || '';

  // hero
  $('recoveryRate').textContent = a.recoveryRate != null ? a.recoveryRate.toFixed(1) + '%' : '—';
  $('needReturn').textContent = a.needReturnPct != null ? '+' + a.needReturnPct.toFixed(1) + '%' : '—';
  $('startEquity').textContent = won(a.startEquity);
  $('principal').textContent = won(a.principal);
  $('equityInline').textContent = won(a.equity);

  // recovery bar: 목표 원금 대비 현재 총자산(=회복률)만큼 채움, 시작 지점 마커 표시
  const fillPct = Math.max(0, Math.min(100, (a.equity / a.principal) * 100));
  $('barFill').style.width = fillPct + '%';
  const startPos = Math.max(0, Math.min(100, (a.startEquity / a.principal) * 100));
  $('barNow').style.left = startPos + '%';

  // kpis
  $('equity').textContent = won(a.equity);
  $('equityBreak').textContent = '주식 ' + won(a.stockValue) + ' + 예수금 ' + won(a.settledCash);
  $('principal2').textContent = won(a.principal);
  const pnlEl = $('pnl'); pnlEl.textContent = won(a.pnl); pnlEl.className = 'kpi-v ' + sign(a.pnl);
  const prEl = $('pnlRate'); prEl.textContent = pct(a.totalPnlRate); prEl.className = 'kpi-s ' + sign(a.totalPnlRate);
  $('shortfall').textContent = won(a.shortfall);
  const dEl = $('dailyPnl'); dEl.textContent = won(a.dailyPnl); dEl.className = 'kpi-v ' + sign(a.dailyPnl);

  renderPath(d.path || [], a.equity);
  renderHoldings(d.holdings || []);
}

function renderPath(path, equity) {
  if (!path.length) return;
  const W = 460, H = 200, pad = 34;
  const vals = path.map(p => p.value);
  const min = Math.min(...vals, equity) * 0.98, max = Math.max(...vals) * 1.02;
  const x = i => pad + (i * (W - pad * 2)) / (path.length - 1);
  const y = v => H - pad - ((v - min) / (max - min)) * (H - pad * 2);
  let line = '', dots = '', labels = '';
  path.forEach((p, i) => {
    line += (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.value).toFixed(1) + ' ';
    dots += `<circle cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="3.5" fill="#C9A84C"/>`;
    labels += `<text x="${x(i).toFixed(1)}" y="${H - 10}" fill="#8B93A1" font-size="10" text-anchor="middle" font-family="JetBrains Mono">${p.label}</text>`;
    labels += `<text x="${x(i).toFixed(1)}" y="${(y(p.value) - 10).toFixed(1)}" fill="#8FAF8F" font-size="9" text-anchor="middle" font-family="JetBrains Mono">${(p.value/10000).toFixed(0)}만</text>`;
  });
  // 현재 총자산 기준선
  const eqY = y(equity).toFixed(1);
  const nowLine = `<line x1="${pad}" y1="${eqY}" x2="${W-pad}" y2="${eqY}" stroke="#E5534B" stroke-dasharray="4 3" stroke-width="1"/>
    <text x="${W-pad}" y="${eqY-5}" fill="#E5534B" font-size="9" text-anchor="end" font-family="JetBrains Mono">현재 ${(equity/10000).toFixed(0)}만</text>`;
  $('pathChart').innerHTML =
    `<svg viewBox="0 0 ${W} ${H}"><path d="${line}" fill="none" stroke="#C9A84C" stroke-width="2"/>${dots}${nowLine}${labels}</svg>`;
}

function renderHoldings(rows) {
  $('holdingsBody').innerHTML = rows.map(h => `
    <tr>
      <td>${h.name}<br><span style="color:#8B93A1;font-size:11px;font-family:'JetBrains Mono'">${h.code}</span></td>
      <td>${h.qty}</td>
      <td>${h.avg.toLocaleString('ko-KR')}</td>
      <td>${h.price.toLocaleString('ko-KR')}</td>
      <td class="${sign(h.pnl)}">${won(h.pnl)}</td>
      <td class="${sign(h.pnlRate)}">${pct(h.pnlRate)}</td>
    </tr>`).join('');
}

load();

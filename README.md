# stock.ipe.rest — 원금 회복 대시보드

ipe Studio 자동매매 결과 대시보드 (정적, GitHub Pages).

- **데이터 암호화**: `data.json`은 AES-GCM(PBKDF2-SHA256, 200k)로 암호화. 사이트는 공개지만
  실제 계좌 숫자는 패스프레이즈를 아는 사람만 브라우저에서 복호화해 열람. **평문 금융데이터는 사이트에 없음.**
- 생성기: `investments/autotrade/export_dashboard.py` (READ-ONLY, 토스 API, 로컬 secret)
- 배포: GitHub Pages, 커스텀 도메인 `stock.ipe.rest` (CNAME → blessu76.github.io)

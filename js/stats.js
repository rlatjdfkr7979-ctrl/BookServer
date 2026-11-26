/* ========================================
   📊 도서 이용 통계 패널
   - books.csv(대출/반납 이력) + library.csv(도서 목록, 현재 대출 상태)만으로 브라우저에서 계산
   - 대출 건수 = '대출' 이력 행 수 ('반납'·'연장' 행은 제외)
   ======================================== */

function openStatsPanel() {
  if (!window.booksData || !window.libraryData || !window.libraryData.length) {
    showToast('⚠️ 데이터를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
    return;
  }
  renderStats();
  document.getElementById('statsPanel').style.display = 'flex';
  document.getElementById('statsPanelOverlay').style.display = 'block';
}

function closeStatsPanel() {
  document.getElementById('statsPanel').style.display = 'none';
  document.getElementById('statsPanelOverlay').style.display = 'none';
}

window.openStatsPanel = openStatsPanel;
window.closeStatsPanel = closeStatsPanel;

function computeStats() {
  const books = window.booksData;
  const lib = window.libraryData;
  const bh = books[0].map(norm);
  const bDate = findColIndex(bh, ['등록일', '대출일', '일자']);
  const bCode = findColIndex(bh, ['코드']);
  const bStatus = findColIndex(bh, ['상태']);

  const lh = lib[0].map(norm);
  const lCode = findColIndex(lh, ['코드']);
  const lTitle = findColIndex(lh, ['제목', '도서명']);
  const lGenre = findColIndex(lh, ['장르']);
  const lUser = findColIndex(lh, ['대출자', '대여자']);

  const meta = {};
  for (let i = 1; i < lib.length; i++) {
    const code = norm(lib[i][lCode]);
    if (code) meta[code] = { title: norm(lib[i][lTitle]), genre: lGenre === -1 ? '' : norm(lib[i][lGenre]) };
  }

  // 최근 12개월 키 (오래된 순)
  const now = new Date();
  const monthKeys = [];
  for (let k = 11; k >= 0; k--) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
    monthKeys.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
  }
  const monthly = Object.fromEntries(monthKeys.map(k => [k, 0]));
  const byBook = {};
  const byGenre = {};
  let total = 0;

  for (let i = 1; i < books.length; i++) {
    const status = norm(books[i][bStatus]);
    if (status.includes('반납') || status.includes('연장')) continue;
    const code = norm(books[i][bCode]);
    if (!code) continue;
    total++;
    byBook[code] = (byBook[code] || 0) + 1;
    const genre = (meta[code] && meta[code].genre) || '미분류';
    byGenre[genre] = (byGenre[genre] || 0) + 1;
    const t = parseDate(books[i][bDate]);
    if (!isNaN(t)) {
      const d = new Date(t);
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      if (key in monthly) monthly[key]++;
    }
  }

  const top = Object.entries(byBook)
    .map(([code, n]) => ({ label: (meta[code] && meta[code].title) || code, value: n }))
    .sort((a, b) => b.value - a.value).slice(0, 10);
  const genres = Object.entries(byGenre)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  const overdue = [];
  let borrowed = 0;
  for (let i = 1; i < lib.length; i++) {
    const info = lib[i]._statusInfo;
    if (!info) continue;
    if (info.status === '대출' || info.status === '연체') borrowed++;
    if (info.status === '연체') {
      overdue.push({ title: norm(lib[i][lTitle]), borrower: lUser === -1 ? '' : norm(lib[i][lUser]), days: info.daysOverdue || 0 });
    }
  }
  overdue.sort((a, b) => b.days - a.days);

  return {
    totalBooks: lib.length - 1,
    borrowed,
    overdue,
    total,
    thisMonth: monthly[monthKeys[monthKeys.length - 1]],
    monthly: monthKeys.map(k => ({ label: k.slice(2).replace('-', '.'), value: monthly[k] })),
    top,
    genres
  };
}

const STATS_BAR = '#2563eb';

function statsCard(label, value, sub) {
  return `<div style="flex:1;min-width:130px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:12px 14px;">
    <div style="font-size:12px;color:#6b7280;">${escapeHtml(label)}</div>
    <div style="font-size:26px;font-weight:700;color:#111827;line-height:1.3;">${escapeHtml(value)}</div>
    ${sub ? `<div style="font-size:12px;color:#6b7280;">${escapeHtml(sub)}</div>` : ''}
  </div>`;
}

// 세로 막대 (월별 추이) - 값은 막대 위에 표시, 막대에 마우스를 올리면 툴팁
function statsColumnChart(items) {
  const max = Math.max(1, ...items.map(d => d.value));
  const cols = items.map(d => {
    const h = Math.round((d.value / max) * 120);
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;min-width:0;" title="${escapeHtml(d.label)}: ${d.value}건">
      <span style="font-size:11px;color:#374151;margin-bottom:2px;">${d.value}</span>
      <div style="width:60%;max-width:28px;height:${Math.max(h, d.value ? 2 : 0)}px;background:${STATS_BAR};border-radius:4px 4px 0 0;"></div>
    </div>`;
  }).join('');
  const labels = items.map(d => `<div style="flex:1;text-align:center;font-size:11px;color:#6b7280;min-width:0;">${escapeHtml(d.label)}</div>`).join('');
  return `<div style="display:flex;align-items:flex-end;gap:4px;height:150px;border-bottom:1px solid #d1d5db;">${cols}</div>
    <div style="display:flex;gap:4px;margin-top:4px;">${labels}</div>`;
}

// 가로 막대 (순위/비교)
function statsBarList(items, unit) {
  if (!items.length) return '<div style="color:#9ca3af;font-size:13px;padding:8px 0;">데이터가 없습니다.</div>';
  const max = Math.max(1, ...items.map(d => d.value));
  return items.map((d, i) => `<div style="display:flex;align-items:center;gap:8px;margin:5px 0;font-size:13px;" title="${escapeHtml(d.label)}: ${d.value}${unit}">
    <div style="flex:0 0 40%;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#111827;">${escapeHtml(d.label)}</div>
    <div style="flex:1;background:#f1f5f9;border-radius:4px;height:12px;">
      <div style="width:${(d.value / max) * 100}%;height:12px;background:${STATS_BAR};border-radius:4px;"></div>
    </div>
    <div style="flex:0 0 44px;text-align:right;color:#374151;">${d.value}${unit}</div>
  </div>`).join('');
}

function statsSection(title, bodyHtml) {
  return `<section style="margin-top:20px;">
    <h4 style="margin:0 0 8px 0;font-size:14px;color:#111827;">${escapeHtml(title)}</h4>${bodyHtml}</section>`;
}

function renderStats() {
  const s = computeStats();
  const rate = s.totalBooks ? Math.round((s.borrowed / s.totalBooks) * 1000) / 10 : 0;

  const overdueHtml = s.overdue.length
    ? `<table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr style="background:#f8fafc;"><th style="padding:6px 10px;text-align:left;border-bottom:1px solid #e5e7eb;">도서</th>
        <th style="padding:6px 10px;text-align:left;border-bottom:1px solid #e5e7eb;">대출자</th>
        <th style="padding:6px 10px;text-align:right;border-bottom:1px solid #e5e7eb;">연체</th></tr>
        ${s.overdue.map(o => `<tr><td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;">${escapeHtml(o.title)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;">${escapeHtml(o.borrower)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;text-align:right;color:#dc2626;font-weight:600;">${o.days}일</td></tr>`).join('')}
      </table>`
    : '<div style="color:#047857;font-size:13px;">✅ 연체 중인 도서가 없습니다.</div>';

  document.getElementById('statsBody').innerHTML =
    `<div style="display:flex;gap:10px;flex-wrap:wrap;">
      ${statsCard('전체 도서', s.totalBooks.toLocaleString() + '권')}
      ${statsCard('현재 대출 중', s.borrowed + '권', '대출률 ' + rate + '%')}
      ${statsCard('연체', s.overdue.length + '권')}
      ${statsCard('이번 달 대출', s.thisMonth + '건', '누적 ' + s.total.toLocaleString() + '건')}
    </div>`
    + statsSection('월별 대출 건수 (최근 12개월)', statsColumnChart(s.monthly))
    + statsSection('인기 도서 TOP 10 (누적 대출)', statsBarList(s.top, '회'))
    + statsSection('장르별 대출 건수', statsBarList(s.genres, '건'))
    + statsSection('연체 도서 목록', overdueHtml);
}

/* ========================================
   📚 도서관리 시스템 - 테이블 모듈
   ======================================== */

// 전역 변수
let currentPage = {loanTable: 1, libraryTable: 1};
let totalPages = {loanTable: 1, libraryTable: 1};
let allTableData = {loanTable: [], libraryTable: []};

/* 테이블별 뷰 상태: 원본(source) → 필터 → 검색 → 정렬 → 페이지 순으로 항상 한 파이프라인으로 처리
   source : 원본 행 배열 (헤더 포함)
   filter : 행 → boolean (대출 중, 최근 30일 등)
   newest : 최신 등록순 정렬 여부
   query  : 검색어 (소문자)
   sort   : {col, asc} | null (헤더 클릭 정렬)  */
const tableState = {};
function getTableState(id) {
  if (!tableState[id]) {
    tableState[id] = {source: [], withQR: false, filter: null, newest: false, query: '', sort: null};
  }
  return tableState[id];
}
window.getTableState = getTableState;

// 전역에 노출
window.currentPage = currentPage;
window.totalPages = totalPages;
window.allTableData = allTableData;

/* ====== 유틸리티 ====== */
const norm = s => String(s || '').replace(/\uFEFF/g,'').trim();
const normHead = s => norm(s).replace(/\s/g,'');
const includesAny = (h, keys) => keys.some(k => normHead(h).includes(k));
function findColIndex(header, candidates) {
  return header.findIndex(h => includesAny(h, candidates));
}

// 전역에 노출
window.norm = norm;
window.normHead = normHead;
window.includesAny = includesAny;
window.findColIndex = findColIndex;

/* ====== 날짜 파서 (YYYY-MM-DD / YYYY.MM.DD / YYYY/MM/DD / "2024. 1. 5 오후 3:20" 등) ======
   브라우저마다 다른 new Date(문자열) 동작을 피하기 위해 직접 파싱. 실패 시 NaN */
function parseDate(str) {
  const s = norm(str);
  if (!s) return NaN;
  const m = s.match(/^(\d{4})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{1,2})/);
  if (m) {
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return isNaN(d) ? NaN : d.getTime();
  }
  return NaN;
}
window.parseDate = parseDate;

/* ====== CSV 로드 ====== */
async function loadCSV(file) {
  const res = await fetch(file + '?v=' + Date.now());
  if (!res.ok) throw new Error(file + ' 로드 실패');
  const text = await res.text();
  return Papa.parse(text.trim(), {skipEmptyLines: true}).data;
}

window.loadCSV = loadCSV;

/* ====== 페이지네이션 ====== */
function createPagination(tableId, paginationId, totalItems) {
  const pagination = document.getElementById(paginationId);
  const pages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  totalPages[tableId] = pages;
  
  if (pages <= 1) {
    pagination.innerHTML = '';
    return;
  }
  
  const current = currentPage[tableId];
  let html = '';
  
  // 이전 버튼
  html += `<button onclick="changePage('${tableId}', '${paginationId}', ${current - 1})" ${current === 1 ? 'disabled' : ''}>‹ 이전</button>`;
  
  // 페이지 번호들
  let startPage = Math.max(1, current - 2);
  let endPage = Math.min(pages, current + 2);
  
  if (startPage > 1) {
    html += `<button onclick="changePage('${tableId}', '${paginationId}', 1)">1</button>`;
    if (startPage > 2) html += `<span style="padding:0 8px">...</span>`;
  }
  
  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="${i === current ? 'active' : ''}" onclick="changePage('${tableId}', '${paginationId}', ${i})">${i}</button>`;
  }
  
  if (endPage < pages) {
    if (endPage < pages - 1) html += `<span style="padding:0 8px">...</span>`;
    html += `<button onclick="changePage('${tableId}', '${paginationId}', ${pages})">${pages}</button>`;
  }
  
  // 다음 버튼
  html += `<button onclick="changePage('${tableId}', '${paginationId}', ${current + 1})" ${current === pages ? 'disabled' : ''}>다음 ›</button>`;
  
  // 페이지 정보
  html += `<span class="page-info">${current} / ${pages} 페이지 (총 ${totalItems}개)</span>`;
  
  pagination.innerHTML = html;
}

function changePage(tableId, paginationId, page) {
  const pages = totalPages[tableId];
  if (page < 1 || page > pages) return;
  
  currentPage[tableId] = page;
  renderTableWithPagination(allTableData[tableId], tableId, tableId === 'libraryTable');
  createPagination(tableId, paginationId, allTableData[tableId].length - 1);
  
  // 테이블 스크롤을 맨 위로 이동
  const tableWrap = document.querySelector(`#${tableId === 'loanTable' ? 'loanSection' : 'librarySection'} .table-wrap`);
  if (tableWrap) tableWrap.scrollTop = 0;
}

window.createPagination = createPagination;
window.changePage = changePage;

/* ====== 테이블 렌더링 ====== */
/* 원본 데이터를 설정하고 화면 갱신 (검색어/정렬/필터 상태는 유지, 페이지는 1로) */
function renderTable(rows, id, withQR = false) {
  const st = getTableState(id);
  st.source = rows;
  st.withQR = withQR;
  currentPage[id] = 1;
  refreshTable(id);
}

/* 표시용 데이터 계산: 필터 → 검색 → (최신순) → 정렬 */
function computeView(id) {
  const st = getTableState(id);
  const src = st.source;
  if (!src || src.length === 0) return [[]];
  const header = src[0];
  let data = src.slice(1);

  if (st.filter) data = data.filter(st.filter);

  if (st.query) {
    data = data.filter(row => row.join(' ').toLowerCase().includes(st.query));
  }

  if (st.newest) {
    // 행 순서를 뒤집은 뒤, 날짜 열이 있으면 날짜 내림차순(동일 날짜는 뒤집힌 순서 유지)
    data = data.slice().reverse();
    const dIdx = findColIndex(header, ['등록일', '일자', '날짜', '입고일', '구입일', '대출일']);
    if (dIdx !== -1) {
      data = data
        .map((row, i) => ({row, i, t: parseDate(row[dIdx])}))
        .sort((a, b) => {
          if (isNaN(a.t) && isNaN(b.t)) return a.i - b.i;
          if (isNaN(a.t)) return 1;
          if (isNaN(b.t)) return -1;
          return (b.t - a.t) || (a.i - b.i);
        })
        .map(x => x.row);
    }
  }

  if (st.sort) data = sortRows(data, st.sort.col, st.sort.asc);

  return [header, ...data];
}

/* 상태(검색/필터/정렬)를 반영해 테이블과 페이지네이션 다시 그림 */
function refreshTable(id, {keepPage = false} = {}) {
  const st = getTableState(id);
  const view = computeView(id);
  allTableData[id] = view; // 현재 표시 대상 (검색/필터/정렬 반영된 전체 목록)

  const total = view.length - 1;
  const pages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
  if (!keepPage) currentPage[id] = 1;
  currentPage[id] = Math.min(Math.max(1, currentPage[id] || 1), pages);

  if (view[0] && view[0].length) {
    renderTableWithPagination(view, id, st.withQR);
  } else {
    document.getElementById(id).innerHTML = '';
  }
  const paginationId = id === 'loanTable' ? 'loanPagination' : 'libraryPagination';
  createPagination(id, paginationId, total);
  updateResultInfo(id, total, st);
}

/* 검색/필터로 줄어든 경우 결과 건수 / 결과 없음 안내 */
function updateResultInfo(id, total, st) {
  const table = document.getElementById(id);
  const wrap = table.parentNode;
  let info = wrap.parentNode.querySelector(`.result-info[data-for="${id}"]`);
  const filtered = st.query || st.filter;
  if (!filtered) { if (info) info.remove(); return; }
  if (!info) {
    info = document.createElement('div');
    info.className = 'result-info';
    info.dataset.for = id;
    info.style.cssText = 'margin:6px 2px;font-size:13px;color:#6b7280;';
    wrap.parentNode.insertBefore(info, wrap);
  }
  info.textContent = total === 0 ? '검색 결과가 없습니다.' : `검색 결과 ${total}건`;
}

window.refreshTable = refreshTable;

function renderTableWithPagination(rows, id, withQR = false) {
  const header = rows[0];
  const table = document.getElementById(id);
  const finalHeader = withQR ? [...header, '대여 QR 보기'] : header;
  
  // 줄바꿈이 필요한 열 인덱스(제목/도서명, 기타/비고)
  const wrapIdxSet = new Set([
    findColIndex(header, ['제목', '도서명']),
    findColIndex(header, ['기타', '비고'])
  ].filter(idx => idx >= 0));
  
  // 현재 페이지의 데이터 계산
  const page = currentPage[id];
  const startIdx = (page - 1) * ITEMS_PER_PAGE + 1; // 헤더 제외하고 시작
  const endIdx = Math.min(startIdx + ITEMS_PER_PAGE - 1, rows.length - 1);
  
  // 헤더 생성 (정렬 기능 포함)
  const headerRow = document.createElement('tr');
  finalHeader.forEach((h, idx) => {
    const th = document.createElement('th');
    th.textContent = h;

    // QR 생성 헤더에는 식별용 클래스 부여 (폭 고정 및 정렬)
    if (withQR && idx === header.length) {
      th.classList.add('qr-col');
    }

    // QR 생성 열이 아닌 경우에만 정렬 기능 추가
    if (idx < header.length) {
      th.style.cursor = 'pointer';
      th.style.userSelect = 'none';
      th.onclick = () => sortTable(id, idx);

      // 현재 정렬 상태 표시 (페이지 이동/재렌더링 후에도 유지)
      const sort = getTableState(id).sort;
      const isSorted = sort && sort.col === idx;
      if (isSorted) {
        th.textContent = h + (sort.asc ? ' ↑' : ' ↓');
        th.style.background = '#dbeafe';
      }
      th.addEventListener('mouseenter', () => {
        if (!isSorted) th.style.background = '#e2e8f0';
      });
      th.addEventListener('mouseleave', () => {
        if (!isSorted) th.style.background = '#f1f5f9';
      });
    }
    headerRow.appendChild(th);
  });
  
  table.innerHTML = '';
  table.appendChild(headerRow);
  
  // 현재 페이지의 행들만 렌더링
  for (let i = startIdx; i <= endIdx; i++) {
    if (i >= rows.length) break;
    
    const tr = document.createElement('tr');
    
    // 데이터 열들 렌더링(헤더 길이까지만)
    for (let j = 0; j < header.length; j++) {
      const td = document.createElement('td');
      const cell = rows[i][j] == null ? '' : String(rows[i][j]);
      
      // 전체 내용을 툴팁으로 제공
      td.title = cell;
      
      // 긴 텍스트는 줄바꿈 허용
      if (wrapIdxSet.has(j)) td.classList.add('wrap-cell');
      
      // 안전하게 텍스트로 삽입
      td.textContent = cell;
      tr.appendChild(td);
    }
    
    // 제목 클릭 시 이력 보기
    if (withQR) {
      const titleIdx = findColIndex(header, ['제목', '도서명']);
      const codeIdx = findColIndex(header, ['코드', '코드번호']);
      const statusIdx = findColIndex(header, ['상태']); // 분실/확인불가는 '상태' 컬럼에서만 찾기
      const loanStatusIdx = findColIndex(header, ['대출여부']); // 대출 상태는 별도로 찾기
      
      // 상태에 따른 행 색상 적용
      const rowStatus = rows[i][statusIdx] || '';
      const loanStatus = rows[i][loanStatusIdx] || '';
      const statusInfo = rows[i]._statusInfo;
      
      if (statusInfo && statusInfo.className) {
        tr.classList.add(statusInfo.className);
      } else {
        // 기존 방식으로 fallback
        // 먼저 상태 컬럼에서 분실/확인불가 확인
        if (rowStatus.includes('분실/확인불가') || rowStatus.includes('분실') || rowStatus.includes('확인불가')) {
          console.log('분실/확인불가 도서 발견:', rowStatus, rows[i]);
          tr.classList.add('lost-unavailable');
        } 
        // 그 다음 대출여부 컬럼에서 연체/대출 확인
        else if (loanStatus.includes('연체')) {
          tr.classList.add('overdue');
        } else if (loanStatus.includes('대출') || loanStatus.includes('대여')) {
          tr.classList.add('borrowed');
        }
      }
      
      const tdTitle = tr.children[titleIdx];
      if (tdTitle) {
        tdTitle.style.color = '#2563eb';
        tdTitle.style.cursor = 'pointer';
        tdTitle.style.fontWeight = '500';
        tdTitle.title = '클릭하면 도서 상세정보를 확인할 수 있습니다';
        const authorIdx = findColIndex(header, ['지은이', '저자']);
        const authorText = authorIdx !== -1 ? rows[i][authorIdx] : '';
        tdTitle.onclick = () => window.showBookPreview(norm(rows[i][codeIdx]), norm(rows[i][titleIdx]), norm(authorText));
      }
      
      const tdQR = document.createElement('td');
      tdQR.className = 'qr-col';
      const code = rows[i][codeIdx];
      const author = rows[i][findColIndex(header, ['지은이', '저자'])];
      const renter = rows[i][findColIndex(header, ['대출자', '대여자'])];
      const status = rowStatus || loanStatus; // 상태 컬럼 또는 대출여부 컬럼 값
      const btn = document.createElement('button');
      btn.className = 'qr-btn';
      btn.textContent = '📷 QR';
      btn.onclick = () => window.generateQR({code, title: rows[i][titleIdx], author, renter, status});
      tdQR.appendChild(btn);

      // 대출 중/연체 도서에만 예약 버튼 표시
      const isBorrowed = (statusInfo && (statusInfo.className === 'borrowed' || statusInfo.className === 'overdue'))
        || loanStatus.includes('대출') || loanStatus.includes('대여') || loanStatus.includes('연체');
      if (isBorrowed && renter) {
        const reserveBtn = document.createElement('button');
        reserveBtn.className = 'reserve-btn';
        const bookCode = norm(rows[i][codeIdx]);
        // 예약 대기 수 뱃지
        const waitCount = (window.reservationData || []).filter(
          r => norm(r.bookCode) === bookCode && r.status === '대기'
        ).length;
        reserveBtn.innerHTML = '📅 예약' + (waitCount > 0 ? ` <span class="reserve-badge">${waitCount}</span>` : '');
        reserveBtn.style.marginLeft = '4px';
        reserveBtn.onclick = (ev) => {
          ev.stopPropagation();
          window.showReservationModal({ title: rows[i][titleIdx], bookCode, borrowerName: renter });
        };
        tdQR.appendChild(reserveBtn);
      }

      tr.appendChild(tdQR);
    }
    table.appendChild(tr);
  }
}

window.renderTable = renderTable;
window.renderTableWithPagination = renderTableWithPagination;

// 예약 뱃지만 재렌더링 (예약 후 즉시 반영용) - 검색어/정렬/페이지 유지
window.updateReservationBadges = function() {
  Object.keys(tableState).forEach(id => {
    if (tableState[id].source.length) refreshTable(id, {keepPage: true});
  });
};

/* ====== 테이블 정렬 ====== */
// 열 종류 판별: 모든 값이 날짜 → date, 모든 값이 순수 숫자 → number, 그 외 → string
function detectColType(rows, col) {
  let type = null;
  for (const row of rows) {
    const v = norm(row[col]);
    if (!v) continue;
    const isNum = /^-?\d+(\.\d+)?$/.test(v);
    const isDate = !isNaN(parseDate(v));
    const t = isDate ? 'date' : isNum ? 'number' : 'string';
    if (type === null) type = t;
    else if (type !== t) return 'string';
    if (type === 'string') return 'string';
  }
  return type || 'string';
}

function sortRows(rows, col, asc) {
  const type = detectColType(rows, col);
  const key = row => {
    const v = norm(row[col]);
    if (!v) return null;
    if (type === 'date') return parseDate(v);
    if (type === 'number') return parseFloat(v);
    return v;
  };
  const dir = asc ? 1 : -1;
  return rows
    .map((row, i) => ({row, i, k: key(row)}))
    .sort((a, b) => {
      // 빈 값은 방향과 상관없이 항상 맨 뒤
      if (a.k === null && b.k === null) return a.i - b.i;
      if (a.k === null) return 1;
      if (b.k === null) return -1;
      const r = type === 'string'
        ? a.k.localeCompare(b.k, 'ko', {numeric: true})
        : a.k - b.k;
      return r ? r * dir : a.i - b.i;
    })
    .map(x => x.row);
}

// 헤더 클릭: 같은 열이면 오름/내림 토글, 다른 열이면 오름차순부터. 검색/필터는 그대로 유지
function sortTable(tableId, colIdx) {
  const st = getTableState(tableId);
  const asc = st.sort && st.sort.col === colIdx ? !st.sort.asc : true;
  st.sort = {col: colIdx, asc};
  refreshTable(tableId);
}

window.sortTable = sortTable;

/* ====== 연체 판별 ====== */
function isOverdue(dateStr, status, loanPeriod = 30) {
  if (!dateStr || status.includes('반납')) return false;
  const t = parseDate(dateStr);
  if (isNaN(t)) return false;
  const diff = (Date.now() - t) / (1000 * 60 * 60 * 24);
  return diff > loanPeriod;
}

/* ====== 대출 상태 및 남은 일수 계산 ====== */
function calculateLoanStatus(dateStr, status, loanPeriod = 30) {
  if (!dateStr || status.includes('반납')) {
    return {status: '반납', displayText: status, className: ''};
  }

  const loanDate = new Date(parseDate(dateStr));
  if (isNaN(loanDate)) {
    return {status: status, displayText: status, className: ''};
  }

  const now = new Date();
  const diffInDays = Math.floor((now.getTime() - loanDate.getTime()) / (1000 * 60 * 60 * 24));
  const remainingDays = loanPeriod - diffInDays;
  
  if (remainingDays > 0) {
    return {
      status: '대출',
      displayText: `대출 (${remainingDays}일 남음)`,
      className: 'borrowed',
      daysRemaining: remainingDays
    };
  } else if (remainingDays === 0) {
    return {
      status: '대출',
      displayText: '대출 (오늘 반납)',
      className: 'borrowed',
      daysRemaining: 0
    };
  } else {
    const overdueDays = Math.abs(remainingDays);
    return {
      status: '연체',
      displayText: `연체 (${overdueDays}일)`,
      className: 'overdue',
      daysOverdue: overdueDays
    };
  }
}

window.isOverdue = isOverdue;
window.calculateLoanStatus = calculateLoanStatus;

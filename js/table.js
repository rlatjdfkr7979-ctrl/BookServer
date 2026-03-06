/* ========================================
   📚 도서관리 시스템 - 테이블 모듈
   ======================================== */

// 전역 변수
let currentPage = {loanTable: 1, libraryTable: 1};
let totalPages = {loanTable: 1, libraryTable: 1};
let allTableData = {loanTable: [], libraryTable: []};
let sortState = {}; // 각 테이블의 정렬 상태 저장

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
function renderTable(rows, id, withQR = false) {
  // 전체 데이터 저장
  allTableData[id] = [...rows];
  renderTableWithPagination(rows, id, withQR);
  
  // 페이지네이션 생성
  const paginationId = id === 'loanTable' ? 'loanPagination' : 'libraryPagination';
  createPagination(id, paginationId, rows.length - 1); // 헤더 제외
}

function renderTableWithPagination(rows, id, withQR = false) {
  const header = rows[0];
  const table = document.getElementById(id);
  const finalHeader = withQR ? [...header, 'QR 생성'] : header;
  
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
      th.onclick = () => sortTable(rows, id, idx, withQR);
      
      // 정렬 표시를 위한 스타일
      th.addEventListener('mouseenter', () => {
        if (!th.textContent.includes('↑') && !th.textContent.includes('↓')) {
          th.style.background = '#e2e8f0';
        }
      });
      th.addEventListener('mouseleave', () => {
        if (!th.textContent.includes('↑') && !th.textContent.includes('↓')) {
          th.style.background = '#f1f5f9';
        }
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
        reserveBtn.textContent = '📅 예약';
        reserveBtn.style.marginLeft = '4px';
        reserveBtn.onclick = (ev) => {
          ev.stopPropagation();
          window.showReservationModal({ title: rows[i][titleIdx], borrowerName: renter });
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

/* ====== 테이블 정렬 ====== */
function sortTable(originalRows, tableId, colIdx, withQR = false) {
  const header = originalRows[0];
  
  // 정렬 상태 확인 (기본: 오름차순)
  const sortKey = `${tableId}_${colIdx}`;
  const isAsc = !sortState[sortKey]; // 현재 상태의 반대로 설정
  sortState[sortKey] = isAsc;
  
  // 전체 데이터를 정렬 (헤더 제외)
  const dataRows = allTableData[tableId].slice(1);
  dataRows.sort((a, b) => {
    const aVal = a[colIdx] || '';
    const bVal = b[colIdx] || '';
    
    // 숫자인지 확인
    const aNum = parseFloat(String(aVal).replace(/[^\d.-]/g, ''));
    const bNum = parseFloat(String(bVal).replace(/[^\d.-]/g, ''));
    
    let result;
    if (!isNaN(aNum) && !isNaN(bNum)) {
      result = aNum - bNum; // 숫자 정렬
    } else {
      result = String(aVal).localeCompare(String(bVal), 'ko', {numeric: true}); // 문자열 정렬
    }
    
    return isAsc ? result : -result;
  });
  
  // 정렬된 데이터로 테이블 업데이트
  const sortedData = [header, ...dataRows];
  allTableData[tableId] = sortedData;
  
  // 첫 페이지로 이동하고 재렌더링
  currentPage[tableId] = 1;
  renderTableWithPagination(sortedData, tableId, withQR);
  
  // 페이지네이션 업데이트
  const paginationId = tableId === 'loanTable' ? 'loanPagination' : 'libraryPagination';
  createPagination(tableId, paginationId, sortedData.length - 1);
  
  // 헤더에 정렬 표시 추가
  const table = document.getElementById(tableId);
  table.querySelectorAll('th').forEach(th => {
    th.textContent = th.textContent.replace(/\s*[↑↓]\s*/, '');
    th.style.background = '#f1f5f9';
  });
  
  const currentTh = table.querySelectorAll('th')[colIdx];
  currentTh.textContent += isAsc ? ' ↑' : ' ↓';
  currentTh.style.background = '#dbeafe';
  
  // 정렬 후 행 색상 다시 적용 (도서목록의 경우)
  if (withQR) {
    const statusIdx = findColIndex(header, ['상태', '대출여부']);
    
    const currentData = allTableData[tableId];
    for (let i = 1; i < currentData.length; i++) {
      const status = currentData[i][statusIdx] || '';
      const loanDate = currentData[i][findColIndex(header, ['대출일', '등록일'])] || '';
      
      // 연체 확인
      const statusInfo = window.calculateLoanStatus(loanDate, status);
      currentData[i]._statusInfo = statusInfo;
    }
    
    // 재렌더링
    renderTableWithPagination(currentData, tableId, withQR);
  }
}

window.sortTable = sortTable;

/* ====== 연체 판별 ====== */
function isOverdue(dateStr, status) {
  if (!dateStr || status.includes('반납')) return false;
  const d = new Date(dateStr);
  if (isNaN(d)) return false;
  const diff = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
  return diff > 14;
}

/* ====== 대출 상태 및 남은 일수 계산 ====== */
function calculateLoanStatus(dateStr, status) {
  if (!dateStr || status.includes('반납')) {
    return {status: '반납', displayText: status, className: ''};
  }
  
  const loanDate = new Date(dateStr);
  if (isNaN(loanDate)) {
    return {status: status, displayText: status, className: ''};
  }
  
  const now = new Date();
  const diffInDays = Math.floor((now.getTime() - loanDate.getTime()) / (1000 * 60 * 60 * 24));
  const loanPeriod = 14; // 대출 기간 14일
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

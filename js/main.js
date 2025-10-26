/* ========================================
   📚 도서관리 시스템 - 메인 스크립트
   ======================================== */

// 전역 변수
window.booksData = [];
window.libraryData = [];
window.unreturned = [];
let borrowedOn = false;
let newestOn = false;
let recentOn = false;
let originalLibraryData = [];

/* ====== Dooray 버튼 상태 업데이트 ====== */
function updateDoorayButtonStatus() {
  const btn = document.getElementById('btnDooraySync');
  const hasConfig = window.DOORAY_CONFIG.wikiId && window.DOORAY_CONFIG.pageId && localStorage.getItem('gas_backend_url');
  
  if (hasConfig) {
    btn.innerHTML = '✅ Dooray 연동 완료';
    btn.style.background = '#10b981';
    btn.title = 'Dooray 연동이 활성화되어 자동 알림이 작동합니다';
  } else {
    btn.innerHTML = '🔄 Dooray 연동';
    btn.style.background = '#7c3aed';
    btn.title = 'Dooray API 설정이 필요합니다';
  }
}

/* ====== 메인 초기화 ====== */
Promise.all([loadCSV('books.csv'), loadCSV('library.csv')]).then(([books, library]) => {
  window.booksData = books;
  window.libraryData = library;
  renderTable(books, 'loanTable');
  
  updateDoorayButtonStatus();

  const bh = books[0].map(norm);
  const bDateIdx = findColIndex(bh, ['등록일', '대출일', '일자']);
  const bCodeIdx = findColIndex(bh, ['코드', '코드번호']);
  const bStatusIdx = findColIndex(bh, ['상태', '대출여부']);
  const bUserIdx = findColIndex(bh, ['대여자', '대출자']);
  const latestByCode = {};

  for (let i = 1; i < books.length; i++) {
    const date = norm(books[i][bDateIdx]);
    const code = norm(books[i][bCodeIdx]);
    const status = norm(books[i][bStatusIdx]);
    const borrower = norm(books[i][bUserIdx]);
    if (!code) continue;
    if (!latestByCode[code]) latestByCode[code] = {status: '', borrower: '', lastReturn: ''};
    if (status.includes('반납')) latestByCode[code].lastReturn = date;
    latestByCode[code].status = status;
    latestByCode[code].borrower = borrower;
  }

  const lh = library[0].map(norm);
  const lCodeIdx = findColIndex(lh, ['코드', '코드번호']);
  let lStatusIdx = findColIndex(lh, ['상태', '대출여부']);
  let lUserIdx = findColIndex(lh, ['대여자', '대출자']);
  if (lStatusIdx === -1) {library[0].push('대출여부'); lStatusIdx = library[0].length - 1;}
  if (lUserIdx === -1) {library[0].push('대출자'); lUserIdx = library[0].length - 1;}

  for (let i = 1; i < library.length; i++) {
    const code = norm(library[i][lCodeIdx]);
    const rec = latestByCode[code];
    if (!rec) {
      library[i][lStatusIdx] = '';
      library[i][lUserIdx] = '';
      continue;
    }
    if (rec.status.includes('반납')) {
      library[i][lStatusIdx] = '반납';
      library[i][lUserIdx] = '';
    } else {
      library[i][lUserIdx] = rec.borrower || '';
      const loanRow = books.find(b => norm(b[bCodeIdx]) === code && !b[bStatusIdx].includes('반납'));
      const loanDate = loanRow ? loanRow[bDateIdx] : '';
      const loanStatus = calculateLoanStatus(loanDate, rec.status);
      library[i][lStatusIdx] = loanStatus.displayText;
      library[i]._statusInfo = loanStatus;
    }
  }

  originalLibraryData = [...library];
  renderTable(library, 'libraryTable', true);
  addSearch('searchLoans', 'loanTable');
  addSearch('searchLibrary', 'libraryTable');
});

/* ====== 필터 함수 ====== */
function applyAllFilters() {
  const isLoanView = !document.getElementById('loanSection').classList.contains('hidden');
  const targetTableId = isLoanView ? 'loanTable' : 'libraryTable';
  const sourceData = isLoanView ? window.booksData : originalLibraryData;
  
  let dataToFilter = [...sourceData];
  
  // 최신 순 정렬 적용
  if (newestOn) {
    dataToFilter = [dataToFilter[0], ...dataToFilter.slice(1).reverse()];
  }
  
  // 필터링 적용
  const header = dataToFilter[0];
  const statusIdx = findColIndex(header, ['상태', '대출여부']);
  const dateIdx = findColIndex(header, ['등록일', '일자', '날짜', '입고일', '구입일', '대출일']);
  const filteredData = [dataToFilter[0]]; // 헤더 보존
  
  for (let i = 1; i < dataToFilter.length; i++) {
    const row = dataToFilter[i];
    let shouldShow = true;
    
    // 대출 중 필터 적용
    if (borrowedOn) {
      const status = row[statusIdx] || '';
      const statusInfo = row._statusInfo;
      const isBorrowed = statusInfo ? 
        (statusInfo.status === '대출' || statusInfo.status === '연체') :
        /(대출|대여|연체)/.test(status);
      if (!isBorrowed) shouldShow = false;
    }
    
    // 30일 필터 적용
    if (recentOn && dateIdx !== -1) {
      const dateText = row[dateIdx] || '';
      const bookDate = new Date(dateText);
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30*24*60*60*1000);
      const isRecent = !isNaN(bookDate) && bookDate >= thirtyDaysAgo;
      if (!isRecent) shouldShow = false;
    }
    
    if (shouldShow) filteredData.push(row);
  }
  
  // 필터된 데이터로 테이블 재렌더링
  currentPage[targetTableId] = 1;
  renderTable(filteredData, targetTableId, !isLoanView);
  
  // 검색 기능 다시 바인딩
  if (isLoanView) {
    addSearch('searchLoans', 'loanTable');
  } else {
    addSearch('searchLibrary', 'libraryTable');
  }
}

/* ====== 버튼 이벤트 핸들러 ====== */
document.getElementById('btnLoans').onclick = () => {
  document.getElementById('librarySection').classList.add('hidden');
  document.getElementById('loanSection').classList.remove('hidden');
  document.getElementById('btnLoans').classList.add('active');
  document.getElementById('btnLibrary').classList.remove('active');
  
  // 필터 재적용 (대출현황에서도 필터 작동)
  applyAllFilters();
  window.scrollTo(0, 0);
};

document.getElementById('btnLibrary').onclick = () => {
  document.getElementById('loanSection').classList.add('hidden');
  document.getElementById('librarySection').classList.remove('hidden');
  document.getElementById('btnLibrary').classList.add('active');
  document.getElementById('btnLoans').classList.remove('active');
  
  // 필터 재적용 (이전 상태 유지)
  applyAllFilters();
  window.scrollTo(0, 0);
};

document.getElementById('btnBorrowed').onclick = () => {
  // 대출 현황 화면에서 클릭한 경우 전체 도서목록으로 자동 전환
  if (!document.getElementById('librarySection').classList.contains('hidden') === false) {
    document.getElementById('librarySection').classList.remove('hidden');
    document.getElementById('loanSection').classList.add('hidden');
    document.getElementById('btnLibrary').classList.add('active');
    document.getElementById('btnLoans').classList.remove('active');
  }
  
  borrowedOn = !borrowedOn;
  document.getElementById('btnBorrowed').classList.toggle('active', borrowedOn);
  
  // 모든 필터 재적용
  applyAllFilters();
  
  // 페이지와 테이블 스크롤을 맨 위로 이동
  window.scrollTo(0, 0);
  const tableWrap = document.querySelector('#librarySection .table-wrap');
  if (tableWrap) tableWrap.scrollTop = 0;
};

document.getElementById('btnNewest').onclick = () => {
  newestOn = !newestOn;
  document.getElementById('btnNewest').classList.toggle('active', newestOn);
  
  // 버튼 텍스트 변경
  if (newestOn) {
    document.getElementById('btnNewest').innerHTML = '📉 오래된 순으로 보기';
  } else {
    document.getElementById('btnNewest').innerHTML = '📈 최신 도서 순으로 보기';
  }
  
  // 모든 필터 재적용
  applyAllFilters();
  
  // 페이지와 테이블 스크롤을 맨 위로 이동
  window.scrollTo(0, 0);
  const isLoanView = !document.getElementById('loanSection').classList.contains('hidden');
  const tableWrap = document.querySelector(isLoanView ? '#loanSection .table-wrap' : '#librarySection .table-wrap');
  if (tableWrap) tableWrap.scrollTop = 0;
};

document.getElementById('btnRecent').onclick = () => {
  // 등록일 컬럼이 있는지 확인
  const header = originalLibraryData[0];
  const dateIdx = findColIndex(header, ['등록일', '일자', '날짜', '입고일', '구입일']);
  
  if (dateIdx === -1) {
    alert('📅 등록일 정보가 없어서 최근 30일 필터를 사용할 수 없습니다.\n\nCSV 파일에 "등록일", "일자", "날짜" 등의 컬럼을 추가해주세요.');
    return;
  }
  
  // 대출 현황 화면에서 클릭한 경우 전체 도서목록으로 자동 전환
  if (!document.getElementById('librarySection').classList.contains('hidden') === false) {
    document.getElementById('librarySection').classList.remove('hidden');
    document.getElementById('loanSection').classList.add('hidden');
    document.getElementById('btnLibrary').classList.add('active');
    document.getElementById('btnLoans').classList.remove('active');
  }
  
  recentOn = !recentOn;
  document.getElementById('btnRecent').classList.toggle('active', recentOn);
  
  // 모든 필터 재적용
  applyAllFilters();
  
  // 페이지와 테이블 스크롤을 맨 위로 이동
  window.scrollTo(0, 0);
  const tableWrap = document.querySelector('#librarySection .table-wrap');
  if (tableWrap) tableWrap.scrollTop = 0;
};

document.getElementById('btnAddBook').onclick = () => {
  window.open(FORM_URL, '_blank');
};

document.getElementById('btnDooraySync').onclick = () => {
  showDoorayModal();
};

/* ====== Dooray 모달 ====== */
function showDoorayModal() {
  const modal = document.getElementById('doorayModal');
  modal.style.display = 'flex';
  
  document.getElementById('gasBackendUrl').value = localStorage.getItem('gas_backend_url') || '';
  document.getElementById('wikiId').value = localStorage.getItem('dooray_wiki_id') || '';
  document.getElementById('pageId').value = localStorage.getItem('dooray_page_id') || '';
}

function closeDoorayModal() {
  const modal = document.getElementById('doorayModal');
  modal.style.display = 'none';
}

async function testDoorayConnection() {
  const resultDiv = document.getElementById('testResult');
  resultDiv.style.display = 'block';
  resultDiv.innerHTML = '<div style="background:#fef3c7;color:#92400e;padding:12px;border-radius:6px;">🔄 연결 테스트 중...</div>';
  
  const result = await window.doorayIntegration.testConnection();
  
  if (result.success) {
    resultDiv.innerHTML = `<div style="background:#d1fae5;color:#047857;padding:12px;border-radius:6px;">
      ✅ ${result.message}<br>
      <small>Wiki ID: ${result.data?.wikiId || 'N/A'}<br>
      페이지 제목: ${result.data?.pageTitle || 'N/A'}</small>
    </div>`;
  } else {
    resultDiv.innerHTML = `<div style="background:#fee2e2;color:#dc2626;padding:12px;border-radius:6px;">
      ❌ ${result.message}
    </div>`;
  }
}

async function syncLibraryToWiki() {
  if (!window.libraryData || window.libraryData.length === 0) {
    showToast('⚠️ 먼저 도서 목록을 로드해주세요.');
    return;
  }

  showToast('📤 Wiki 업데이트 중...');
  
  const libraryData = window.libraryData;
  const header = libraryData[0];
  const statusIdx = findColIndex(header, ['상태', '대출여부']);
  
  const unreturned = [];
  for (let i = 1; i < libraryData.length; i++) {
    const status = libraryData[i][statusIdx] || '';
    if (status.includes('대출') || status.includes('연체')) {
      const titleIdx = findColIndex(header, ['제목', '도서명']);
      const borrowerIdx = findColIndex(header, ['대출자', '대여자']);
      unreturned.push({
        title: libraryData[i][titleIdx],
        borrower: libraryData[i][borrowerIdx],
        status: status
      });
    }
  }
  
  window.unreturned = unreturned;
  
  // 콘텐츠 생성
  const lines = [];
  lines.push('# 📚 도서관리 현황');
  lines.push('');
  lines.push(`**업데이트:** ${new Date().toLocaleString('ko-KR')}`);
  lines.push('');
  lines.push('## 통계');
  lines.push(`- **전체 도서**: ${libraryData.length - 1}권`);
  lines.push(`- **미반납 도서**: ${unreturned.length}권`);
  lines.push(`- **반납률**: ${((libraryData.length - 1 - unreturned.length) / (libraryData.length - 1) * 100).toFixed(1)}%`);
  lines.push('');
  lines.push('## 상태');
  if (unreturned.length === 0) {
    lines.push('✅ 모든 도서가 반납되었습니다!');
  } else {
    lines.push(`⚠️ ${unreturned.length}권의 도서가 미반납 상태입니다.`);
    lines.push('');
    lines.push('### 미반납 도서');
    lines.push('| 제목 | 대출자 | 상태 |');
    lines.push('|------|--------|------|');
    unreturned.forEach(book => {
      lines.push(`| ${book.title} | ${book.borrower} | ${book.status} |`);
    });
  }
  lines.push('');
  lines.push('---');
  lines.push('*자동 생성 보고서*');
  
  const finalContent = lines.join('\n');
  
  console.log('🔄 Wiki 업데이트 시작:', {
    gasUrl: localStorage.getItem('gas_backend_url'),
    contentLength: finalContent.length
  });
  
  const gasUrl = localStorage.getItem('gas_backend_url');
  if (!gasUrl) {
    showToast('❌ Google Apps Script 백엔드 URL이 설정되지 않았습니다.');
    return;
  }
  
  const requestData = {
    action: 'updateWiki',
    content: finalContent,
    callback: 'jsonp_callback_' + Date.now()
  };
  
  try {
    const response = await fetch(gasUrl, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(requestData)
    });
    
    const result = await response.json();
    console.log('✅ POST 응답:', result);
    
    if (result.success) {
      showToast('✅ Wiki 업데이트 완료!');
    } else {
      showToast('❌ Wiki 업데이트 실패: ' + (result.message || '알 수 없는 오류'));
    }
  } catch (fetchError) {
    console.error('⚠️ Fetch 실패:', fetchError.message);
    showToast('❌ 연결 오류: ' + fetchError.message);
  }
}

async function saveDoorayConfig() {
  const gasUrl = document.getElementById('gasBackendUrl').value.trim();
  const wikiId = document.getElementById('wikiId').value.trim();
  const pageId = document.getElementById('pageId').value.trim();
  
  if (!gasUrl) {
    showToast('⚠️ Google Apps Script URL을 입력해주세요.');
    return;
  }
  
  localStorage.setItem('gas_backend_url', gasUrl);
  localStorage.setItem('dooray_wiki_id', wikiId);
  localStorage.setItem('dooray_page_id', pageId);
  
  window.DOORAY_CONFIG.backendUrl = gasUrl;
  window.DOORAY_CONFIG.wikiId = wikiId;
  window.DOORAY_CONFIG.pageId = pageId;
  
  window.doorayIntegration = new DoorayIntegration();
  updateDoorayButtonStatus();
  
  showToast('✅ 설정이 저장되었습니다!');
  
  setTimeout(async () => {
    const result = await testDoorayConnection();
  }, 500);
}

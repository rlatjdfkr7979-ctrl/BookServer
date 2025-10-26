/* ========================================
   📚 도서관리 시스템 - UI 모듈
   ======================================== */

/* ====== QR 생성 ====== */
function generateQR({code, title, author, renter, status}) {
  // 상태에 따른 라디오박스 선택 로직 개선
  let statusEncoded = "";
  if (status.includes('반납')) {
    statusEncoded = "%EB%B0%98%EB%82%A9"; // 반납
  } else if (status.includes('대출') || status.includes('대여') || status.includes('연체')) {
    statusEncoded = "%EB%8C%80%EC%B6%9C"; // 대출 (연체 포함)
  }
  
  const url = `${FORM_URL}?usp=pp_url&${ENTRY_IDS.code}=${encodeURIComponent(code)}&${ENTRY_IDS.title}=${encodeURIComponent(title)}&${ENTRY_IDS.author}=${encodeURIComponent(author)}&${ENTRY_IDS.renter}=${encodeURIComponent(renter)}&${ENTRY_IDS.status}=${statusEncoded}`;
  const layer = document.createElement('div');
  layer.style = `position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:1002;`;
  layer.innerHTML = `<div style="background:#fff;padding:18px 22px;border-radius:10px;text-align:center;max-width:420px;box-shadow:0 10px 25px rgba(0,0,0,.25)"><h3 style="margin:6px 0 12px">📷 QR 코드 (${code})</h3><div id="qrbox" style="margin:0 auto 10px;width:220px;height:220px"></div><p style="word-break:break-all;font-size:12px;"><a href="${url}" target="_blank">${url}</a></p><div style="margin-top:10px"><button id="qrClose" style="background:#475569;color:#fff;border:none;border-radius:6px;padding:6px 10px;margin-right:6px">닫기</button><button id="qrDown"  style="background:#2563eb;color:#fff;border:none;border-radius:6px;padding:6px 10px">QR 다운로드</button></div></div>`;
  document.body.appendChild(layer);
  new QRCode(layer.querySelector('#qrbox'), {text: url, width: 220, height: 220, colorDark: "#000", colorLight: "#fff", correctLevel: QRCode.CorrectLevel.H});
  
  const innerBox = layer.firstElementChild;
  const closeLayer = () => { layer.remove(); document.removeEventListener('keydown', escHandler); };
  
  // 닫기 버튼
  layer.querySelector('#qrClose').onclick = closeLayer;
  
  // 배경 클릭 시 닫기
  layer.addEventListener('click', (e) => { if (e.target === layer) closeLayer(); });
  
  // 내부 클릭은 버블링 막기
  if (innerBox) innerBox.addEventListener('click', (e) => e.stopPropagation());
  
  // ESC로 닫기
  const escHandler = (e) => { if (e.key === 'Escape') closeLayer(); };
  document.addEventListener('keydown', escHandler);
  
  layer.querySelector('#qrDown').onclick = () => {
    const img = layer.querySelector('#qrbox img');
    const a = document.createElement('a');
    a.href = img.src;
    a.download = `${code}.png`;
    a.click();
  };
}

/* ====== 토스트 알림 ====== */
function showToast(message, duration = 3000) {
  // 기존 토스트가 있으면 제거
  const existingToast = document.getElementById('toast-notification');
  if (existingToast) existingToast.remove();
  
  // 토스트 생성
  const toast = document.createElement('div');
  toast.id = 'toast-notification';
  toast.style = `
    position: fixed;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%);
    background: #1f2937;
    color: #fff;
    padding: 12px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, .1);
    z-index: 10000;
    font-size: 14px;
    animation: slideIn 0.3s ease-out;
  `;
  
  // 애니메이션 CSS 추가
  if (!document.getElementById('toast-style')) {
    const style = document.createElement('style');
    style.id = 'toast-style';
    style.textContent = `
      @keyframes slideIn {
        from {
          bottom: 0;
          opacity: 0;
        }
        to {
          bottom: 30px;
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // 자동 제거
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease-out reverse';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* ====== 검색 ====== */
function addSearch(inputId, tableId) {
  const input = document.getElementById(inputId);
  let timer;
  input.addEventListener('input', e => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const q = e.target.value.toLowerCase();
      const originalData = window.allTableData[tableId];
      
      if (!q) {
        window.renderTable(originalData, tableId, tableId === 'libraryTable');
      } else {
        const header = originalData[0];
        const filtered = originalData.filter((row, idx) => {
          if (idx === 0) return true; // 헤더 포함
          return row.some(cell => String(cell).toLowerCase().includes(q));
        });
        
        // 필터된 데이터를 저장하고 재렌더링
        const withQR = tableId === 'libraryTable';
        window.allTableData[tableId] = filtered;
        window.currentPage[tableId] = 1;
        window.renderTableWithPagination(filtered, tableId, withQR);
        
        // 페이지네이션 업데이트
        const paginationId = tableId === 'loanTable' ? 'loanPagination' : 'libraryPagination';
        window.createPagination(tableId, paginationId, filtered.length - 1);
      }
    }, 150);
  });
}

/* ====== 도서 미리보기 모달 ====== */
async function showBookPreview(code, title, author = '') {
  const modal = document.getElementById('bookPreviewModal');
  const previewContent = document.getElementById('bookPreviewContent');
  const historyContent = document.getElementById('bookHistoryContent');
  
  modal.style.display = 'flex';
  switchTab('preview');
  previewContent.innerHTML = '<div class="loading">📚 도서 정보를 불러오는 중...</div>';
  
  try {
    const searchQuery = encodeURIComponent(`${title} ${author}`.trim());
    const apiUrl = `https://www.googleapis.com/books/v1/volumes?q=${searchQuery}&maxResults=5&langRestrict=ko`;
    
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      const bestMatch = findBestBookMatch(data.items, title);
      renderBookInfo(bestMatch, previewContent);
    } else {
      renderBasicBookInfo(title, author, code, previewContent);
    }
    
    renderBookHistory(code, title, historyContent);
    
  } catch (error) {
    console.error('도서 정보 로드 실패:', error);
    renderBasicBookInfo(title, author, code, previewContent);
    renderBookHistory(code, title, historyContent);
  }
  
  modal.onclick = (e) => {
    if (e.target === modal) closeBookPreview();
  };
  
  modal.querySelector('.inner').onclick = (e) => e.stopPropagation();
}

function findBestBookMatch(items, targetTitle) {
  let bestMatch = items[0];
  let bestScore = 0;
  
  for (const item of items) {
    const bookTitle = item.volumeInfo.title || '';
    const score = calculateSimilarity(targetTitle.toLowerCase(), bookTitle.toLowerCase());
    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }
  
  return bestMatch;
}

function calculateSimilarity(str1, str2) {
  const words1 = str1.split(/\s+/);
  const words2 = str2.split(/\s+/);
  let commonWords = 0;
  
  for (const word of words1) {
    if (word.length > 1 && words2.some(w => w.includes(word) || word.includes(w))) {
      commonWords++;
    }
  }
  
  return commonWords / Math.max(words1.length, words2.length);
}

function renderBookInfo(bookData, container) {
  const info = bookData.volumeInfo;
  const title = info.title || '제목 없음';
  const authors = info.authors ? info.authors.join(', ') : '저자 미상';
  const publisher = info.publisher || '출판사 미상';
  const publishedDate = info.publishedDate || '출간일 미상';
  const description = info.description || '설명이 없습니다.';
  const thumbnail = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || '';
  const pageCount = info.pageCount || '-';
  const categories = info.categories ? info.categories.join(', ') : '-';
  const language = info.language === 'ko' ? '한국어' : info.language || '-';
  const rating = info.averageRating || 0;
  const ratingsCount = info.ratingsCount || 0;
  
  container.innerHTML = `
    <div class="book-header">
      <div class="book-cover">
        ${thumbnail ? `<img src="${thumbnail.replace('http:', 'https:')}" alt="책 표지">` : '<div style="width:120px;height:160px;background:#f3f4f6;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:12px;">표지 없음</div>'}
      </div>
      <div class="book-info">
        <h2 class="book-title">${title}</h2>
        <p class="book-author">👤 ${authors}</p>
        <p class="book-publisher">🏢 ${publisher}</p>
        ${rating > 0 ? `
          <div class="book-rating">
            <span class="stars">${'★'.repeat(Math.floor(rating))}${'☆'.repeat(5 - Math.floor(rating))}</span>
            <span style="color:#6b7280;font-size:13px;">${rating}/5.0 (${ratingsCount}명)</span>
          </div>
        ` : ''}
      </div>
    </div>
    <div class="book-meta">
      <div class="meta-item"><span class="meta-label">📅 출간일</span><span class="meta-value">${publishedDate}</span></div>
      <div class="meta-item"><span class="meta-label">📄 페이지</span><span class="meta-value">${pageCount}페이지</span></div>
      <div class="meta-item"><span class="meta-label">🏷️ 분야</span><span class="meta-value">${categories}</span></div>
      <div class="meta-item"><span class="meta-label">🌐 언어</span><span class="meta-value">${language}</span></div>
    </div>
    <div class="book-description">
      <strong>📝 도서 소개</strong><br><br>
      ${description.length > 500 ? description.substring(0, 500) + '...' : description}
    </div>
  `;
}

function renderBasicBookInfo(title, author, code, container) {
  container.innerHTML = `
    <div class="book-header">
      <div class="book-cover">
        <div style="width:120px;height:160px;background:#f3f4f6;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:12px;">표지 없음</div>
      </div>
      <div class="book-info">
        <h2 class="book-title">${title}</h2>
        ${author ? `<p class="book-author">👤 ${author}</p>` : ''}
        <p style="color:#6b7280;font-size:14px;">📚 코드: ${code}</p>
      </div>
    </div>
    <div class="book-description" style="text-align:center;color:#6b7280;padding:40px;">
      상세한 도서 정보를 찾을 수 없습니다.<br>
      도서관 내부 정보만 표시됩니다.
    </div>
  `;
}

function renderBookHistory(code, title, container) {
  const recs = window.booksData.filter(r => window.norm(r[1]) === code);
  
  if (recs.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:#6b7280;">대출 이력이 없습니다.</div>';
  } else {
    container.innerHTML = `
      <h4 style="margin:0 0 16px 0;color:#1f2937;">📋 대출 이력 (총 ${recs.length}건)</h4>
      <table style="width:100%;border-collapse:collapse;">
        <tr style="background:#f8fafc;">
          <th style="padding:12px;border:1px solid #e2e8f0;text-align:left;font-weight:600;">등록일</th>
          <th style="padding:12px;border:1px solid #e2e8f0;text-align:left;font-weight:600;">대여자</th>
          <th style="padding:12px;border:1px solid #e2e8f0;text-align:left;font-weight:600;">상태</th>
        </tr>
        ${recs.map(r => {
          const loanStatus = window.calculateLoanStatus(r[0], r[5]);
          const displayStatus = loanStatus.displayText || r[5];
          const bgColor = loanStatus.status === '연체' ? 'background:#fee2e2;color:#dc2626;' :
                         loanStatus.status === '대출' ? 'background:#fef3c7;color:#92400e;' :
                         'background:#d1fae5;color:#047857;';
          
          return `
            <tr>
              <td style="padding:10px 12px;border:1px solid #e2e8f0;">${r[0]}</td>
              <td style="padding:10px 12px;border:1px solid #e2e8f0;">${r[4]}</td>
              <td style="padding:10px 12px;border:1px solid #e2e8f0;">
                <span style="padding:2px 8px;border-radius:12px;font-size:12px;font-weight:500;${bgColor}">
                  ${displayStatus}
                </span>
              </td>
            </tr>
          `;
        }).join('')}
      </table>
    `;
  }
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  if (tabName === 'preview') {
    document.querySelectorAll('.tab-button')[0].classList.add('active');
    document.getElementById('previewTab').classList.add('active');
  } else {
    document.querySelectorAll('.tab-button')[1].classList.add('active');
    document.getElementById('historyTab').classList.add('active');
  }
}

function closeBookPreview() {
  const modal = document.getElementById('bookPreviewModal');
  modal.style.display = 'none';
  modal.onclick = null;
}

/* ====== 기존 도서 이력 팝업 (호환성 유지) ====== */
function showHistory(code, title) {
  const modal = document.getElementById('historyModal');
  const histTitle = document.getElementById('histTitle');
  const histContent = document.getElementById('histContent');
  histTitle.textContent = `📖 ${title} (${code})`;
  const recs = window.booksData.filter(r => window.norm(r[1]) === code);
  if (recs.length === 0) {
    histContent.innerHTML = '<p>이력 없음</p>';
  } else {
    histContent.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:13px"><tr><th>등록일</th><th>대여자</th><th>상태</th></tr>' + recs.map(r => `<tr><td>${r[0]}</td><td>${r[4]}</td><td>${r[5]}</td></tr>`).join('') + '</table>';
  }
  modal.style.display = 'flex';
  
  modal.onclick = (e) => {
    if (e.target === modal) {
      closeHistory();
    }
  };
  
  modal.querySelector('.inner').onclick = (e) => {
    e.stopPropagation();
  };
}

function closeHistory() {
  const modal = document.getElementById('historyModal');
  modal.style.display = 'none';
  modal.onclick = null;
}

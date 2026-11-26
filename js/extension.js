/* ========================================
   ⏩ 대출 연장 모달
   - 연장 1회 = 대출 기간(30일, 전공·자격증·어학 90일)만큼 반납 기한 연장
   - 서버(GAS extendLoan)가 대출자 이름 / 연체 / 예약 대기 / 횟수를 다시 검사하고 books.csv에 '연장' 행을 추가
   ======================================== */

window.showExtensionModal = function({ title, author, bookCode, borrowerName }) {
  const modal = document.getElementById('extensionModal');
  document.getElementById('extensionBookTitle').textContent = '도서명: ' + title;
  document.getElementById('extensionNameInput').value = '';
  modal._current = { title, author, bookCode, borrowerName };
  modal.style.display = 'flex';
  setTimeout(() => document.getElementById('extensionNameInput').focus(), 100);
};

// 연장 직후 화면에 바로 반영: books 데이터에 '연장' 행을 추가하고 상태를 다시 계산
// (GitHub Pages에 새 CSV가 반영되기까지 1~2분 걸리므로 낙관적 갱신)
function applyExtensionLocally({ title, author, bookCode, borrowerName }, when) {
  const header = window.booksData[0];
  const row = new Array(header.length).fill('');
  const put = (names, value) => {
    const idx = findColIndex(header, names);
    if (idx !== -1) row[idx] = value;
  };
  put(['등록일', '대출일', '일자'], when);
  put(['코드'], bookCode);
  put(['도서명', '제목'], title);
  put(['저자'], author || '');
  put(['대여자', '대출자'], borrowerName);
  put(['상태'], '연장');
  window.booksData.push(row);
  window.applyLoanStatus();
  window.updateReservationBadges(); // 두 테이블 모두 현재 페이지/검색/정렬 유지한 채 다시 그림
}

document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('extensionModal');
  const close = () => { modal.style.display = 'none'; };

  document.getElementById('cancelExtensionBtn').onclick = close;
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  document.getElementById('extensionNameInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('confirmExtensionBtn').click();
  });

  document.getElementById('confirmExtensionBtn').onclick = async () => {
    const name = document.getElementById('extensionNameInput').value.trim();
    if (!name) { showToast('⚠️ 대출자 이름을 입력해주세요.'); return; }

    const gasUrl = localStorage.getItem('gas_backend_url');
    if (!gasUrl) { showToast('⚠️ GAS URL이 설정되지 않았습니다.'); return; }

    const cur = modal._current;
    const btn = document.getElementById('confirmExtensionBtn');
    btn.disabled = true;
    btn.textContent = '처리 중...';
    try {
      const result = await gasJsonp(gasUrl, { action: 'extendLoan', bookCode: cur.bookCode, borrowerName: name }, 30000);
      if (result && result.success) {
        close();
        applyExtensionLocally({ ...cur, borrowerName: name }, result.date);
        showToast(`✅ 대출이 연장되었습니다. 새 반납 예정일: ${result.dueDate}`, 5000);
      } else {
        showToast('❌ 연장 실패: ' + (result && result.error ? result.error : '알 수 없는 오류'), 5000);
      }
    } catch (err) {
      showToast('❌ 오류: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '대출 연장';
    }
  };
});

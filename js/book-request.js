/* ========================================
   📚 도서관리 시스템 - 신규 도서 신청 모듈
   ======================================== */

function showBookRequestModal() {
  const modal = document.getElementById('bookRequestModal');
  document.getElementById('reqTitle').value = '';
  document.getElementById('reqAuthor').value = '';
  document.getElementById('reqRequester').value = '';
  document.getElementById('reqReason').value = '';
  modal.style.display = 'flex';
  document.getElementById('reqTitle').focus();
}

function closeBookRequestModal() {
  document.getElementById('bookRequestModal').style.display = 'none';
}

async function submitBookRequest() {
  const title = document.getElementById('reqTitle').value.trim();
  const author = document.getElementById('reqAuthor').value.trim();
  const requester = document.getElementById('reqRequester').value.trim();
  const reason = document.getElementById('reqReason').value.trim();

  if (!title) { showToast('⚠️ 도서 제목을 입력해주세요.'); return; }
  if (!requester) { showToast('⚠️ 신청자 이름을 입력해주세요.'); return; }

  const btn = document.getElementById('confirmBookRequest');
  btn.disabled = true;
  btn.textContent = '신청 중...';

  const gasUrl = localStorage.getItem('gas_backend_url');
  if (!gasUrl) {
    showToast('⚠️ GAS 백엔드 URL이 설정되지 않았습니다. Dooray 연동 설정을 확인해주세요.');
    btn.disabled = false;
    btn.textContent = '신청하기';
    return;
  }

  try {
    const result = await gasJsonp(gasUrl, {
      action: 'saveBookRequest',
      bookTitle: title,
      author: author,
      reason: reason,
      requesterName: requester
    });

    if (result && result.success) {
      showToast(`✅ "${title}" 도서 신청이 완료되었습니다!`);
      closeBookRequestModal();
    } else {
      showToast('❌ 신청 실패: ' + (result && result.error ? result.error : '알 수 없는 오류'));
    }
  } catch (err) {
    showToast('❌ 오류가 발생했습니다: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '신청하기';
  }
}

// GAS JSONP 공통 헬퍼
function gasJsonp(url, params, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const cbName = 'gasCallback_' + Date.now();
    const timer = setTimeout(() => {
      delete window[cbName];
      if (script.parentNode) script.parentNode.removeChild(script);
      reject(new Error('요청 시간 초과'));
    }, timeout);

    window[cbName] = (data) => {
      clearTimeout(timer);
      delete window[cbName];
      if (script.parentNode) script.parentNode.removeChild(script);
      resolve(data);
    };

    const qs = Object.entries({ ...params, callback: cbName })
      .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
      .join('&');

    const script = document.createElement('script');
    script.src = url + '?' + qs;
    script.onerror = () => {
      clearTimeout(timer);
      delete window[cbName];
      reject(new Error('스크립트 로드 실패'));
    };
    document.head.appendChild(script);
  });
}

// 모달 이벤트 바인딩
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('confirmBookRequest').addEventListener('click', submitBookRequest);
  document.getElementById('closeBookRequestModal').addEventListener('click', closeBookRequestModal);

  // 배경 클릭으로 닫기
  document.getElementById('bookRequestModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('bookRequestModal')) closeBookRequestModal();
  });

  // Enter 키 지원
  ['reqTitle', 'reqAuthor', 'reqRequester'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitBookRequest();
    });
  });
});

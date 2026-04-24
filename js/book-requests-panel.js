/* ========================================
   📚 도서관리 시스템 - 도서신청 패널 모듈
   ======================================== */

let _allBookRequests = [];
let _reqActiveFilter = '전체';

function openBookRequestPanel() {
  const panel = document.getElementById('bookRequestPanel');
  const overlay = document.getElementById('bookRequestPanelOverlay');
  panel.style.display = 'flex';
  overlay.style.display = 'block';
  switchReqTab('form');
}

function closeBookRequestPanel() {
  document.getElementById('bookRequestPanel').style.display = 'none';
  document.getElementById('bookRequestPanelOverlay').style.display = 'none';
}

function switchReqTab(tabName) {
  const formTab = document.getElementById('reqFormTab');
  const listTab = document.getElementById('reqListTab');
  const btns = document.querySelectorAll('.req-tab-btn');

  btns.forEach(btn => {
    const isActive = btn.dataset.tab === tabName;
    btn.style.borderBottomColor = isActive ? '#d97706' : 'transparent';
    btn.style.color = isActive ? '#d97706' : '#6b7280';
    btn.style.fontWeight = isActive ? '600' : 'normal';
  });

  if (tabName === 'form') {
    formTab.style.display = 'block';
    listTab.style.display = 'none';
  } else {
    formTab.style.display = 'none';
    listTab.style.display = 'block';
    loadBookRequests();
  }
}

async function loadBookRequests() {
  const tbody = document.getElementById('bookRequestsTbody');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#888;padding:30px;">로딩 중...</td></tr>';

  const gasUrl = localStorage.getItem('gas_backend_url');
  if (!gasUrl) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#9ca3af;padding:30px;">GAS URL이 설정되지 않았습니다.</td></tr>';
    return;
  }

  try {
    const result = await gasJsonp(gasUrl, { action: 'getBookRequests' });
    if (result && result.success) {
      _allBookRequests = result.data || [];
      renderBookRequestList(_reqActiveFilter);
    } else {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#ef4444;padding:30px;">불러오기 실패: ' + escHtml(result && result.error ? result.error : '알 수 없는 오류') + '</td></tr>';
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#ef4444;padding:30px;">오류: ' + escHtml(err.message) + '</td></tr>';
  }
}

function filterBookRequests(status) {
  _reqActiveFilter = status;
  document.querySelectorAll('.req-status-filter').forEach(btn => {
    const isActive = btn.dataset.status === status;
    btn.style.background = isActive ? '#d97706' : '';
    btn.style.color = isActive ? '#fff' : '';
    btn.style.border = isActive ? 'none' : '';
    btn.classList.toggle('active', isActive);
  });
  renderBookRequestList(status);
}

function renderBookRequestList(statusFilter) {
  const tbody = document.getElementById('bookRequestsTbody');
  const filtered = statusFilter === '전체'
    ? _allBookRequests
    : _allBookRequests.filter(r => r.status === statusFilter);

  if (filtered.length === 0) {
    const msg = statusFilter === '전체' ? '신청 내역이 없습니다.' : `"${statusFilter}" 상태의 신청이 없습니다.`;
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#9ca3af;padding:30px;">${msg}</td></tr>`;
    return;
  }

  const statusColors = {
    '대기': 'background:#fef3c7;color:#92400e;',
    '완료': 'background:#d1fae5;color:#047857;',
    '취소': 'background:#f3f4f6;color:#6b7280;'
  };

  tbody.innerHTML = [...filtered].reverse().map(r => {
    const color = statusColors[r.status] || '';
    const dateStr = String(r.requestedAt || '').substring(0, 10);
    const isPending = r.status === '대기';
    return `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;white-space:normal;overflow:visible;text-overflow:clip;word-break:break-word;">${escHtml(r.bookTitle)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;white-space:normal;overflow:visible;text-overflow:clip;word-break:break-word;">${escHtml(r.author || '-')}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;white-space:normal;overflow:visible;text-overflow:clip;word-break:break-word;">${escHtml(r.publisher || '-')}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;">${escHtml(r.requesterName)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;white-space:nowrap;">${escHtml(dateStr)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;">
          <span style="padding:2px 8px;border-radius:12px;font-size:12px;font-weight:500;${color}">${escHtml(r.status)}</span>
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;text-align:center;">
          ${isPending ? `
            <button onclick="handleBookRequestStatus('${escHtml(r.requestId)}', '완료')" style="background:#10b981;color:#fff;border:none;border-radius:4px;padding:4px 10px;font-size:12px;cursor:pointer;margin-right:4px;">완료</button>
            <button onclick="handleBookRequestStatus('${escHtml(r.requestId)}', '취소')" style="background:#6b7280;color:#fff;border:none;border-radius:4px;padding:4px 10px;font-size:12px;cursor:pointer;">취소</button>
          ` : '-'}
        </td>
      </tr>
    `;
  }).join('');
}

async function handleBookRequestStatus(requestId, status) {
  const gasUrl = localStorage.getItem('gas_backend_url');
  if (!gasUrl) { showToast('⚠️ GAS URL이 설정되지 않았습니다.'); return; }

  try {
    const result = await gasJsonp(gasUrl, {
      action: 'updateBookRequestStatus',
      requestId: requestId,
      status: status
    });
    if (result && result.success) {
      showToast(status === '완료' ? '✅ 신청이 완료 처리되었습니다.' : '❌ 신청이 취소되었습니다.');
      loadBookRequests();
    } else {
      showToast('❌ 처리 실패: ' + (result && result.error ? result.error : '알 수 없는 오류'));
    }
  } catch (err) {
    showToast('❌ 오류: ' + err.message);
  }
}

// XSS 방지 (reviews.js에 같은 함수 있으나 독립 선언)
function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

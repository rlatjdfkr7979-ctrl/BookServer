/* ========================================
   📋 예약 현황 패널
   ======================================== */

let currentReservations = [];
let activeFilter = '전체';

// 예약 현황 패널 열기
window.openReservationsPanel = async function() {
  const panel = document.getElementById('reservationsPanel');
  panel.style.display = 'flex';
  document.getElementById('reservationsPanelOverlay').style.display = 'block';
  await loadAllReservations();
};

// 패널 닫기
window.closeReservationsPanel = function() {
  document.getElementById('reservationsPanel').style.display = 'none';
  document.getElementById('reservationsPanelOverlay').style.display = 'none';
};

// 전체 예약 목록 로드
window.loadAllReservations = async function loadAllReservations() {
  const tbody = document.getElementById('reservationsTbody');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#888;padding:20px;">불러오는 중...</td></tr>';

  if (!localStorage.getItem('gas_backend_url') || !window.doorayIntegration) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#dc2626;padding:20px;">GAS URL이 설정되지 않았습니다.</td></tr>';
    return;
  }

  const result = await window.doorayIntegration.getReservations('');
  if (!result || !result.success) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#dc2626;padding:20px;">불러오기 실패: ' + (result && result.error ? result.error : '알 수 없는 오류') + '</td></tr>';
    return;
  }

  currentReservations = result.data || [];
  // 전역 캐시 갱신
  window.reservationData = currentReservations;

  renderReservationsTable(activeFilter);
}

// 필터별 테이블 렌더링
window.filterReservations = function(status) {
  activeFilter = status;
  document.querySelectorAll('.res-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.status === status);
  });
  renderReservationsTable(status);
};

function renderReservationsTable(statusFilter) {
  const tbody = document.getElementById('reservationsTbody');
  const filtered = statusFilter === '전체'
    ? currentReservations
    : currentReservations.filter(r => r.status === statusFilter);

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#888;padding:20px;">예약 데이터가 없습니다.</td></tr>';
    updateReservationCount(statusFilter);
    return;
  }

  // 최신 순 정렬
  const sorted = [...filtered].sort((a, b) => String(b.reservationId).localeCompare(String(a.reservationId)));

  tbody.innerHTML = sorted.map(r => {
    const statusClass = r.status === '대기' ? 'res-status-waiting'
      : r.status === '완료' ? 'res-status-done'
      : 'res-status-cancelled';
    const canCancel = r.status === '대기';
    return `<tr>
      <td>${escHtml(r.bookTitle || '')}</td>
      <td>${escHtml(r.bookCode || '')}</td>
      <td>${escHtml(r.reserverName || '')}</td>
      <td>${escHtml(r.borrowerName || '')}</td>
      <td>${escHtml(String(r.reservedAt || '').substring(0, 16))}</td>
      <td>
        <span class="res-status-badge ${statusClass}">${escHtml(r.status || '')}</span>
        ${canCancel ? `<button class="res-cancel-btn" onclick="cancelReservationUI('${escHtml(String(r.reservationId))}')">취소</button>` : ''}
      </td>
    </tr>`;
  }).join('');

  updateReservationCount(statusFilter);
}

function updateReservationCount(statusFilter) {
  const waitCount = currentReservations.filter(r => r.status === '대기').length;
  const el = document.getElementById('reservationWaitCount');
  if (el) el.textContent = waitCount > 0 ? `대기 ${waitCount}건` : '';
}

// 예약 취소
window.cancelReservationUI = async function(reservationId) {
  if (!confirm('이 예약을 취소하시겠습니까?')) return;
  const result = await window.doorayIntegration.cancelReservation(reservationId);
  if (result && result.success) {
    await loadAllReservations();
    // 뱃지 업데이트
    if (typeof window.applyAllFilters === 'function') window.applyAllFilters();
  } else {
    alert('취소 실패: ' + (result && result.error ? result.error : '알 수 없는 오류'));
  }
};

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

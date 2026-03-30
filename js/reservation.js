/* ========================================
   📅 도서 예약 모달 로직
   ======================================== */

window.showReservationModal = function({ title, bookCode, borrowerName }) {
  document.getElementById('reservationBookTitle').textContent = '도서명: ' + title;
  document.getElementById('reservationBorrower').textContent = borrowerName;
  document.getElementById('reserverNameInput').value = '';
  document.getElementById('reservationModal')._current = { title, bookCode, borrowerName };
  document.getElementById('reservationModal').style.display = 'flex';
  setTimeout(() => document.getElementById('reserverNameInput').focus(), 100);
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('cancelReserveBtn').onclick = () => {
    document.getElementById('reservationModal').style.display = 'none';
  };

  // 모달 바깥 클릭 시 닫기
  document.getElementById('reservationModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('reservationModal')) {
      document.getElementById('reservationModal').style.display = 'none';
    }
  });

  // Enter 키로 발송
  document.getElementById('reserverNameInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('confirmReserveBtn').click();
  });

  document.getElementById('confirmReserveBtn').onclick = async () => {
    const reserverName = document.getElementById('reserverNameInput').value.trim();
    if (!reserverName) {
      alert('예약자 이름을 입력해주세요.');
      return;
    }

    const { title, bookCode, borrowerName } = document.getElementById('reservationModal')._current;
    const btn = document.getElementById('confirmReserveBtn');
    btn.disabled = true;
    btn.textContent = '처리 중...';

    try {
      const dmResult = await window.doorayIntegration.sendReservationDM(borrowerName, title, reserverName);
      if (dmResult && dmResult.success) {
        // DM 성공 후 예약 데이터 저장
        window.doorayIntegration.saveReservation(bookCode || '', title, borrowerName, reserverName)
          .then(() => {
            // 예약 수 캐시 업데이트
            if (bookCode) {
              window.reservationData = window.reservationData || [];
              window.reservationData.push({ bookCode, bookTitle: title, borrowerName, reserverName, status: '대기' });
              if (typeof window.updateReservationBadges === 'function') window.updateReservationBadges();
            }
          });
        alert(`✅ ${borrowerName}님께 반납 요청 메시지를 발송하고 예약을 등록했습니다.`);
        document.getElementById('reservationModal').style.display = 'none';
      } else {
        alert('❌ 메시지 발송 실패: ' + (dmResult && dmResult.error ? dmResult.error : '알 수 없는 오류'));
      }
    } catch (err) {
      alert('❌ 오류: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '예약 및 메시지 발송';
    }
  };
});

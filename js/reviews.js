/* ========================================
   📚 도서관리 시스템 - 도서 평점/리뷰 모듈
   ======================================== */

// 별점 선택값 추적
let _selectedRating = 0;

function renderReviewTab(bookCode, bookTitle, container) {
  _selectedRating = 0;
  container.innerHTML = `
    <div id="reviewListSection">
      <div style="text-align:center;padding:20px;color:#6b7280;font-size:13px;">⏳ 리뷰를 불러오는 중...</div>
    </div>
    <div class="review-form">
      <strong style="font-size:0.9rem;color:#374151;">✍️ 리뷰 작성</strong>
      <div style="margin:10px 0 6px 0;">
        <div class="star-rating" id="starRatingInput">
          <span class="star" data-val="1">★</span>
          <span class="star" data-val="2">★</span>
          <span class="star" data-val="3">★</span>
          <span class="star" data-val="4">★</span>
          <span class="star" data-val="5">★</span>
        </div>
        <span id="ratingLabel" style="font-size:12px;color:#6b7280;vertical-align:middle;margin-left:4px;">별점을 선택하세요</span>
      </div>
      <input type="text" id="reviewerNameInput" placeholder="작성자 이름 *" />
      <textarea id="reviewTextInput" placeholder="감상을 남겨주세요 (선택)"></textarea>
      <div style="text-align:right;">
        <button id="submitReviewBtn" style="background:#059669;padding:7px 16px;font-size:13px;">등록</button>
      </div>
    </div>
  `;

  // 별점 클릭 이벤트
  const stars = container.querySelectorAll('.star-rating .star');
  stars.forEach(star => {
    star.addEventListener('click', () => {
      _selectedRating = parseInt(star.dataset.val);
      updateStarDisplay(stars, _selectedRating);
      const labels = ['', '★ 별로예요', '★★ 그저 그래요', '★★★ 괜찮아요', '★★★★ 좋아요', '★★★★★ 최고예요'];
      document.getElementById('ratingLabel').textContent = labels[_selectedRating];
    });

    star.addEventListener('mouseenter', () => {
      updateStarDisplay(stars, parseInt(star.dataset.val));
    });

    star.addEventListener('mouseleave', () => {
      updateStarDisplay(stars, _selectedRating);
    });
  });

  // 등록 버튼
  container.querySelector('#submitReviewBtn').addEventListener('click', () => {
    submitReview(bookCode, bookTitle, container);
  });

  // 리뷰 목록 로드
  loadReviews(bookCode, container.querySelector('#reviewListSection'));
}

function updateStarDisplay(stars, rating) {
  stars.forEach(s => {
    s.classList.toggle('active', parseInt(s.dataset.val) <= rating);
  });
}

async function loadReviews(bookCode, listContainer) {
  const gasUrl = localStorage.getItem('gas_backend_url');
  if (!gasUrl) {
    listContainer.innerHTML = '<div style="text-align:center;padding:16px;color:#9ca3af;font-size:13px;">GAS URL이 설정되지 않아 리뷰를 불러올 수 없습니다.</div>';
    return;
  }

  try {
    const result = await gasJsonp(gasUrl, { action: 'getReviews', bookCode: bookCode });
    if (result && result.success) {
      renderReviewList(result.data || [], listContainer);
    } else {
      listContainer.innerHTML = '<div style="text-align:center;padding:16px;color:#9ca3af;font-size:13px;">리뷰를 불러오는 데 실패했습니다.</div>';
    }
  } catch {
    listContainer.innerHTML = '<div style="text-align:center;padding:16px;color:#9ca3af;font-size:13px;">리뷰 로드 중 오류가 발생했습니다.</div>';
  }
}

function renderReviewList(reviews, container) {
  if (reviews.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:20px;color:#9ca3af;font-size:13px;">아직 작성된 리뷰가 없습니다. 첫 번째 리뷰를 남겨보세요!</div>';
    return;
  }

  const avgRating = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  const starsHtml = '★'.repeat(Math.round(avgRating)) + '☆'.repeat(5 - Math.round(avgRating));

  container.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #e5e7eb;">
      <span style="font-size:1.3rem;color:#f59e0b;">${starsHtml}</span>
      <strong style="font-size:1rem;">${avgRating.toFixed(1)}</strong>
      <span style="font-size:12px;color:#6b7280;">(${reviews.length}개의 리뷰)</span>
    </div>
    ${reviews.slice().reverse().map(r => `
      <div class="review-card">
        <div class="review-card-header">
          <strong style="font-size:0.88rem;">${escHtml(r.reviewerName)}</strong>
          <span class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
          <span class="review-meta">${formatReviewDate(r.writtenAt)}</span>
        </div>
        ${r.reviewText ? `<div class="review-text">${escHtml(r.reviewText)}</div>` : ''}
      </div>
    `).join('')}
  `;
}

async function submitReview(bookCode, bookTitle, container) {
  const reviewer = document.getElementById('reviewerNameInput').value.trim();
  const text = document.getElementById('reviewTextInput').value.trim();

  if (!reviewer) { showToast('⚠️ 작성자 이름을 입력해주세요.'); return; }
  if (!_selectedRating) { showToast('⚠️ 별점을 선택해주세요.'); return; }

  const gasUrl = localStorage.getItem('gas_backend_url');
  if (!gasUrl) { showToast('⚠️ GAS URL이 설정되지 않았습니다.'); return; }

  const btn = document.getElementById('submitReviewBtn');
  btn.disabled = true;
  btn.textContent = '등록 중...';

  try {
    const result = await gasJsonp(gasUrl, {
      action: 'saveReview',
      bookCode: bookCode,
      bookTitle: bookTitle,
      reviewerName: reviewer,
      rating: _selectedRating,
      reviewText: text
    });

    if (result && result.success) {
      showToast('✅ 리뷰가 등록되었습니다!');
      document.getElementById('reviewerNameInput').value = '';
      document.getElementById('reviewTextInput').value = '';
      _selectedRating = 0;
      updateStarDisplay(container.querySelectorAll('.star-rating .star'), 0);
      document.getElementById('ratingLabel').textContent = '별점을 선택하세요';
      loadReviews(bookCode, container.querySelector('#reviewListSection'));
    } else {
      showToast('❌ 등록 실패: ' + (result && result.error ? result.error : '알 수 없는 오류'));
    }
  } catch (err) {
    showToast('❌ 오류가 발생했습니다: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '등록';
  }
}

function formatReviewDate(dateVal) {
  if (!dateVal) return '';
  const str = String(dateVal);
  const m = str.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : str.substring(0, 10);
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

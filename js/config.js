/* ========================================
   📚 도서관리 시스템 - 환경 설정
   ======================================== */

// Google Forms 설정
const FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSdGuoHeUW-37RFCBgMH7ZUNL0tt_yHQiIFMrif85mrV428Omg/viewform?usp=header"; // QR 생성용
const ADD_BOOK_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSdOFZRt4o-bw6UNmBB6JtdDQ6PR5f7eW0dpfIs8KwyUysL5ag/viewform"; // 도서 추가용
const ENTRY_IDS = {
  code: "entry.32105598",
  title: "entry.1234176416",
  author: "entry.628826984",
  status: "entry.12641564",
  renter: "entry.615776096"
};

// 페이지네이션 설정
const ITEMS_PER_PAGE = 20; // 페이지당 항목 수

// Dooray 설정
window.DOORAY_CONFIG = {
  wikiId: localStorage.getItem('dooray_wiki_id') || '',
  pageId: localStorage.getItem('dooray_page_id') || '',
  backendUrl: localStorage.getItem('gas_backend_url') || '',
  settings: {
    autoSync: localStorage.getItem('dooray_auto_sync') === 'true',
    syncInterval: parseInt(localStorage.getItem('dooray_sync_interval')) || 3600000, // 기본 1시간
    notifyOnLoan: localStorage.getItem('dooray_notify_loan') === 'true'
  }
};

// API 엔드포인트 설정
window.DOORAY_ENDPOINTS = {
  wiki: {
    list: (wikiId) => `${window.DOORAY_CONFIG.baseUrl}/v1/wikis/${wikiId}/pages`,
    get: (wikiId, pageId) => `${window.DOORAY_CONFIG.baseUrl}/v1/wikis/${wikiId}/pages/${pageId}/content`,
    update: (projectId, postId) => `${window.DOORAY_CONFIG.baseUrl}/v1/projects/${projectId}/posts/${postId}`
  },
  messenger: {
    send: (channelId) => `${window.DOORAY_CONFIG.baseUrl}/v1/messenger/channels/${channelId}/messages`
  }
};



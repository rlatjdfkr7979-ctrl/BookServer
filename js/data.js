/* ========================================
   📚 도서관리 시스템 - 데이터 소스 모듈
   Google Sheets 연동
   ======================================== */

(function() {
  const DEFAULT_BOOKS_SHEET = 'Books';
  const DEFAULT_LIBRARY_SHEET = 'Library';

  const DATA_CONFIG = {
    backendUrl: (localStorage.getItem('gas_backend_url') || '').trim(),
    booksSheet: (localStorage.getItem('gas_books_sheet') || DEFAULT_BOOKS_SHEET).trim(),
    librarySheet: (localStorage.getItem('gas_library_sheet') || DEFAULT_LIBRARY_SHEET).trim()
  };

  /**
   * 데이터 정규화 - 빈 값 처리 및 헤더 트림
   */
  function normalizeRows(rows) {
    if (!Array.isArray(rows)) {
      return [];
    }

    const sanitized = rows
      .filter(row => Array.isArray(row))
      .map(row => row.map(cell => (cell == null ? '' : String(cell).trim())));

    if (sanitized.length === 0) {
      return [];
    }

    return sanitized;
  }

  /**
   * Google Apps Script를 통해 시트 데이터 가져오기
   */
  async function fetchSheetData(sheetName) {
    if (!DATA_CONFIG.backendUrl) {
      throw new Error('Google Apps Script 백엔드 URL이 설정되지 않았습니다.');
    }

    const url = new URL(DATA_CONFIG.backendUrl);
    url.searchParams.set('action', 'getSheetData');
    url.searchParams.set('sheet', sheetName);
    url.searchParams.set('format', 'json');
    url.searchParams.set('t', Date.now().toString());

    console.log(`🔄 Google Sheets 요청: ${sheetName}`);

    const response = await fetch(url.toString(), {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Accept': 'application/json'
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`시트(${sheetName}) 응답 오류: HTTP ${response.status}`);
    }

    const result = await response.json();

    if (result && result.success === false) {
      throw new Error(result.message || 'Google Sheets에서 데이터를 불러오지 못했습니다.');
    }

    const payload = result && (result.data || result.values || result.rows);
    const rows = normalizeRows(payload);

    if (!rows.length) {
      throw new Error(`시트(${sheetName}) 데이터가 비어 있습니다.`);
    }

    console.log(`✅ ${sheetName} 데이터 로드 완료: ${rows.length}행`);
    return rows;
  }

  /**
   * 메인 데이터 로드 함수
   * Google Sheets 실패 시 CSV로 자동 폴백
   */
  async function loadDataSets() {
    // Google Apps Script URL이 없으면 CSV 사용
    if (!DATA_CONFIG.backendUrl) {
      console.info('📄 Google Apps Script URL이 없어 CSV 파일에서 데이터를 로드합니다.');
      const [books, library] = await Promise.all([
        window.loadCSV('books.csv'),
        window.loadCSV('library.csv')
      ]);
      return { source: 'csv', books, library };
    }

    // Google Sheets에서 로드 시도
    try {
      console.info('🔄 Google Sheets에서 데이터를 로드 중...');
      const [books, library] = await Promise.all([
        fetchSheetData(DATA_CONFIG.booksSheet || DEFAULT_BOOKS_SHEET),
        fetchSheetData(DATA_CONFIG.librarySheet || DEFAULT_LIBRARY_SHEET)
      ]);

      console.info('✅ Google Sheets에서 데이터를 성공적으로 로드했습니다.');
      return {
        source: 'gas',
        books,
        library
      };
    } catch (error) {
      // 실패 시 CSV로 폴백
      console.warn('⚠️ Google Sheets 로드 실패. CSV 데이터로 폴백합니다.', error);
      const [books, library] = await Promise.all([
        window.loadCSV('books.csv'),
        window.loadCSV('library.csv')
      ]);

      return {
        source: 'csv',
        books,
        library,
        error
      };
    }
  }

  /**
   * 백엔드 URL 설정
   */
  function setBackendUrl(url) {
    DATA_CONFIG.backendUrl = (url || '').trim();
    localStorage.setItem('gas_backend_url', DATA_CONFIG.backendUrl);
    console.log('💾 Google Apps Script URL 저장:', DATA_CONFIG.backendUrl ? '설정됨' : '제거됨');
  }

  /**
   * 시트 이름 설정
   */
  function setSheetNames({ booksSheet, librarySheet }) {
    if (typeof booksSheet === 'string' && booksSheet.trim()) {
      DATA_CONFIG.booksSheet = booksSheet.trim();
      localStorage.setItem('gas_books_sheet', DATA_CONFIG.booksSheet);
    }
    if (typeof librarySheet === 'string' && librarySheet.trim()) {
      DATA_CONFIG.librarySheet = librarySheet.trim();
      localStorage.setItem('gas_library_sheet', DATA_CONFIG.librarySheet);
    }
    console.log('💾 시트 이름 저장:', DATA_CONFIG);
  }

  // 전역 노출
  window.DATA_CONFIG = DATA_CONFIG;
  window.fetchSheetDataFromGas = fetchSheetData;
  window.loadDataSets = loadDataSets;
  window.setGasBackendUrl = setBackendUrl;
  window.setGasSheetNames = setSheetNames;
})();

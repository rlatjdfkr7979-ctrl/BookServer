/* ========================================
   📚 도서관리 시스템 - 데이터 소스 모듈
   ======================================== */

(function() {
  const DEFAULT_BOOKS_SHEET = 'Books';
  const DEFAULT_LIBRARY_SHEET = 'Library';

  const DATA_CONFIG = {
    backendUrl: (localStorage.getItem('gas_backend_url') || '').trim(),
    booksSheet: (localStorage.getItem('gas_books_sheet') || DEFAULT_BOOKS_SHEET).trim(),
    librarySheet: (localStorage.getItem('gas_library_sheet') || DEFAULT_LIBRARY_SHEET).trim()
  };

  function normalizeRows(rows) {
    if (!Array.isArray(rows)) {
      return [];
    }

    const sanitized = rows
      .filter(row => Array.isArray(row))
      .map(row => row.map(cell => (cell == null ? '' : cell)));

    if (sanitized.length === 0) {
      return [];
    }

    const [header, ...rest] = sanitized;
    const trimmedHeader = header.map(h => String(h).trim());
    return [trimmedHeader, ...rest];
  }

  async function fetchSheetData(sheetName) {
    if (!DATA_CONFIG.backendUrl) {
      throw new Error('Google Apps Script 백엔드 URL이 설정되지 않았습니다.');
    }

    const url = new URL(DATA_CONFIG.backendUrl);
    url.searchParams.set('action', 'getSheetData');
    url.searchParams.set('sheet', sheetName);
    url.searchParams.set('format', 'json');
    url.searchParams.set('t', Date.now().toString());

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
      throw new Error('시트 데이터가 비어 있습니다.');
    }

    return rows;
  }

  async function loadDataSets() {
    if (!DATA_CONFIG.backendUrl) {
      const [books, library] = await Promise.all([
        window.loadCSV('books.csv'),
        window.loadCSV('library.csv')
      ]);
      return { source: 'csv', books, library };
    }

    try {
      const [books, library] = await Promise.all([
        fetchSheetData(DATA_CONFIG.booksSheet || DEFAULT_BOOKS_SHEET),
        fetchSheetData(DATA_CONFIG.librarySheet || DEFAULT_LIBRARY_SHEET)
      ]);

      return {
        source: 'gas',
        books,
        library
      };
    } catch (error) {
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

  function setBackendUrl(url) {
    DATA_CONFIG.backendUrl = (url || '').trim();
  }

  function setSheetNames({ booksSheet, librarySheet }) {
    if (typeof booksSheet === 'string' && booksSheet.trim()) {
      DATA_CONFIG.booksSheet = booksSheet.trim();
    }
    if (typeof librarySheet === 'string' && librarySheet.trim()) {
      DATA_CONFIG.librarySheet = librarySheet.trim();
    }
  }

  window.DATA_CONFIG = DATA_CONFIG;
  window.fetchSheetDataFromGas = fetchSheetData;
  window.loadDataSets = loadDataSets;
  window.setGasBackendUrl = setBackendUrl;
  window.setGasSheetNames = setSheetNames;
})();

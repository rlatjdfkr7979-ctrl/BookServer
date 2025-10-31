/* ========================================
   📚 도서관리 시스템 - 데이터 소스 모듈 (JSONP 버전)
   ======================================== */

(function() {
  const DEFAULT_BOOKS_SHEET = '도서 대여 기록';
  const DEFAULT_LIBRARY_SHEET = '도서목록';

  const DATA_CONFIG = {
    backendUrl: (localStorage.getItem('gas_backend_url') || '').trim(),
    booksSheet: (localStorage.getItem('gas_books_sheet') || DEFAULT_BOOKS_SHEET).trim(),
    librarySheet: (localStorage.getItem('gas_library_sheet') || DEFAULT_LIBRARY_SHEET).trim(),
    spreadsheetId: (localStorage.getItem('gas_spreadsheet_id') || '').trim()
  };

  function applyBackendConfig(config = {}) {
    if (config.spreadsheetId && typeof config.spreadsheetId === 'string') {
      const trimmed = config.spreadsheetId.trim();
      if (trimmed) {
        DATA_CONFIG.spreadsheetId = trimmed;
        localStorage.setItem('gas_spreadsheet_id', trimmed);
      }
    }

    if (config.booksSheetName && typeof config.booksSheetName === 'string') {
      const trimmed = config.booksSheetName.trim();
      if (trimmed) {
        DATA_CONFIG.booksSheet = trimmed;
        localStorage.setItem('gas_books_sheet', trimmed);
      }
    }

    if (config.librarySheetName && typeof config.librarySheetName === 'string') {
      const trimmed = config.librarySheetName.trim();
      if (trimmed) {
        DATA_CONFIG.librarySheet = trimmed;
        localStorage.setItem('gas_library_sheet', trimmed);
      }
    }
  }

  function normalizeRows(rows) {
    if (!Array.isArray(rows)) return [];
    const sanitized = rows
      .filter(row => Array.isArray(row))
      .map(row => row.map(cell => (cell == null ? '' : cell)));

    if (sanitized.length === 0) return [];

    const [header, ...rest] = sanitized;
    const trimmedHeader = header.map(h => String(h).trim());
    return [trimmedHeader, ...rest];
  }

  /** ✅ JSONP로 Google Apps Script 호출 (CORS 회피용) */
  function jsonpRequest(url, params = {}) {
    return new Promise((resolve, reject) => {
      const callbackName = 'jsonp_cb_' + Date.now() + '_' + Math.floor(Math.random() * 10000);

      params.callback = callbackName;
      const query = new URLSearchParams(params).toString();
      const fullUrl = url + (url.includes('?') ? '&' : '?') + query;

      const script = document.createElement('script');
      script.src = fullUrl;

      // 타임아웃 방지용
      const timeout = setTimeout(() => {
        reject(new Error('⏰ 요청 시간이 초과되었습니다.'));
        cleanup();
      }, 10000);

      function cleanup() {
        clearTimeout(timeout);
        delete window[callbackName];
        script.remove();
      }

      window[callbackName] = (data) => {
        cleanup();
        if (data && data.success) {
          resolve(data);
        } else {
          reject(new Error(data && data.message ? data.message : '데이터 로드 실패'));
        }
      };

      script.onerror = () => {
        reject(new Error('🚨 GAS JSONP 호출 실패'));
        cleanup();
      };

      document.body.appendChild(script);
    });
  }

  /** ✅ 시트 데이터 가져오기 */
  async function fetchSheetData(sheetName) {
    if (!DATA_CONFIG.backendUrl) {
      throw new Error('Google Apps Script 백엔드 URL이 설정되지 않았습니다.');
    }

    const url = DATA_CONFIG.backendUrl.replace(/\?.*$/, '');
    const params = {
      action: 'getSheetData',
      sheet: sheetName,
      t: Date.now().toString()
    };

    if (DATA_CONFIG.spreadsheetId) {
      params.spreadsheetId = DATA_CONFIG.spreadsheetId;
    }

    const result = await jsonpRequest(url, params);
    const payload = result && (result.data || result.values || result.rows);
    const rows = normalizeRows(payload);

    if (!rows.length) throw new Error('시트 데이터가 비어 있습니다.');
    return rows;
  }

  /** ✅ 전체 데이터셋 로드 */
  async function loadDataSets() {
    if (!DATA_CONFIG.backendUrl) {
      const [books, library] = await Promise.all([
        window.loadCSV('books.csv'),
        window.loadCSV('library.csv')
      ]);
      return { source: 'csv', books, library };
    }

    await refreshBackendConfig();

    try {
      const [books, library] = await Promise.all([
        fetchSheetData(DATA_CONFIG.booksSheet || DEFAULT_BOOKS_SHEET),
        fetchSheetData(DATA_CONFIG.librarySheet || DEFAULT_LIBRARY_SHEET)
      ]);
      return { source: 'gas', books, library };
    } catch (error) {
      console.warn('⚠️ Google Sheets 로드 실패. CSV 데이터로 폴백합니다.', error);
      const [books, library] = await Promise.all([
        window.loadCSV('books.csv'),
        window.loadCSV('library.csv')
      ]);
      return { source: 'csv', books, library, error };
    }
  }

  async function refreshBackendConfig() {
    const url = DATA_CONFIG.backendUrl;
    if (!url) return;

    try {
      const cleanUrl = url.replace(/\?.*$/, '');
      const result = await jsonpRequest(cleanUrl, {
        action: 'getConfig',
        t: Date.now().toString()
      });

      if (result && result.success && result.data) {
        applyBackendConfig(result.data);
      }
    } catch (error) {
      console.warn('⚠️ GAS 설정 정보를 불러오지 못했습니다.', error);
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

  function setSpreadsheetId(id) {
    DATA_CONFIG.spreadsheetId = (id || '').trim();
  }

  // 전역 등록
  window.DATA_CONFIG = DATA_CONFIG;
  window.fetchSheetDataFromGas = fetchSheetData;
  window.loadDataSets = loadDataSets;
  window.setGasBackendUrl = setBackendUrl;
  window.setGasSheetNames = setSheetNames;
  window.setGasSpreadsheetId = setSpreadsheetId;
  window.applyGasBackendConfig = applyBackendConfig;
})();

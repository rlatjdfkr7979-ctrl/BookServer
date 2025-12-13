/**
 * 📚 울산도시공사 도서관리 시스템 - Google Apps Script 백엔드
 *
 * - Google Sheets를 데이터 원본으로 제공 (프론트엔드 fetchSheetData 연동)
 * - Dooray Wiki 동기화를 위한 로그 저장
 * - Google Form 응답을 도서 시트에 반영하고 필요 시 GitHub CSV를 갱신
 */

const SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();

const DEFAULT_LIBRARY_SHEET = '도서목록';
const DEFAULT_BOOKS_SHEET = '도서 대여 기록';
const BOOK_FORM_SHEET = '도서추가';
const LOAN_FORM_SHEET = '도서 대여 기록';

const CONFIG = {
  spreadsheetId: getScriptProperty('SPREADSHEET_ID', ''),
  booksSheetName: getScriptProperty('BOOKS_SHEET_NAME', DEFAULT_BOOKS_SHEET),
  librarySheetName: getScriptProperty('LIBRARY_SHEET_NAME', DEFAULT_LIBRARY_SHEET),
  wikiLogSheetName: getScriptProperty('WIKI_LOG_SHEET_NAME', ''),
  githubToken: getScriptProperty('GITHUB_TOKEN', ''),
  githubRepo: getScriptProperty('GITHUB_REPO', ''),
  libraryCsvPath: getScriptProperty('LIBRARY_CSV_PATH', 'library.csv'),
  booksCsvPath: getScriptProperty('BOOKS_CSV_PATH', 'books.csv'),
  githubBranch: getScriptProperty('GITHUB_BRANCH', 'main')
};

function getScriptProperty(key, fallback) {
  const value = SCRIPT_PROPERTIES.getProperty(key);
  if (value === null || value === undefined) {
    return fallback;
  }

  const trimmed = typeof value === 'string' ? value.trim() : value;
  if (typeof trimmed === 'string' && trimmed.length === 0) {
    return fallback;
  }

  return trimmed;
}

function openSpreadsheet() {
  if (CONFIG.spreadsheetId) {
    try {
      return SpreadsheetApp.openById(CONFIG.spreadsheetId);
    } catch (error) {
      Logger.log('⚠️ 지정된 Spreadsheet ID로 열 수 없습니다. 활성 스프레드시트를 사용합니다. ' + error);
    }
  }

  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error('Spreadsheet를 열 수 없습니다. SPREADSHEET_ID를 설정하거나 스크립트를 스프레드시트에 바인딩하세요.');
  }
  return active;
}

function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    const action = (params.action || '').trim();

    switch (action) {
      case 'getSheetData': {
        const sheetName = (params.sheet || '').trim();
        const values = getSheetValues(sheetName);
        return respondJson({ success: true, data: values }, params.callback);
      }
      case 'getConfig': {
        return respondJson({
          success: true,
          data: {
            booksSheetName: CONFIG.booksSheetName || DEFAULT_BOOKS_SHEET,
            librarySheetName: CONFIG.librarySheetName || DEFAULT_LIBRARY_SHEET,
            spreadsheetId: CONFIG.spreadsheetId || '',
            bookFormSheetName: BOOK_FORM_SHEET,
            loanFormSheetName: LOAN_FORM_SHEET
          }
        }, params.callback);
      }
      case 'test': {
        return respondJson({
          success: true,
          message: 'Google Apps Script 연결이 정상입니다.',
          data: {
            wikiId: params.wikiId || '',
            pageTitle: 'Dooray 연동 확인용'
          }
        }, params.callback);
      }
      default:
        return respondJson({ success: false, message: '지원하지 않는 action 입니다.' }, params.callback);
    }
  } catch (error) {
    return respondJson({ success: false, message: error.message }, e && e.parameter && e.parameter.callback);
  }
}

function doPost(e) {
  try {
    const raw = e.postData && e.postData.contents ? e.postData.contents : '{}';
    const data = JSON.parse(raw);
    const action = (data.action || '').trim();

    switch (action) {
      case 'getSheetData': {
        const sheetName = typeof data.sheet === 'string' ? data.sheet.trim() : '';
        const values = getSheetValues(sheetName);
        return respondJson({ success: true, data: values }, data.callback);
      }
      case 'updateSheetConfig': {
        updateSheetConfig(data);
        return respondJson({ success: true, message: '시트 구성이 저장되었습니다.' }, data.callback);
      }
      case 'updateWiki': {
        logWikiSnapshot(data);
        return respondJson({ success: true, message: 'Wiki 스냅샷이 저장되었습니다.' }, data.callback);
      }
      case 'test': {
        return respondJson({
          success: true,
          message: 'Google Apps Script 연결이 정상입니다.',
          data: {
            wikiId: data.wikiId || '',
            pageTitle: 'Dooray 연동 확인용'
          }
        }, data.callback);
      }
      default:
        return respondJson({ success: false, message: '지원하지 않는 action 입니다.' }, data.callback);
    }
  } catch (error) {
    return respondJson({ success: false, message: error.message });
  }
}

function getSheetValues(requestedName) {
  const spreadsheet = openSpreadsheet();
  const normalized = (requestedName || '').toLowerCase();
  const configBooks = (CONFIG.booksSheetName || DEFAULT_BOOKS_SHEET).toString();
  const configLibrary = (CONFIG.librarySheetName || DEFAULT_LIBRARY_SHEET).toString();

  let targetName = requestedName;
  if (!targetName) {
    targetName = configLibrary;
  } else if (normalized === 'books' || normalized === configBooks.toLowerCase()) {
    targetName = configBooks;
  } else if (normalized === 'library' || normalized === configLibrary.toLowerCase()) {
    targetName = configLibrary;
  } else if (normalized === DEFAULT_BOOKS_SHEET.toLowerCase()) {
    targetName = DEFAULT_BOOKS_SHEET;
  } else if (normalized === DEFAULT_LIBRARY_SHEET.toLowerCase()) {
    targetName = DEFAULT_LIBRARY_SHEET;
  }

  const sheet = spreadsheet.getSheetByName(targetName);
  if (!sheet) {
    throw new Error('시트를 찾을 수 없습니다: ' + targetName);
  }

  const values = sheet.getDataRange().getDisplayValues();
  return values;
}

function logWikiSnapshot(payload) {
  if (!CONFIG.wikiLogSheetName) {
    return;
  }

  const spreadsheet = openSpreadsheet();
  const sheet = spreadsheet.getSheetByName(CONFIG.wikiLogSheetName) || spreadsheet.insertSheet(CONFIG.wikiLogSheetName);

  sheet.appendRow([
    new Date(),
    payload.wikiId || '',
    payload.pageId || '',
    (payload.content || '').slice(0, 50000)
  ]);
}

function updateSheetConfig(payload) {
  const updates = {};

  if (typeof payload.spreadsheetId === 'string' && payload.spreadsheetId.trim()) {
    const trimmed = payload.spreadsheetId.trim();
    SCRIPT_PROPERTIES.setProperty('SPREADSHEET_ID', trimmed);
    updates.spreadsheetId = trimmed;
  }

  if (typeof payload.booksSheet === 'string' && payload.booksSheet.trim()) {
    SCRIPT_PROPERTIES.setProperty('BOOKS_SHEET_NAME', payload.booksSheet.trim());
    updates.booksSheetName = payload.booksSheet.trim();
  }

  if (typeof payload.librarySheet === 'string' && payload.librarySheet.trim()) {
    SCRIPT_PROPERTIES.setProperty('LIBRARY_SHEET_NAME', payload.librarySheet.trim());
    updates.librarySheetName = payload.librarySheet.trim();
  }

  if (Object.keys(updates).length > 0) {
    if (updates.booksSheetName) {
      CONFIG.booksSheetName = updates.booksSheetName;
    }
    if (updates.librarySheetName) {
      CONFIG.librarySheetName = updates.librarySheetName;
    }
    if (updates.spreadsheetId) {
      CONFIG.spreadsheetId = updates.spreadsheetId;
    }
  }
}

// =============================================================
// ✅ Google Form 응답 처리 진입점
// =============================================================
function onFormSubmit(e) {
  const sheet = e.source.getActiveSheet();
  const name = sheet.getName();

  if (name === BOOK_FORM_SHEET) {
    handleBookSubmission(e);
    return;
  }

  if (name === LOAN_FORM_SHEET) {
    handleLoanSubmission(e);
    return;
  }

  Logger.log(`⚠️ 다른 시트(${name}) 응답은 처리하지 않습니다.`);
}

// =============================================================
// ✅ 도서추가 폼 → 도서목록 시트 + GitHub library.csv (옵션)
// =============================================================
function handleBookSubmission(e) {
  const spreadsheet = openSpreadsheet();
  const src = spreadsheet.getSheetByName(BOOK_FORM_SHEET);
  const librarySheetName = CONFIG.librarySheetName || DEFAULT_LIBRARY_SHEET;
  const dst = spreadsheet.getSheetByName(librarySheetName);

  if (!src || !dst) {
    throw new Error(`${BOOK_FORM_SHEET} 또는 ${librarySheetName} 시트를 찾을 수 없습니다.`);
  }

  const last = src.getLastRow();
  const row = src.getRange(last, 1, 1, src.getLastColumn()).getValues()[0];
  const tsKST = parseKoreanDateTime(row[0]);
  const input = row
    .slice(1)
    .map(value => (value == null ? '' : value).toString().trim());

  const A = input[0] || '';
  const B = input[1] || '';
  const C = input[2] || '';
  const D = input[3] || '';
  const G = input[4] || '';

  const record = [A, B, C, D, '', '', G];
  const sheetRecord = [tsKST, A, B, C, D, '', '', G];

  dst.appendRow(sheetRecord);

  copyPreviousFormulas(dst);

  Logger.log(`📗 ${librarySheetName} 행 ${dst.getLastRow()} 추가 완료 (${tsKST})`);

  updateLibraryCSVOnGitHub(record);
}

// =============================================================
// ✅ 도서 대여 기록 → books.csv 업데이트 (열 순서 맞춤)
// =============================================================
function handleLoanSubmission(e) {
  const row = Array.isArray(e.values) ? e.values : [];
  const normalizedRow = row.map(value => (value == null ? '' : value).toString().trim());
  const [timestamp, code, borrower, status, title, author] = normalizedRow;
  const tsKST = parseKoreanDateTime(timestamp);

  const spreadsheet = openSpreadsheet();
  const activeSheetName = e.source && e.source.getActiveSheet ? e.source.getActiveSheet().getName() : '';
  const booksSheetName = CONFIG.booksSheetName || DEFAULT_BOOKS_SHEET;
  const booksSheet = spreadsheet.getSheetByName(booksSheetName);

  if (booksSheet && booksSheet.getName() !== activeSheetName) {
    booksSheet.appendRow([
      tsKST || '',
      code || '',
      title || '',
      author || '',
      borrower || '',
      status || ''
    ]);
    Logger.log(`📘 ${booksSheetName} 행 ${booksSheet.getLastRow()} 추가 완료 (${tsKST})`);
  }

  const newLineArr = [
    tsKST || '',
    code || '',
    title || '',
    author || '',
    borrower || '',
    status || ''
  ];

  updateBooksCSVOnGitHub(newLineArr);
}

function parseKoreanDateTime(koreanTime) {
  const timeStr = koreanTime ? koreanTime.toString() : '';
  if (!timeStr) {
    return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
  }

  const match = timeStr.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\s+(오전|오후)\s+(\d{1,2}):(\d{2}):(\d{2})/);

  if (!match) {
    Logger.log('⚠️ 시간 형식 매칭 실패, 현재 한국 시간을 사용합니다.');
    return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
  }

  const [, year, month, day, ampm, hour, minute, second] = match;
  let hour24 = parseInt(hour, 10);

  if (ampm === '오후' && hour24 !== 12) {
    hour24 += 12;
  } else if (ampm === '오전' && hour24 === 12) {
    hour24 = 0;
  }

  let kstHour = hour24 + 16;
  let kstDay = parseInt(day, 10);
  let kstMonth = parseInt(month, 10);
  let kstYear = parseInt(year, 10);

  if (kstHour >= 24) {
    kstHour -= 24;
    kstDay += 1;

    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (kstYear % 4 === 0 && (kstYear % 100 !== 0 || kstYear % 400 === 0)) {
      daysInMonth[1] = 29;
    }

    if (kstDay > daysInMonth[kstMonth - 1]) {
      kstDay = 1;
      kstMonth += 1;

      if (kstMonth > 12) {
        kstMonth = 1;
        kstYear += 1;
      }
    }
  }

  const paddedMonth = kstMonth.toString().padStart(2, '0');
  const paddedDay = kstDay.toString().padStart(2, '0');
  const paddedHour = kstHour.toString().padStart(2, '0');

  return `${kstYear}-${paddedMonth}-${paddedDay} ${paddedHour}:${minute}:${second}`;
}

function copyPreviousFormulas(sheet) {
  const newRow = sheet.getLastRow();
  if (newRow <= 1) {
    return;
  }

  const prevRow = newRow - 1;
  const lastColumn = sheet.getLastColumn();
  const previousFormulas = sheet.getRange(prevRow, 1, 1, lastColumn).getFormulasR1C1()[0];
  const newValues = sheet.getRange(newRow, 1, 1, lastColumn).getDisplayValues()[0];

  for (let col = 1; col <= lastColumn; col++) {
    const formula = previousFormulas[col - 1];
    if (!formula) {
      continue;
    }

    const currentValue = newValues[col - 1];
    if (currentValue !== '') {
      continue;
    }

    sheet.getRange(newRow, col).setFormulaR1C1(formula);
  }
}

function updateLibraryCSVOnGitHub(record) {
  if (!CONFIG.githubToken || !CONFIG.githubRepo) {
    Logger.log('ℹ️ GitHub 정보가 설정되지 않아 library.csv 업데이트를 건너뜁니다.');
    return;
  }

  if (!Array.isArray(record) || record.every(value => value === '')) {
    Logger.log('ℹ️ library.csv에 추가할 레코드가 비어 있어 업로드를 건너뜁니다.');
    return;
  }

  updateGitHubCsv({
    record,
    path: CONFIG.libraryCsvPath,
    mapper(values) {
      return [
        values[0] || '',
        values[1] || '',
        values[2] || '',
        values[3] || '',
        '',
        '',
        values[6] || '',
        '',
        ''
      ];
    },
    commitMessage: 'Append new book record to library.csv'
  });
}

function updateBooksCSVOnGitHub(values) {
  if (!CONFIG.githubToken || !CONFIG.githubRepo) {
    Logger.log('ℹ️ GitHub 정보가 설정되지 않아 books.csv 업데이트를 건너뜁니다.');
    return;
  }

  if (!Array.isArray(values) || values.every(value => value === '')) {
    Logger.log('ℹ️ books.csv에 추가할 레코드가 비어 있어 업로드를 건너뜁니다.');
    return;
  }

  updateGitHubCsv({
    record: values,
    path: CONFIG.booksCsvPath,
    mapper(arr) {
      return arr;
    },
    commitMessage: 'Append new loan record to books.csv'
  });
}

function updateGitHubCsv({ record, path, mapper, commitMessage }) {
  if (!Array.isArray(record)) {
    Logger.log('⚠️ CSV 업데이트를 위한 레코드가 비어 있습니다.');
    return;
  }

  const url = `https://api.github.com/repos/${CONFIG.githubRepo}/contents/${path}?ref=${CONFIG.githubBranch}`;

  try {
    const getRes = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'token ' + CONFIG.githubToken }
    });
    const getJson = JSON.parse(getRes.getContentText());
    const sha = getJson.sha;

    const decoded = Utilities.newBlob(Utilities.base64Decode(getJson.content)).getDataAsString('UTF-8');
    const newline = decoded.includes('\r\n') ? '\r\n' : '\n';
    const clean = decoded.replace(/(\r\n|\n|\r)+$/, '');
    const mapped = mapper ? mapper(record) : record;
    if (!Array.isArray(mapped)) {
      throw new Error('CSV mapper 함수가 배열을 반환하지 않았습니다.');
    }
    const newLine = mapped.map(value => value == null ? '' : value).join(',');
    const separator = clean ? newline : '';
    const updatedCsv = clean + separator + newLine;

    const encoded = Utilities.base64Encode(Utilities.newBlob(updatedCsv, 'text/csv').getBytes());

    const payload = {
      message: commitMessage,
      content: encoded,
      sha,
      branch: CONFIG.githubBranch
    };

    const putRes = UrlFetchApp.fetch(url, {
      method: 'put',
      headers: {
        Authorization: 'token ' + CONFIG.githubToken,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(payload)
    });

    Logger.log(`✅ GitHub CSV 업데이트 완료 (${path}): ${putRes.getResponseCode()}`);
  } catch (error) {
    Logger.log(`🚨 GitHub CSV 업데이트 실패 (${path}): ${error}`);
  }
}

function respondJson(body, callback) {
  const json = JSON.stringify(body);

  if (callback) {
    return ContentService.createTextOutput(`${callback}(${json})`).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

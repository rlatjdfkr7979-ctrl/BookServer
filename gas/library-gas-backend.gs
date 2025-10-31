/**
 * 📚 울산도시공사 도서관리 시스템 - Google Apps Script 백엔드
 *
 * 이 스크립트는 정적 CSV 대신 Google Sheets를 데이터베이스로 사용하기 위해
 * 작성되었습니다. Web App 으로 배포한 뒤 index.html 설정 모달에 URL을 입력하면
 * 프론트엔드에서 대출 이력/도서 목록을 모두 Google Sheets에서 읽어옵니다.
 */

const CONFIG = {
  spreadsheetId: 'PUT_YOUR_SPREADSHEET_ID_HERE', // TODO: 구글 시트 ID로 교체하세요.
  booksSheetName: PropertiesService.getScriptProperties().getProperty('BOOKS_SHEET_NAME') || 'Books',
  librarySheetName: PropertiesService.getScriptProperties().getProperty('LIBRARY_SHEET_NAME') || 'Library',
  wikiLogSheetName: PropertiesService.getScriptProperties().getProperty('WIKI_LOG_SHEET_NAME') || 'WikiLogs'
};

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
            booksSheetName: CONFIG.booksSheetName,
            librarySheetName: CONFIG.librarySheetName
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
        const values = getSheetValues(data.sheet || '');
        return respondJson({ success: true, data: values }, data.callback);
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
  const spreadsheet = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const normalized = (requestedName || '').toLowerCase();

  let targetName = requestedName;
  if (!targetName) {
    targetName = CONFIG.librarySheetName;
  } else if (normalized === 'books' || normalized === CONFIG.booksSheetName.toLowerCase()) {
    targetName = CONFIG.booksSheetName;
  } else if (normalized === 'library' || normalized === CONFIG.librarySheetName.toLowerCase()) {
    targetName = CONFIG.librarySheetName;
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

  const spreadsheet = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sheet = spreadsheet.getSheetByName(CONFIG.wikiLogSheetName) || spreadsheet.insertSheet(CONFIG.wikiLogSheetName);

  sheet.appendRow([
    new Date(),
    payload.wikiId || '',
    payload.pageId || '',
    (payload.content || '').slice(0, 50000)
  ]);
}

function respondJson(body, callback) {
  const json = JSON.stringify(body);

  if (callback) {
    return ContentService.createTextOutput(`${callback}(${json})`).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

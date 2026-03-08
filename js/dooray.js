/* ========================================
   📚 도서관리 시스템 - Dooray 연동 모듈
   ======================================== */

// 🚀 Dooray API 연동 모듈 (통합 버전)
class DoorayIntegration {
  constructor() {
    this.config = window.DOORAY_CONFIG || null;
    this.isEnabled = this.config && this.config.wikiId && this.config.pageId && localStorage.getItem('gas_backend_url');
    
    if (!this.isEnabled) {
      console.warn('🔧 Dooray 연동이 비활성화됨: Google Apps Script 백엔드 설정을 확인하세요');
    }
  }

  // 📡 Google Apps Script 백엔드를 통한 API 요청 (JSONP 방식으로 CORS 우회)
  makeApiRequest(action, additionalParams = {}) {
    if (!this.isEnabled) {
      console.warn('⚠️ Dooray API가 설정되지 않음');
      return Promise.resolve(null);
    }

    const GAS_BACKEND_URL = localStorage.getItem('gas_backend_url') || '';
    
    if (!GAS_BACKEND_URL) {
      return Promise.reject(new Error('Google Apps Script 백엔드 URL이 설정되지 않았습니다. 설정에서 URL을 입력해주세요.'));
    }

    const content = additionalParams.content;
    const isLongContent = content && content.length > 1000;
    
    if (isLongContent) {
      console.log('📄 긴 콘텐츠 감지, POST 요청 시도:', content.length, '글자');
      return this.makePostRequest(GAS_BACKEND_URL, action, additionalParams);
    }

    return new Promise((resolve, reject) => {
      const callbackName = 'jsonp_callback_' + Date.now();
      
      window[callbackName] = function(data) {
        console.log('✅ JSONP 콜백 성공:', { callbackName, data });
        
        delete window[callbackName];
        if (document.head.contains(script)) {
          document.head.removeChild(script);
        }
        
        if (data && data.error) {
          reject(new Error(data.error));
        } else {
          resolve(data);
        }
      };
      
      const script = document.createElement('script');
      const params = new URLSearchParams();
      params.append('action', action);
      params.append('wikiId', this.config.wikiId || '');
      params.append('pageId', this.config.pageId || '');
      params.append('callback', callbackName);
      
      Object.keys(additionalParams).forEach(key => {
        if (additionalParams[key] !== undefined && additionalParams[key] !== null) {
          const value = String(additionalParams[key]);
          
          if (key === 'content') {
            if (value.length > 1000) {
              const summary = this.createSimpleSummary(value, window.libraryData, window.unreturned);
              console.log('📄 긴 콘텐츠 감지, 요약 버전 사용:', {
                original: value.length,
                summary: summary.length
              });
              params.append(key, summary);
            } else {
              params.append(key, value);
            }
          } else {
            const truncatedValue = value.length > 500 ? value.substring(0, 500) + '...[truncated]' : value;
            params.append(key, truncatedValue);
          }
        }
      });
      
      const fullUrl = `${GAS_BACKEND_URL}?${params}`;
      
      if (fullUrl.length > 2000) {
        console.warn('⚠️ URL이 너무 깁니다. POST 요청으로 전환:', fullUrl.length);
        resolve(this.makePostRequest(GAS_BACKEND_URL, action, additionalParams));
        return;
      }
      
      script.src = fullUrl;
      console.log('🔄 JSONP 스크립트 로딩 시도:', {
        url: script.src.length > 200 ? script.src.substring(0, 200) + '...[truncated]' : script.src,
        callbackName,
        action,
        urlLength: script.src.length
      });
      
      script.onload = () => console.log('✅ JSONP 스크립트 로드 완료');
      script.onerror = (error) => {
        delete window[callbackName];
        if (document.head.contains(script)) {
          document.head.removeChild(script);
        }
        console.error('🚨 JSONP 스크립트 로드 실패:', error);
        reject(new Error(`Google Apps Script 요청 실패`));
      };
      
      setTimeout(() => {
        if (window[callbackName]) {
          console.error('❌ JSONP 요청 타임아웃');
          delete window[callbackName];
          if (document.head.contains(script)) {
            document.head.removeChild(script);
          }
          reject(new Error('Google Apps Script 요청 타임아웃 (30초)'));
        }
      }, 30000);
      
      document.head.appendChild(script);
    });
  }

  // 📤 POST 요청으로 긴 콘텐츠 처리
  async makePostRequest(gasUrl, action, additionalParams) {
    try {
      console.log('📤 POST 요청 시도:', {
        action,
        contentLength: additionalParams.content ? additionalParams.content.length : 0
      });

      const requestData = {
        action,
        wikiId: this.config.wikiId || '',
        pageId: this.config.pageId || '',
        callback: 'jsonp_callback_' + Date.now(),
        ...additionalParams
      };

      const response = await fetch(gasUrl, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ POST 요청 성공:', result);
      return result;

    } catch (fetchError) {
      console.warn('⚠️ POST 요청 실패, GET으로 폴백:', fetchError.message);
      
      const shortContent = additionalParams.content ? 
        this.shortenContent(additionalParams.content) : 
        additionalParams.content;
      
      const fallbackParams = { ...additionalParams, content: shortContent };

      return new Promise((resolve, reject) => {
        const callbackName = 'jsonp_callback_' + Date.now();
        
        window[callbackName] = function(data) {
          delete window[callbackName];
          if (document.head.contains(script)) {
            document.head.removeChild(script);
          }
          resolve(data);
        };
        
        const script = document.createElement('script');
        const params = new URLSearchParams({
          action,
          wikiId: this.config.wikiId || '',
          pageId: this.config.pageId || '',
          callback: callbackName,
          ...fallbackParams
        });
        
        script.src = `${gasUrl}?${params}`;
        script.onerror = () => {
          delete window[callbackName];
          if (document.head.contains(script)) {
            document.head.removeChild(script);
          }
          reject(new Error('GET 폴백도 실패했습니다.'));
        };
        
        document.head.appendChild(script);
      });
    }
  }

  // 📄 콘텐츠 단축 함수
  shortenContent(content) {
    if (!content || content.length <= 500) return content;

    const lines = content.split('\n');
    const title = lines.find(line => line.startsWith('# ')) || '# 📚 도서관리 현황';
    
    const statsRegex = /- \*\*전체 도서\*\*: (\d+)권/;
    const unreturnedRegex = /- \*\*미반납 도서\*\*: (\d+)권/;
    const returnRateRegex = /- \*\*반납률\*\*: ([\d.]+)%/;
    
    const totalMatch = content.match(statsRegex);
    const unreturnedMatch = content.match(unreturnedRegex);
    const returnRateMatch = content.match(returnRateRegex);
    const currentDate = new Date().toLocaleString('ko-KR');
    
    return `${title}

## 📊 요약 (${currentDate})
- 전체 도서: ${totalMatch ? totalMatch[1] : '?'}권
- 미반납 도서: ${unreturnedMatch ? unreturnedMatch[1] : '?'}권  
- 반납률: ${returnRateMatch ? returnRateMatch[1] : '?'}%

${unreturnedMatch && parseInt(unreturnedMatch[1]) === 0 ? 
  '🎉 모든 도서가 반납되었습니다!' : 
  `⚠️ ${unreturnedMatch ? unreturnedMatch[1] : '?'}권의 도서가 미반납 상태입니다.`}

---
*자동 생성된 요약 (원본 콘텐츠: ${content.length}자)*`;
  }

  // 📝 간단한 요약 생성 함수
  createSimpleSummary(fullContent, libraryData, unreturned) {
    if (!libraryData || !unreturned) {
      return fullContent.substring(0, 500) + '...[자동 축약됨]';
    }

    const currentDate = new Date().toLocaleString('ko-KR');
    
    return `# 도서관리 현황

**업데이트:** ${currentDate}

## 통계
- 전체 도서: ${libraryData.length - 1}권
- 미반납 도서: ${unreturned.length}권
- 반납률: ${((libraryData.length - 1 - unreturned.length) / (libraryData.length - 1) * 100).toFixed(1)}%

## 상태
${unreturned.length === 0 ? 
  '✅ 모든 도서가 반납되었습니다!' : 
  `⚠️ ${unreturned.length}권의 도서가 미반납 상태입니다.`}

${unreturned.length > 0 ? `

### 미반납 도서 (처음 5권)
${unreturned.slice(0, 5).map((book, index) => 
  `${index + 1}. ${book.title || '제목없음'} - ${book.borrower || '정보없음'}`
).join('\n')}

${unreturned.length > 5 ? `... 외 ${unreturned.length - 5}권 더` : ''}
` : ''}

---
*자동 생성 보고서*`;
  }

  // 💬 메신저 알림 전송
  async sendNotification(message, channelId = null) {
    if (!this.isEnabled || !this.config.settings.enableMessaging) {
      console.log('📢 알림 (Dooray 비활성화):', message);
      return false;
    }

    if (!channelId) {
      console.warn('⚠️ 메신저 채널 ID가 설정되지 않음');
      return false;
    }

    try {
      const url = window.DOORAY_ENDPOINTS.messenger.send(channelId);
      const data = {
        text: message,
        botName: '📚 도서관리봇'
      };

      const result = await this.makeApiRequest(url, 'POST', data);
      
      if (result) {
        console.log('✅ Dooray 메신저 알림 전송 완료');
        return true;
      }
    } catch (error) {
      console.error('🚨 메신저 알림 전송 실패:', error);
    }
    
    return false;
  }

  // 🔔 도서 대출/반납 알림
  async notifyBookAction(action, bookInfo) {
    const { title, author, borrower, code } = bookInfo;
    let message = '';

    switch (action) {
      case 'borrow':
        message = `📕 **도서 대출 알림**\n• 도서: ${title}\n• 저자: ${author}\n• 대출자: ${borrower}\n• 코드: ${code}\n• 시간: ${new Date().toLocaleString('ko-KR')}`;
        break;
      case 'return':
        message = `📗 **도서 반납 알림**\n• 도서: ${title}\n• 저자: ${author}\n• 반납자: ${borrower}\n• 코드: ${code}\n• 시간: ${new Date().toLocaleString('ko-KR')}`;
        break;
      case 'overdue':
        message = `⚠️ **연체 도서 알림**\n• 도서: ${title}\n• 저자: ${author}\n• 대출자: ${borrower}\n• 코드: ${code}\n• 상태: 반납 기한 초과`;
        break;
    }

    return await this.sendNotification(message);
  }

  // 📬 예약 DM 발송 (대출자에게 반납 요청)
  async sendReservationDM(borrowerName, bookTitle, reserverName) {
    const GAS_BACKEND_URL = localStorage.getItem('gas_backend_url') || '';
    if (!GAS_BACKEND_URL) {
      return { success: false, error: 'Google Apps Script 백엔드 URL이 설정되지 않았습니다.' };
    }

    return new Promise((resolve) => {
      const callbackName = 'jsonp_callback_' + Date.now();

      window[callbackName] = function(data) {
        delete window[callbackName];
        if (document.head.contains(script)) document.head.removeChild(script);
        resolve(data);
      };

      const script = document.createElement('script');
      const params = new URLSearchParams({
        action: 'sendReservationDM',
        borrowerName,
        bookTitle,
        reserverName,
        callback: callbackName
      });

      script.src = `${GAS_BACKEND_URL}?${params}`;
      script.onerror = () => {
        delete window[callbackName];
        if (document.head.contains(script)) document.head.removeChild(script);
        resolve({ success: false, error: 'GAS 연결 실패: 스크립트 로드 오류' });
      };

      setTimeout(() => {
        if (window[callbackName]) {
          delete window[callbackName];
          if (document.head.contains(script)) document.head.removeChild(script);
          resolve({ success: false, error: 'GAS 요청 타임아웃 (30초)' });
        }
      }, 30000);

      document.head.appendChild(script);
    });
  }

  // 📥 예약 저장
  async saveReservation(bookCode, bookTitle, borrowerName, reserverName) {
    const GAS_BACKEND_URL = localStorage.getItem('gas_backend_url') || '';
    if (!GAS_BACKEND_URL) return { success: false, error: 'GAS URL이 설정되지 않았습니다.' };

    return new Promise((resolve) => {
      const callbackName = 'jsonp_cb_' + Date.now();
      window[callbackName] = (data) => {
        delete window[callbackName];
        if (document.head.contains(script)) document.head.removeChild(script);
        resolve(data);
      };
      const script = document.createElement('script');
      script.src = GAS_BACKEND_URL + '?' + new URLSearchParams({
        action: 'saveReservation', bookCode, bookTitle, borrowerName, reserverName, callback: callbackName
      });
      script.onerror = () => {
        delete window[callbackName];
        if (document.head.contains(script)) document.head.removeChild(script);
        resolve({ success: false, error: 'GAS 연결 실패' });
      };
      setTimeout(() => {
        if (window[callbackName]) {
          delete window[callbackName];
          if (document.head.contains(script)) document.head.removeChild(script);
          resolve({ success: false, error: '요청 타임아웃' });
        }
      }, 30000);
      document.head.appendChild(script);
    });
  }

  // 📋 예약 목록 조회 (bookCode 빈 문자열 = 전체)
  async getReservations(bookCode = '') {
    const GAS_BACKEND_URL = localStorage.getItem('gas_backend_url') || '';
    if (!GAS_BACKEND_URL) return { success: false, error: 'GAS URL이 설정되지 않았습니다.' };

    return new Promise((resolve) => {
      const callbackName = 'jsonp_cb_' + Date.now();
      window[callbackName] = (data) => {
        delete window[callbackName];
        if (document.head.contains(script)) document.head.removeChild(script);
        resolve(data);
      };
      const script = document.createElement('script');
      script.src = GAS_BACKEND_URL + '?' + new URLSearchParams({
        action: 'getReservations', bookCode, callback: callbackName
      });
      script.onerror = () => {
        delete window[callbackName];
        if (document.head.contains(script)) document.head.removeChild(script);
        resolve({ success: false, error: 'GAS 연결 실패' });
      };
      setTimeout(() => {
        if (window[callbackName]) {
          delete window[callbackName];
          if (document.head.contains(script)) document.head.removeChild(script);
          resolve({ success: false, error: '요청 타임아웃' });
        }
      }, 30000);
      document.head.appendChild(script);
    });
  }

  // ❌ 예약 취소
  async cancelReservation(reservationId) {
    const GAS_BACKEND_URL = localStorage.getItem('gas_backend_url') || '';
    if (!GAS_BACKEND_URL) return { success: false, error: 'GAS URL이 설정되지 않았습니다.' };

    return new Promise((resolve) => {
      const callbackName = 'jsonp_cb_' + Date.now();
      window[callbackName] = (data) => {
        delete window[callbackName];
        if (document.head.contains(script)) document.head.removeChild(script);
        resolve(data);
      };
      const script = document.createElement('script');
      script.src = GAS_BACKEND_URL + '?' + new URLSearchParams({
        action: 'cancelReservation', reservationId, callback: callbackName
      });
      script.onerror = () => {
        delete window[callbackName];
        if (document.head.contains(script)) document.head.removeChild(script);
        resolve({ success: false, error: 'GAS 연결 실패' });
      };
      setTimeout(() => {
        if (window[callbackName]) {
          delete window[callbackName];
          if (document.head.contains(script)) document.head.removeChild(script);
          resolve({ success: false, error: '요청 타임아웃' });
        }
      }, 30000);
      document.head.appendChild(script);
    });
  }

  // 🧪 연결 테스트
  async testConnection() {
    if (!this.isEnabled) {
      return {
        success: false,
        message: 'Dooray 설정이 없습니다. 프로젝트/포스트 ID를 입력하세요.'
      };
    }

    try {
      const result = await this.makeApiRequest('test');
      
      if (result.success) {
        return {
          success: true,
          message: result.message,
          data: result.data
        };
      } else {
        return {
          success: false,
          message: result.message || 'Google Apps Script 백엔드 연결 실패'
        };
      }
    } catch (error) {
      let errorMessage = `연결 테스트 실패: ${error.message}`;
      
      if (error.message.includes('백엔드 URL')) {
        errorMessage += `\n\n🔧 Google Apps Script 백엔드 설정 방법:\n1. library-gas-backend.js 파일을 Google Apps Script에 배포\n2. 웹앱으로 배포 후 URL 복사\n3. 아래 백엔드 URL 설정에 입력`;
      }
      
      return {
        success: false,
        message: errorMessage
      };
    }
  }
}

// 🌐 전역 인스턴스 생성
window.doorayIntegration = new DoorayIntegration();
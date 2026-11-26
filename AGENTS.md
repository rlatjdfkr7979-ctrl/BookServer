# AGENTS.md

울산도시공사 도서관리 시스템. 빌드 없는 정적 웹앱(GitHub Pages)과 Google Apps Script(GAS) 백엔드로 구성된다.
응답과 UI 문구는 한국어를 사용한다.

## 구성

```
index.html            메인 화면 (스크립트를 순서대로 로드)
css/styles.css
js/config.js          설정 상수 (GAS URL, 폼 URL, 페이지당 항목 수)
js/table.js           테이블 상태/렌더링/정렬/페이지네이션, parseDate, escapeHtml
js/ui.js              검색 바인딩, QR, 토스트, 도서 모달, Google Books 매칭
js/main.js            초기화(CSV 로드), 필터/버튼 핸들러, Dooray 모달
js/dooray.js          GAS 호출(JSONP/POST) 래퍼
js/reservation*.js    예약 / 예약 현황 패널
js/book-request*.js   도서 신청 / 신청 현황 패널
js/reviews.js         리뷰
appscript.gas         GAS 백엔드 소스 (Apps Script 편집기에 수동 반영)
books.csv             대출/반납 이력 (GAS가 GitHub API로 한 줄씩 추가)
library.csv           전체 도서 목록 (GAS가 GitHub API로 한 줄씩 추가)
```

스크립트 로드 순서가 의존성이다: `config → table → ui → dooray → reservation → ... → main`. 순서를 바꾸지 말 것.

## 실행 / 테스트

- 빌드, 패키지 매니저, 테스트 프레임워크 없음. `index.html`을 로컬 정적 서버로 열어 확인한다.
- CSV를 `fetch`로 읽으므로 `file://`로는 동작하지 않는다.
- 변경 후에는 브라우저 콘솔 오류와 아래 동작을 직접 확인한다: 검색 후 페이지 이동, 필터와 검색 동시 적용, 헤더 정렬, 도서 모달(정보/이력/리뷰).

## 데이터 모델

- `books.csv` 헤더: `등록일,도서코드,도서명,저자명,대여자명,상태`
- `library.csv` 헤더: `코드번호,제목,지은이,출판사,대출여부,대출자,장르,상태,기타`
- 도서별 현재 상태는 **`books.csv`에서 코드별 마지막 행**으로 정한다(파일 순서가 곧 시간순이라는 가정). 행 순서를 바꾸지 말 것.
- 열은 **헤더 이름으로 찾는다**(`findColIndex`). 열 번호를 하드코딩하지 말 것.
- 대출 기간: 장르에 `전공·자격증·어학`이 포함되면 90일, 그 외 30일(`main.js`).
- 날짜는 `parseDate`로만 파싱한다(`new Date(문자열)` 금지, 브라우저별 차이).

## 테이블 상태 구조 (table.js)

테이블마다 `getTableState(id)`가 `{source, filter, newest, query, sort, withQR}`를 가진다.
표시 목록은 항상 `computeView` 한 곳에서 `필터 → 검색 → 최신순 → 정렬` 순으로 계산하고, `refreshTable(id)`가 그린다.

- 검색, 필터, 정렬, 페이지 이동은 **상태만 바꾸고 `refreshTable`을 호출**한다. `allTableData`를 직접 덮어쓰지 말 것(과거 페이지 이동 시 검색 초기화 버그의 원인).
- 입력창 이벤트는 한 번만 바인딩한다(`addSearch`). `cloneNode`로 교체하지 말 것(입력값이 사라진다).
- `window.applyAllFilters(keepPage)`는 현재 보이는 테이블에 필터를 적용한다. 예약 뱃지 갱신은 `window.updateReservationBadges()`(페이지/검색 유지).

## 보안 규칙

- `innerHTML`에 CSV, Google Books 응답, 사용자 입력을 넣을 때는 반드시 `escapeHtml`을 쓴다. 가능하면 `textContent`를 쓴다.
- **비밀값을 코드나 git에 넣지 않는다.** 토큰과 API 키는 GAS 스크립트 속성에만 둔다.
  - `GITHUB_TOKEN`, `GOOGLE_BOOKS_API_KEY`, `DOORAY_TOKEN`, (필요 시) `SPREADSHEET_ID`
  - 로컬 보관용 `.env`는 `.gitignore`에 포함돼 있다. 목록은 `.env.example` 참고. `.env`를 커밋하거나 내용을 출력하지 말 것.
- JSONP 콜백 이름은 `^[A-Za-z0-9_.$]+$`만 허용한다(`doGet`).

## GAS 백엔드 (appscript.gas)

- 웹앱 URL은 `config.js`의 `DEFAULT_GAS_BACKEND_URL`이다. 프론트는 JSONP(GET)로 호출하고 긴 본문만 POST를 쓴다.
- 액션: `sendReservationDM`, `saveReservation`, `getReservations`, `cancelReservation`, `saveBookRequest`, `getBookRequests`, `updateBookRequestStatus`, `saveReview`, `getReviews`, `searchBooks`.
- `searchBooks`는 Google Books 프록시다. 서버 호출은 위치를 알 수 없어 403 `unknownLocation`이 나므로 `country=KR`을 반드시 붙인다. 결과는 6시간 캐시한다.
- `appscript.gas`를 고쳐도 **자동 반영되지 않는다.** Apps Script 편집기에 붙여 넣고 `배포 > 배포 관리 > 새 버전`으로 배포해야 한다(URL은 유지). 코드 변경 시 이 단계를 사용자에게 안내한다.
- 폼 제출 트리거가 `books.csv` / `library.csv`를 GitHub API로 갱신하고 커밋한다. 이 커밋(`Append new ...`)은 자동 생성이므로 건드리지 않는다.

## Google Books 매칭 (ui.js)

- 검색은 `intitle:"제목" inauthor:"저자"` → `intitle:"제목"` → `제목 저자` 순으로 시도한다.
- 제목 유사도 + 저자 일치로 점수를 매기고, 기준 미만(`BOOK_MATCH_MIN_TITLE`, `BOOK_MATCH_MIN_TOTAL`)이면 **엉뚱한 책을 보여주지 않고 "찾을 수 없음"**으로 처리한다. 첫 번째 결과를 기본값으로 쓰지 말 것.
- 결과 캐시는 `localStorage`의 `bk2_` 접두사 키(24시간). 매칭 로직을 바꾸면 접두사 버전을 올려 이전 결과를 무효화한다.

## 작업 시 주의

- 파일은 CRLF 줄바꿈이다. 편집 시 줄바꿈을 바꾸지 말 것(전체 파일 diff 방지).
- 스타일은 기존 방식(`css/styles.css` + 일부 인라인)을 따른다. 프레임워크나 번들러를 새로 도입하지 않는다.
- 커밋/푸시는 사용자가 요청할 때만 한다.

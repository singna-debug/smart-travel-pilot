/**
 * Google Sheets Auto-formatting Script
 * 
 * 기능:
 * 1. 전화번호 정규화 (C열): 01012345678 -> 010-1234-5678
 * 2. 날짜 정규화 (E열): 2024.3.15 -> 2024-03-15
 * 3. 귀국일 자동 계산 (F열): 출발일(E열) + 기간(G열) -> 귀국일 자동 입력
 * 
 * 설치 방법:
 * Google Sheets 메뉴 -> 확장 프로그램 -> Apps Script -> 코드 복사 붙여넣기 -> 저장
 */

function onEdit(e) {
  var sheet = e.source.getActiveSheet();
  var range = e.range;
  var col = range.getColumn();
  var row = range.getRow();
  var val = range.getValue();
  
  // 헤더 행 제외
  if (row <= 1) return;
  
  // 1. 전화번호 정규화 (C열 = 3)
  if (col === 3 && val) {
    var phone = val.toString().replace(/[^0-9]/g, ''); // 숫자만 추출
    if (phone.length === 11 && phone.startsWith('010')) {
      var formatted = phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
      if (val !== formatted) {
        range.setValue(formatted);
      }
    }
  }
  
  // 2. 날짜 정규화 (E열 = 5)
  if (col === 5 && val) {
    var dateStr = val.toString();
    // 이미 Date 객체인 경우 포맷만 변경
    if (Object.prototype.toString.call(val) === '[object Date]') {
      var formatted = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      range.setValue(formatted);
      calculateReturnDate(sheet, row); // 귀국일 재계산
    } else {
      // 텍스트로 입력된 날짜 처리 (2024.3.15, 2024/3/15 등)
      var normalized = dateStr.replace(/\./g, '-').replace(/\//g, '-');
      // "3월 15일" 같은 형식 처리
      if (normalized.includes('월') && normalized.includes('일')) {
        var parts = normalized.match(/(\d+)월\s*(\d+)일/);
        if (parts) {
          var year = new Date().getFullYear();
          normalized = year + '-' + parts[1] + '-' + parts[2];
        }
      }
      
      var date = new Date(normalized);
      if (!isNaN(date.getTime())) {
        var formatted = Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        if (val !== formatted) {
          range.setValue(formatted);
          calculateReturnDate(sheet, row); // 귀국일 재계산
        }
      }
    }
  }
  
  // 3. 기간 입력 시 귀국일 자동 계산 (G열 = 7)
  if (col === 7 && val) {
    calculateReturnDate(sheet, row);
  }
}

function calculateReturnDate(sheet, row) {
  var departureDateCell = sheet.getRange(row, 5); // E열 (출발일)
  var durationCell = sheet.getRange(row, 7);      // G열 (기간)
  var returnDateCell = sheet.getRange(row, 6);    // F열 (귀국일)
  
  var departureVal = departureDateCell.getValue();
  var durationVal = durationCell.getValue();
  
  if (!departureVal || !durationVal) return;
  
  var departureDate = new Date(departureVal);
  if (isNaN(departureDate.getTime())) return;
  
  // 기간에서 숫자(박) 추출 (예: "3박4일" -> 3, "5일" -> 4(5-1? 보통 박수 기준))
  // 여행사 통상 "N박" 기준으로 귀국일 계산: 출발일 + N일
  var nights = 0;
  
  var durationStr = durationVal.toString();
  var nightMatch = durationStr.match(/(\d+)박/);
  
  if (nightMatch) {
    nights = parseInt(nightMatch[1]);
  } else {
    // "박"이 없으면 숫자를 일수로 간주하고 -1 (예: 5일 -> 4박)
    var dayMatch = durationStr.match(/(\d+)일/);
    if (dayMatch) {
      nights = parseInt(dayMatch[1]) - 1;
    } else if (!isNaN(parseInt(durationStr))) {
       nights = parseInt(durationStr); // 숫자만 있으면 박수로 간주
    }
  }
  
  if (nights > 0) {
    var returnDate = new Date(departureDate);
    returnDate.setDate(departureDate.getDate() + nights + 1); // N박(N+1)일 -> 귀국일은 출발일 + (N+1)일이 아니라...
    // 예: 1일 출발, 3박4일 -> 1일(1일차), 2일(2일차), 3일(3일차), 4일(4일차/귀국)
    // 날짜 계산: 1일 + 3(박) = 4일. 즉 출발일 + 박수 = 귀국일
    
    // 다시 수정: 3박4일이면 출발일로부터 3일 뒤가 아니라...
    // 1일 체크인 -> 1박 -> 2일 체크아웃. (1+1=2)
    // 1일 출발 -> 3박4일 -> 4일 귀국. (1+3=4)
    // 따라서 departureDate + nights 가 맞음.
    
    // 하지만 위 코드에서는 nights를 추출했음.
    // 변수명 재정의: nights는 '박' 수.
    
    returnDate = new Date(departureDate);
    returnDate.setDate(departureDate.getDate() + nights); // 출발일 + 박수 = 귀국일
    
    var formattedReturn = Utilities.formatDate(returnDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    returnDateCell.setValue(formattedReturn);
  }
}

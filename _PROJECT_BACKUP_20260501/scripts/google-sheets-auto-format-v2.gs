/**
 * Google Sheets Auto-formatting Script (Debug Version)
 * 
 * 기능:
 * 1. 전화번호 정규화 (C열)
 * 2. 날짜 정규화 (E열)
 * 3. 귀국일 자동 계산 (F열)
 * 4. [NEW] 상단 메뉴 '🛠️ 스마트 여행' 추가 -> 수동 실행 가능
 */

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('🛠️ 스마트 여행')
      .addItem('선택된 행 포맷팅 실행', 'formatSelectedRow')
      .addToUi();
}

function onEdit(e) {
  // 에러 방지를 위한 안전 장치
  if (!e) return;
  
  var sheet = e.source.getActiveSheet();
  var range = e.range;
  var col = range.getColumn();
  var row = range.getRow();
  var val = range.getValue();
  
  if (row <= 1) return;
  
  processCell(sheet, row, col, val, range);
}

// 수동 실행 함수
function formatSelectedRow() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var range = sheet.getActiveRange();
  var row = range.getRow();
  var val = range.getValue();
  var col = range.getColumn();
  
  if (row <= 1) {
    SpreadsheetApp.getUi().alert('헤더 행(1행)은 처리할 수 없습니다.');
    return;
  }
  
  processCell(sheet, row, col, val, range);
  
  // 강제로 다른 컬럼들도 체크 (전화번호, 날짜, 기간 모두)
  var phoneVal = sheet.getRange(row, 3).getValue();
  if (phoneVal) processCell(sheet, row, 3, phoneVal, sheet.getRange(row, 3));
  
  var departureVal = sheet.getRange(row, 5).getValue();
  if (departureVal) processCell(sheet, row, 5, departureVal, sheet.getRange(row, 5));
  
  var durationVal = sheet.getRange(row, 7).getValue();
  if (durationVal) processCell(sheet, row, 7, durationVal, sheet.getRange(row, 7));
  
  SpreadsheetApp.getUi().alert('포맷팅이 완료되었습니다!');
}

function processCell(sheet, row, col, val, range) {
  if (!val) return;
  
  // 1. 전화번호 정규화 (C열 = 3)
  if (col === 3) {
    var phone = val.toString().replace(/[^0-9]/g, '');
    if (phone.length === 11 && phone.startsWith('010')) {
      var formatted = phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
      if (val !== formatted) {
        range.setValue(formatted);
      }
    }
  }
  
  // 2. 날짜 정규화 (E열 = 5)
  if (col === 5) {
    var dateStr = val.toString();
    if (Object.prototype.toString.call(val) === '[object Date]') {
      var formatted = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      range.setValue(formatted);
      calculateReturnDate(sheet, row);
    } else {
      // 2024.3.15, 2024/3/15 등 처리
      var normalized = dateStr.replace(/\./g, '-').replace(/\//g, '-');
      // "3월 15일" 처리
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
          calculateReturnDate(sheet, row);
        }
      }
    }
  }
  
  // 3. 기간 입력 시 귀국일 자동 계산 (G열 = 7)
  if (col === 7) {
    calculateReturnDate(sheet, row);
  }
}

function calculateReturnDate(sheet, row) {
  var departureDateCell = sheet.getRange(row, 5); // E열
  var durationCell = sheet.getRange(row, 7);      // G열
  var returnDateCell = sheet.getRange(row, 6);    // F열
  
  var departureVal = departureDateCell.getValue();
  var durationVal = durationCell.getValue();
  
  if (!departureVal || !durationVal) return;
  
  var departureDate = new Date(departureVal);
  if (isNaN(departureDate.getTime())) return;
  
  var nights = 0;
  var durationStr = durationVal.toString();
  var nightMatch = durationStr.match(/(\d+)박/);
  
  if (nightMatch) {
    nights = parseInt(nightMatch[1]);
  } else {
    var dayMatch = durationStr.match(/(\d+)일/);
    if (dayMatch) {
      nights = parseInt(dayMatch[1]) - 1; // 5일 -> 4박으로 계산
      if (nights < 0) nights = 0; // 당일치기
    } else if (!isNaN(parseInt(durationStr))) {
       nights = parseInt(durationStr);
    }
  }
  
  // 귀국일 = 출발일 + 박수
  var returnDate = new Date(departureDate);
  returnDate.setDate(departureDate.getDate() + nights);
  
  var formattedReturn = Utilities.formatDate(returnDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  returnDateCell.setValue(formattedReturn);
}

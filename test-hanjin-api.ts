// Test 9: Full schedule data dump to find itinerary text
async function fullScheduleDump() {
  const evtNo = 'OP202609240372';
  const gdsNo = 'KWJPN0080';

  // 1. Full schedule response
  const schedRes = await fetch(`https://www.hanjintravel.com/api/v1/dp/display/schedule?evtNo=${evtNo}`);
  const schedJson = await schedRes.json();
  
  console.log('=== Schedule Response Top Keys ===');
  console.log(Object.keys(schedJson));
  
  // Show all keys that have data
  for (const [key, val] of Object.entries(schedJson)) {
    if (val && key !== 'result' && key !== 'resultCode' && key !== 'resultMsg' && key !== 'errorCode' && key !== 'errorMsg' && key !== 'errorRowId') {
      if (Array.isArray(val)) {
        console.log(`\n${key}: Array of ${(val as any[]).length} items`);
        if ((val as any[]).length > 0) {
          console.log('Item keys:', Object.keys((val as any[])[0]));
          // Dump first item fully
          console.log('First item:', JSON.stringify((val as any[])[0], null, 2));
        }
      } else if (typeof val === 'object') {
        console.log(`\n${key}: Object with keys:`, Object.keys(val as object));
        console.log(JSON.stringify(val, null, 2).substring(0, 500));
      } else {
        console.log(`\n${key}:`, val);
      }
    }
  }

  // 2. Also try to find schedule detail/spot endpoints
  console.log('\n\n=== LOOKING FOR SCHEDULE DETAIL APIS ===');
  const moreEndpoints = [
    `https://www.hanjintravel.com/api/v1/dp/display/schedule-detail?evtNo=${evtNo}`,
    `https://www.hanjintravel.com/api/v1/dp/display/schedule-spot?evtNo=${evtNo}`,
    `https://www.hanjintravel.com/api/v1/dp/display/spot?evtNo=${evtNo}`,
    `https://www.hanjintravel.com/api/v1/dp/display/event-spot?evtNo=${evtNo}`,
    `https://www.hanjintravel.com/api/v1/dp/display/schedule?evtNo=${evtNo}&schdlSn=8`,
    `https://www.hanjintravel.com/api/v1/dp/display/schedule?evtNo=${evtNo}&type=detail`,
    `https://www.hanjintravel.com/api/v1/dp/goods/schedule?gdsNo=${gdsNo}&evtNo=${evtNo}`,
    `https://www.hanjintravel.com/api/v1/dp/display/goods-description?gdsNo=${gdsNo}`,
    `https://www.hanjintravel.com/api/v1/dp/display/goods-desc?gdsNo=${gdsNo}`,
    `https://www.hanjintravel.com/api/v1/dp/goods/detail?gdsNo=${gdsNo}`,
    `https://www.hanjintravel.com/api/v1/dp/goods/description?gdsNo=${gdsNo}`,
  ];

  for (const url of moreEndpoints) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      const shortPath = url.split('/api/v1/')[1];
      if (res.status === 200 && text.length > 100) {
        console.log(`\n✅ [${res.status}] ${shortPath} (${text.length} bytes)`);
        // Try to parse and show keys
        try {
          const json = JSON.parse(text);
          const keys = Object.keys(json);
          console.log('  Keys:', keys.join(', '));
          // Show any key that has content
          for (const k of keys) {
            if (json[k] && k !== 'result' && k !== 'resultCode' && k !== 'resultMsg' && !k.includes('error')) {
              if (typeof json[k] === 'string' && json[k].length > 10) {
                console.log(`  ${k}: ${json[k].substring(0, 200)}`);
              } else if (Array.isArray(json[k]) && json[k].length > 0) {
                console.log(`  ${k}: Array[${json[k].length}] first keys:`, Object.keys(json[k][0]).join(', '));
              }
            }
          }
        } catch {}
      } else {
        console.log(`[${res.status}] ${shortPath}`);
      }
    } catch {}
  }
}

fullScheduleDump();

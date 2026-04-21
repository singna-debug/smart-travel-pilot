const headers = {
  'modewebapireqheader': JSON.stringify({WebSiteNo:2,CompanyNo:81202,DeviceType:"DVTPC",ApiKey:"jm9i5RUzKPMPdklHzDKqNzwZYy0IGV5hTyKkCcpxO0IGIgVS+8Z7NnbzbARv5w7Bn90KT13Gq79XZMow6TYvwQ=="}),
  'referer': 'https://www.modetour.com/',
  'accept': 'application/json'
};

async function testProduct(pNo) {
  try {
    const res = await fetch(`https://b2c-api.modetour.com/Package/GetScheduleList?productNo=${pNo}`, { headers });
    const d = await res.json();
    if (d.result?.scheduleItemList?.length > 0) {
      return d.result.scheduleItemList;
    }
    return null;
  } catch { return null; }
}

async function main() {
  // Try wide range
  const ranges = [1080000, 1075000, 1060000, 1055000, 1050000, 1045000, 1040000, 1035000, 1030000, 1020000, 1010000, 1000000];
  
  for (const base of ranges) {
    for (let i = 0; i < 200; i += 5) {
      const pNo = base + i;
      const items = await testProduct(String(pNo));
      if (items) {
        console.log(`\n✅ FOUND productNo=${pNo}, days=${items.length}`);
        const day = items[0];
        console.log('DAY1 KEYS:', Object.keys(day));
        console.log('placeHeader:', day.placeHeader);
        console.log('ortherActions:', day.ortherActions?.length || 0);
        console.log('allPlaceTravelToday:', day.allPlaceTravelToday?.length || 0);
        console.log('listMealPlace:', day.listMealPlace?.length || 0);
        console.log('scheduleHotel:', day.scheduleHotel);
        
        if (day.ortherActions?.length > 0) {
          console.log('\n=== ortherActions[0] keys ===');
          console.log(Object.keys(day.ortherActions[0]));
          console.log('sample:', JSON.stringify(day.ortherActions[0]).substring(0, 500));
        }
        if (day.listMealPlace?.length > 0) {
          console.log('\n=== ALL meals ===');
          day.listMealPlace.forEach((m,i) => console.log(`  [${i}] code=${m.itiServiceCode} name=${m.itiPlaceName}`));
        }
        
        // Check day 2 meals too
        if (items.length > 1 && items[1].listMealPlace?.length > 0) {
          console.log('\n=== DAY2 meals ===');
          items[1].listMealPlace.forEach((m,i) => console.log(`  [${i}] code=${m.itiServiceCode} name=${m.itiPlaceName}`));
        }
        return;
      }
    }
    process.stdout.write('.');
  }
  console.log('\nNo product found');
}

main();

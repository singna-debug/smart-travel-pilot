async function testYbApis() {
  const evCd = 'ATH3014-260725OZ00';
  const goodsCd = 'ATH3014';

  const endpoints = [
    `https://prdt.ybtour.co.kr/api/product/schedule?evCd=${evCd}`,
    `https://prdt.ybtour.co.kr/api/product/eventSchedule?evCd=${evCd}`,
    `https://prdt.ybtour.co.kr/api/v1/product/schedule?evCd=${evCd}`,
    `https://prdt.ybtour.co.kr/product/getEventSchedule?evCd=${evCd}`,
    `https://prdt.ybtour.co.kr/product/eventScheduleDetail?evCd=${evCd}`,
    `https://api.ybtour.co.kr/product/schedule?evCd=${evCd}`,
    `https://prdt.ybtour.co.kr/api/event/schedule?evCd=${evCd}`,
    `https://prdt.ybtour.co.kr/api/goods/schedule?goodsCd=${goodsCd}`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://prdt.ybtour.co.kr/' }
      });
      console.log(`[${res.status}] ${url} (${(await res.text()).length} bytes)`);
    } catch (e: any) {
      console.log(`[ERR] ${url}: ${e.message}`);
    }
  }

  // Also check Next JS bundle scripts
  const res = await fetch('https://prdt.ybtour.co.kr/product/detailPackage?menu=HYM&dspSid=AGIA002&evCd=' + evCd, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const html = await res.text();
  const chunkMatches = html.match(/\/_next\/static\/chunks\/[^"'\s]+\.js/g);
  console.log('\nFound', chunkMatches?.length, 'chunk scripts');

  if (chunkMatches) {
    for (const chunk of chunkMatches.slice(0, 5)) {
      const chunkRes = await fetch('https://prdt.ybtour.co.kr' + chunk);
      const js = await chunkRes.text();
      const apiMatches = js.match(/\/api\/[a-zA-Z0-9_\/]+/g) || js.match(/\/product\/[a-zA-Z0-9_\/]+/g);
      if (apiMatches) {
        console.log(`Endpoints in ${chunk.split('/').pop()}:`, Array.from(new Set(apiMatches)).slice(0, 10));
      }
    }
  }
}
testYbApis();

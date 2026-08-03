async function findEventInfoApis() {
  const evCd = 'ATH3014-260725OZ00';

  // Search across all JS chunks for /api/ patterns
  const res = await fetch('https://prdt.ybtour.co.kr/product/detailPackage?menu=HYM&dspSid=AGIA002&evCd=' + evCd, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const html = await res.text();
  const chunkMatches = html.match(/\/_next\/static\/chunks\/[^"'\s]+\.js/g);

  const foundApis = new Set<string>();

  if (chunkMatches) {
    for (const chunk of chunkMatches) {
      const chunkRes = await fetch('https://prdt.ybtour.co.kr' + chunk);
      const js = await chunkRes.text();
      const matches = js.match(/["']\/api\/[^"']+["']/g);
      if (matches) {
        matches.forEach(m => foundApis.add(m.replace(/["']/g, '')));
      }
    }
  }

  console.log('=== ALL FOUND API PATHS ===');
  for (const api of Array.from(foundApis).sort()) {
    console.log(api);
  }
}
findEventInfoApis();

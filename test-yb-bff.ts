async function findProductEndpoints() {
  const evCd = 'ATH3014-260725OZ00';
  const goodsCd = 'ATH3014';

  const res = await fetch('https://prdt.ybtour.co.kr/product/detailPackage?menu=HYM&dspSid=AGIA002&evCd=' + evCd, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const html = await res.text();
  const chunkMatches = html.match(/\/_next\/static\/chunks\/[^"'\s]+\.js/g);

  if (chunkMatches) {
    for (const chunk of chunkMatches) {
      const chunkRes = await fetch('https://prdt.ybtour.co.kr' + chunk);
      const js = await chunkRes.text();
      const matches = js.match(/['"]\/api\/[a-zA-Z0-9_\/-]+['"]/g);
      if (matches) {
        const cleaned = matches.map(m => m.replace(/['"]/g, ''));
        const filtered = Array.from(new Set(cleaned)).filter(m => m.includes('event') || m.includes('goods') || m.includes('schedule') || m.includes('product') || m.includes('detail') || m.includes('pack'));
        if (filtered.length > 0) {
          console.log(`Endpoints in ${chunk.split('/').pop()}:`, filtered);
        }
      }
    }
  }
}
findProductEndpoints();

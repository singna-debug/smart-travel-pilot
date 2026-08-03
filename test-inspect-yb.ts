async function inspectYB() {
  const url = 'https://prdt.ybtour.co.kr/product/detailPackage?menu=HYM&dspSid=AGIA002&evCd=ATH3014-260725OZ00';
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const html = await res.text();
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (match) {
    const json = JSON.parse(match[1]);
    const pageProps = json.props?.pageProps || {};
    console.log('pageProps keys:', Object.keys(pageProps));

    // Print details of each prop
    for (const key of Object.keys(pageProps)) {
      const val = pageProps[key];
      if (Array.isArray(val)) {
        console.log(`[Array] ${key}: ${val.length} items`);
        if (val.length > 0) {
          console.log(`  First item keys:`, Object.keys(val[0]));
          console.log(`  First item sample:`, JSON.stringify(val[0], null, 2).substring(0, 500));
        }
      } else if (typeof val === 'object' && val !== null) {
        console.log(`[Object] ${key} keys:`, Object.keys(val));
      } else {
        console.log(`[Primitive] ${key}:`, val);
      }
    }
  }
}
inspectYB();

async function test() {
  const gdsNo = 'KWJPN0019';
  const evtNo = 'OP202608040136';
  const res = await fetch(`https://www.hanjintravel.com/api/v1/dp/display/event-detail?gdsNo=${gdsNo}&evtNo=${evtNo}`);
  const data = await res.json();
  const d = data.detail;
  console.log('gdsNm:', d?.gdsNm);
  console.log('catePath:', d?.catePath);
  console.log('vstCtyCntn:', d?.vstCtyCntn);
  console.log('displayCountries:', JSON.stringify(d?.displayCountries));
  console.log('gdsItrd1Val:', d?.gdsItrd1Val);
  console.log('gdsItrd2Val:', d?.gdsItrd2Val);
  console.log('gdsItrd3Val:', d?.gdsItrd3Val);
  console.log('gdsCorePntKyftCntn:', d?.gdsCorePntKyftCntn);
  console.log('gdsCorePntAvtnT1stTtl:', d?.gdsCorePntAvtnT1stTtl);
  console.log('gdsCorePntAvtnT1stCntn:', d?.gdsCorePntAvtnT1stCntn);
  console.log('gdsCorePntAvtnT2ndTtl:', d?.gdsCorePntAvtnT2ndTtl);
  console.log('gdsCorePntAvtnT2ndCntn:', d?.gdsCorePntAvtnT2ndCntn);
}
test();

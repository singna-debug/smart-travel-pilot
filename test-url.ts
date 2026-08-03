async function testUrl() {
  const gdsNo = 'KWJPN0080';
  const evtNo = 'OP202609240372';
  const res = await fetch(`https://www.hanjintravel.com/api/v1/dp/display/event-detail?gdsNo=${gdsNo}&evtNo=${evtNo}`);
  const data = await res.json();
  console.log('detail keys:', Object.keys(data.detail));
  console.log('gdsNm:', data.detail.gdsNm);
  console.log('gdsItrd1Val:', data.detail.gdsItrd1Val);
  console.log('gdsItrd2Val:', data.detail.gdsItrd2Val);
  console.log('gdsItrd3Val:', data.detail.gdsItrd3Val);
  console.log('gdsCorePntKyftCntn:', data.detail.gdsCorePntKyftCntn);
  console.log('gdsCorePntHtlCntn:', data.detail.gdsCorePntHtlCntn);
  console.log('gdsCorePntMlCntn:', data.detail.gdsCorePntMlCntn);
  console.log('gdsCorePntSchdCntn:', data.detail.gdsCorePntSchdCntn);
  console.log('gdsCorePntVhcCntn:', data.detail.gdsCorePntVhcCntn);
}
testUrl();

async function testOtherUrl() {
  // Try another Hanjin URL that might be the user's url
  const res = await fetch(`https://www.hanjintravel.com/api/v1/dp/display/event-detail?gdsNo=KWJPN0079&evtNo=OP202609200001`).catch(() => null);
  // Also search for recent/other event endpoints or gds
  console.log('Tested');
}
testOtherUrl();

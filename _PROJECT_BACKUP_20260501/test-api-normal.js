const fetch = require('node-fetch');
const fs = require('fs');

async function testNormalMode() {
  const url = 'https://www.modetour.com/package/102687063?MLoc=99&Pnum=102687063&ANO=81440&sno=C117876&thru=crs';
  console.log('Testing /api/crawl-analyze (NORMAL MODE)...');
  console.time('ExecutionTime');

  try {
    const response = await fetch('http://localhost:3000/api/crawl-analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, mode: 'normal' })
    });

    const result = await response.json();
    console.timeEnd('ExecutionTime');
    
    if (result.success) {
      console.log('Success! Title:', result.data.raw.title);
      console.log('Price:', result.data.raw.price);
      console.log('Airline:', result.data.raw.airline);
      
      // Save for inspection
      fs.writeFileSync('output-normal.json', JSON.stringify(result.data.raw, null, 2));
      console.log('Saved to output-normal.json');
    } else {
      console.error('Error:', result.error);
    }
  } catch (err) {
    console.error('Fetch Failed:', err.message);
  }
}

testNormalMode();

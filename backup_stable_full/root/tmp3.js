const https = require('https');
const fs = require('fs');

const options = {
  hostname: 'b2c-api.modetour.com',
  port: 443,
  path: '/Package/GetScheduleList?productNo=102687063',
  method: 'GET',
  headers: {
    'modewebapireqheader': '{"WebSiteNo":2,"CompanyNo":81202,"DeviceType":"DVTPC","ApiKey":"jm9i5RUzKPMPdklHzDKqNzwZYy0IGV5hTyKkCcpxO0IGIgVS+8Z7NnbzbARv5w7Bn90KT13Gq79XZMow6TYvwQ=="}',
    'referer': 'https://www.modetour.com/',
    'accept': 'application/json'
  }
};

const req = https.request(options, res => {
  let d = '';
  res.on('data', chunk => { d += chunk; });
  res.on('end', () => {
    try {
        const json = JSON.parse(d);
        const day1 = json.result.filter(x => x.itiDays === 1);
        fs.writeFileSync('schedule_day1.json', JSON.stringify(day1, null, 2));
        console.log('Saved to schedule_day1.json');
    } catch(e) {
        console.log('Error parsing JSON:', e.message);
        fs.writeFileSync('schedule_raw.json', d);
        console.log('Saved raw data to schedule_raw.json');
    }
  });
});

req.on('error', error => {
  console.error(error);
});

req.end();

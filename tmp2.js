const https = require('https');
const fs = require('fs');

const options = {
  hostname: 'b2c-api.modetour.com',
  port: 443,
  path: '/Package/GetScheduleList?productNo=102687063',
  method: 'GET',
  headers: {
    'modewebapireqheader': '{"WebSiteNo":2,"CompanyNo":81202}'
  }
};

const req = https.request(options, res => {
  let d = '';
  res.on('data', chunk => { d += chunk; });
  res.on('end', () => {
    fs.writeFileSync('schedule.json', JSON.stringify(JSON.parse(d), null, 2));
    console.log('Saved to schedule.json');
  });
});

req.on('error', error => {
  console.error(error);
});

req.end();

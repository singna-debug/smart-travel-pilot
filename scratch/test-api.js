const fs = require('fs');

async function run() {
    const headers = {
        'modewebapireqheader': '{"WebSiteNo":2,"CompanyNo":81202,"DeviceType":"DVTPC","ApiKey":"jm9i5RUzKPMPdklHzDKqNzwZYy0IGV5hTyKkCcpxO0IGIgVS+8Z7NnbzbARv5w7Bn90KT13Gq79XZMow6TYvwQ=="}',
        'referer': 'https://www.modetour.com/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/123.0.0.0 Safari/537.36'
    };
    
    // Pnum for testing. Let's try to get one from the logs or use a dummy one if it fails.
    const productNo = '100634999'; 
    const url = `https://b2c-api.modetour.com/Package/GetScheduleList?productNo=${productNo}`;
    
    console.log("Fetching:", url);
    try {
        const res = await fetch(url, { headers });
        const data = await res.json();
        
        fs.writeFileSync('api-dump.json', JSON.stringify(data, null, 2));

        const scheduleList = data?.result?.scheduleItemList || [];
        console.log(`Found ${scheduleList.length} days.`);
        
        if (scheduleList.length > 0) {
            const day1 = scheduleList[0];
            console.log("Day 1 keys:", Object.keys(day1));
            
            for (const key of Object.keys(day1)) {
                if (Array.isArray(day1[key])) {
                    console.log(`Array field '${key}' has ${day1[key].length} items.`);
                    if (day1[key].length > 0) {
                        console.log(`  Sample item keys:`, Object.keys(day1[key][0]));
                        if (day1[key][0].listScheduleDetail) {
                            console.log(`  Nested listScheduleDetail found! Length: ${day1[key][0].listScheduleDetail.length}`);
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.error(e);
    }
}
run();

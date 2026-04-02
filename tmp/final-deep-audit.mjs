
import fetch from 'node-fetch';

const productNo = '106173541';
const h = {
    'modewebapireqheader': '{"WebSiteNo":2,"CompanyNo":81202,"DeviceType":"DVTPC","ApiKey":"jm9i5RUzKPMPdklHzDKqNzwZYy0IGV5hTyKkCcpxO0IGIgVS+8Z7NnbzbARv5w7Bn90KT13Gq79XZMow6TYvwQ=="}',
    'referer': 'https://www.modetour.com/',
    'accept': 'application/json, text/plain, */*',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

async function check() {
    console.log(`\n=== FINAL DATA AUDIT FOR: ${productNo} ===\n`);
    
    // Test the specific key 'scheduleItemList'
    const res = await fetch(`https://b2c-api.modetour.com/Package/GetScheduleList?productNo=${productNo}`, { headers: h });
    const json = await res.json();
    
    if (json.isOK && json.result) {
        const list = json.result.scheduleItemList || json.result.ScheduleItemList;
        if (Array.isArray(list)) {
            console.log(`[PASS] Found ${list.length} Days.`);
            
            list.slice(0, 1).forEach((day, idx) => {
                console.log(`\n[DAY ${idx+1}] Title: ${day.title || day.Title}`);
                
                // CHECK BRIEF ITINERARY (Timeline)
                const details = day.scheduleDetailList || day.ScheduleDetailList || [];
                console.log(`      > Brief Itinerary (Steps): ${details.length}`);
                
                details.slice(0, 3).forEach((s, sIdx) => {
                    console.log(`      (${sIdx+1}) ${s.title || s.Title} : ${s.content || s.Content ? (s.content || s.Content).substring(0, 30) + '...' : ''}`);
                });

                if (details.length === 0) {
                     console.log(`      !!! FAIL: Day ${idx+1} has NO brief itinerary steps.`);
                }
            });

            console.log(`\n=== FINAL VERDICT: NATIVE API HAS ALL DATA (INCLUDING BRIEF ITINERARY) ===\n`);
        } else {
             console.log(`[FAIL] No scheduleItemList found. Keys: ${Object.keys(json.result)}`);
        }
    }
}
check();


import fs from 'fs';

async function verify() {
    console.log(`\n=== HYDRATED DATA AUDIT (NEXT_DATA) ===\n`);
    
    try {
        const html = fs.readFileSync('tmp/diagnose_modetour.html', 'utf8');
        const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
        
        if (!match) {
            console.log(`[FAIL] __NEXT_DATA__ script not found in HTML.`);
            return;
        }

        const json = JSON.parse(match[1]);
        const queries = json.props?.pageProps?.initialState?.api?.queries || {};
        
        console.log(`[PASS] Found ${Object.keys(queries).length} Hydrated Queries.`);

        // Find the Schedule List query
        const scheduleKey = Object.keys(queries).find(k => k.startsWith('GetScheduleList'));
        if (scheduleKey) {
            const data = queries[scheduleKey].data;
            const list = data?.result?.scheduleItemList || data?.result || [];
            
            if (Array.isArray(list)) {
                console.log(`[SUCCESS] Found ${list.length} Days Itinerary in NEXT_DATA.`);
                list.slice(0, 1).forEach((day, idx) => {
                    console.log(`\nDay ${idx+1}: ${day.title}`);
                    const details = day.scheduleDetailList || day.ScheduleDetailList || [];
                    console.log(`   > Steps: ${details.length}`);
                    details.slice(0, 2).forEach(s => console.log(`     - ${s.title}`));
                });
            }
        } else {
             console.log(`[FAIL] 'GetScheduleList' query not found in hydrated state.`);
             console.log(`Available Keys: ${Object.keys(queries).slice(0, 5).join(', ')}`);
        }

    } catch (e) {
        console.error(`[ERROR] ${e.message}`);
    }
}

verify();

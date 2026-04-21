async function run() { 
    try {
        const res = await fetch('https://b2c-api.modetour.com/Search/Package?keyword=' + encodeURIComponent('장가계')); 
        const data = await res.json(); 
        const items = data?.result?.goodsList;
        if (!items || items.length === 0) {
            console.log('No goods found items:', items);
            return;
        }
        const pNo = items[0].productNo; 
        console.log('Found product:', pNo); 
        const sRes = await fetch('https://b2c-api.modetour.com/Package/GetScheduleList?productNo=' + pNo); 
        const sData = await sRes.json(); 
        require('fs').writeFileSync('scratch/jang-dump.json', JSON.stringify(sData, null, 2)); 
        console.log('Dumped schedule to scratch/jang-dump.json'); 
    } catch(e) {
        console.error(e);
    }
} 
run();

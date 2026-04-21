const fetch = require('node-fetch');
async function run() { 
    try {
        const pNo = '103293258'; 
        const sRes = await fetch('https://b2c-api.modetour.com/Package/GetScheduleList?productNo=' + pNo); 
        const sData = await sRes.json(); 
        require('fs').writeFileSync('scratch/jang-dump.json', JSON.stringify(sData, null, 2)); 
        console.log('Dumped schedule to scratch/jang-dump.json'); 
    } catch(e) {
        console.error(e);
    }
} 
run();

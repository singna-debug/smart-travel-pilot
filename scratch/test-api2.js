const fs = require('fs');

const data = JSON.parse(fs.readFileSync('api-dump.json', 'utf8'));
const scheduleList = data?.result?.scheduleItemList || [];

if (scheduleList.length > 0) {
    const day1 = scheduleList[0];
    const lists = ['ortherActions', 'listLocalPlace', 'listGuidePlace', 'listHotelPlace', 'listTransportPlace', 'listMealPlace', 'listAirRouteInfo'];
    
    lists.forEach(listName => {
        const arr = day1[listName];
        if (Array.isArray(arr) && arr.length > 0) {
            console.log(`\n=== ${listName} (${arr.length} items) ===`);
            arr.forEach(item => {
                console.log(`- Seq: ${item.itiSeq}, Code: ${item.itiServiceCode}, Name: ${item.itiPlaceName}`);
                if (item.itiDetailDes) console.log(`  Detail: ${item.itiDetailDes.substring(0, 50)}...`);
            });
        }
    });

}

const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./schedule_raw.json'));

const scheduleDays = data.result.scheduleItemList;
const listKeys = [
    'listItemSchedule', 'listScheduleItem', 'ortherActions', 
    'listLocalPlace', 'listGuidePlace', 'listHotelPlace', 
    'listTransportPlace', 'listMealPlace'
];

scheduleDays.forEach((dayData, idx) => {
    console.log(`\n=== Day ${idx+1} ===`);
    console.log('Keys:', Object.keys(dayData).join(', '));
    
    listKeys.forEach(key => {
        const list = dayData[key]?.item;
        if (Array.isArray(list) && list.length > 0) {
            console.log(`  [${key}] found ${list.length} items. First item itiPlaceName: ${list[0].itiPlaceName}`);
        }
    });
});

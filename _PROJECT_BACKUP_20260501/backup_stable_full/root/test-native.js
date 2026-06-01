const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./schedule_raw.json'));

const days = data.result.scheduleItemList;
days.forEach((dayData, idx) => {
    let activities = [];
    if (dayData.listScheduleItem) {
        dayData.listScheduleItem.forEach(item => {
            const strings = [];
            const loc = item.itiPlaceName || item.itiServiceName;
            if (loc) strings.push(loc);
            
            const descArgs = [];
            if(item.itiSummaryDes) descArgs.push(item.itiSummaryDes);
            if(item.itiDetailDes) descArgs.push(item.itiDetailDes);
            
            if (item.scheduleItemServiceOptions) {
                item.scheduleItemServiceOptions.forEach(opt => {
                    if (opt.serviceWITHSummary) descArgs.push(opt.serviceWITHSummary);
                    else if (opt.serviceExplaination) descArgs.push(opt.serviceExplaination);
                    if (opt.detailDes) descArgs.push(opt.detailDes);
                });
            }
            
            const descJoined = descArgs.map(s => s.replace(/<[^>]+>/g, '').trim()).filter(Boolean).join('\n');
            if (descJoined) {
                if (loc) strings.push(descJoined);
                else strings.push(descJoined);
            }
            
            if (strings.length > 0) {
                activities.push(strings.join('\n'));
            }
        });
    }
    console.log(`\n=== Day ${idx+1} ===`);
    activities.forEach(a => console.log("- " + a));
    
    if (dayData.listAirRouteInfo && dayData.listAirRouteInfo.length > 0) {
        const flight = dayData.listAirRouteInfo[0];
        console.log(`[Flight] ${flight.departureCityName}(${flight.departureCity}) 출발 ${flight.departureDate?.substring(0,10)} ${flight.departureTime} - ${flight.departureFlightDuration} 소요 - ${flight.arrivalCityName}(${flight.arrivalCity}) 도착 ${flight.arrivalTime} ${flight.departureFlight}`);
    }
});

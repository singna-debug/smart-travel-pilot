const https = require('https');
const fs = require('fs');

https.get('https://www.modetour.com/package/102687063', res => {
    let d = '';
    res.on('data', c => d+=c);
    res.on('end', () => {
        const m = d.match(/<script id=\"__NEXT_DATA__\"[^>]*>([\s\S]*?)<\/script>/);
        if(m) {
            fs.writeFileSync('next_data.json', JSON.stringify(JSON.parse(m[1]), null, 2));
            console.log('Saved to next_data.json');
        } else console.log('No NEXT_DATA');
    });
});

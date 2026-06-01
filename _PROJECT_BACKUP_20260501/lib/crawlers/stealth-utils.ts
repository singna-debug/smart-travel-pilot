
/**
 * 브라우저 위장용 스텔스 헤더 생성기
 * Vercel 배포 환경에서 봇 감지 시스템을 회피하기 위해 
 * 실제 Windows Chrome 브라우저의 서명을 100% 모방합니다.
 */
export function getStealthHeaders(referer: string = 'https://www.modetour.com/') {
    return {
        'referer': referer,
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'cache-control': 'no-cache',
        'pragma': 'no-cache',
        'sec-ch-ua': '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Priority': 'u=1, i'
    };
}

/**
 * 모두투어 API 전용 헤더 추가
 */
export function getModeTourApiHeaders() {
    const base = getStealthHeaders('https://www.modetour.com/');
    return {
        ...base,
        'modewebapireqheader': '{"WebSiteNo":2,"CompanyNo":81202,"DeviceType":"DVTPC","ApiKey":"jm9i5RUzKPMPdklHzDKqNzwZYy0IGV5hTyKkCcpxO0IGIgVS+8Z7NnbzbARv5w7Bn90KT13Gq79XZMow6TYvwQ=="}'
    };
}

/**
 * AIRLINE_MAP & CITY_CODE_MAP 전용 상수 파일
 * 
 * 상품 분석 및 확정서 제작에 필요한 항공사 로고, 색상, 도시 코드 매핑 정보를 담고 있습니다.
 * 전 세계 주요 항공사 및 공항 코드를 망라합니다.
 */

export interface AirlineInfo {
    name: string;
    logoUrl: string;
    color: string;
}

// 1. 전 세계 주요 항공사 매핑 (한국 취항 및 주요 경유지 99% 커버)
export const AIRLINE_MAP: Record<string, AirlineInfo> = {
    // 🇰🇷 국적기 & LCC
    'KE': { name: '대한항공', logoUrl: 'https://img.modetour.com/air/logo/KE.png', color: '#00256C' },
    'OZ': { name: '아시아나항공', logoUrl: 'https://img.modetour.com/air/logo/OZ.png', color: '#FF0000' },
    '7C': { name: '제주항공', logoUrl: 'https://img.modetour.com/air/logo/7C.png', color: '#FF5000' },
    'TW': { name: '티웨이항공', logoUrl: 'https://img.modetour.com/air/logo/TW.png', color: '#D22C26' },
    'LJ': { name: '진에어', logoUrl: 'https://img.modetour.com/air/logo/LJ.png', color: '#00B050' },
    'BX': { name: '에어부산', logoUrl: 'https://img.modetour.com/air/logo/BX.png', color: '#0033A0' },
    'RS': { name: '에어서울', logoUrl: 'https://img.modetour.com/air/logo/RS.png', color: '#00C8B0' },
    'ZE': { name: '이스타항공', logoUrl: 'https://img.modetour.com/air/logo/ZE.png', color: '#E4002B' },
    'YP': { name: '에어프레미아', logoUrl: 'https://img.modetour.com/air/logo/YP.png', color: '#151B38' },
    'RF': { name: '에어로케이', logoUrl: 'https://img.modetour.com/air/logo/RF.png', color: '#000000' },

    // 🌏 아시아 & 오세아니아
    'VJ': { name: '비엣젯항공', logoUrl: 'https://img.modetour.com/air/logo/VJ.png', color: '#E3000F' },
    'VN': { name: '베트남항공', logoUrl: 'https://img.modetour.com/air/logo/VN.png', color: '#006575' },
    'QH': { name: '밤부항공', logoUrl: 'https://img.modetour.com/air/logo/QH.png', color: '#003366' },
    'PR': { name: '필리핀항공', logoUrl: 'https://img.modetour.com/air/logo/PR.png', color: '#CB131E' },
    '5J': { name: '세부퍼시픽', logoUrl: 'https://img.modetour.com/air/logo/5J.png', color: '#F7EA00' },
    'SQ': { name: '싱가포르항공', logoUrl: 'https://img.modetour.com/air/logo/SQ.png', color: '#00245E' },
    'TG': { name: '타이항공', logoUrl: 'https://img.modetour.com/air/logo/TG.png', color: '#4B2682' },
    'CX': { name: '캐세이퍼시픽', logoUrl: 'https://img.modetour.com/air/logo/CX.png', color: '#006564' },
    'UO': { name: '홍콩익스프레스', logoUrl: 'https://img.modetour.com/air/logo/UO.png', color: '#48175F' },
    'HX': { name: '홍콩항공', logoUrl: 'https://img.modetour.com/air/logo/HX.png', color: '#CC0000' },
    'NX': { name: '에어마카오', logoUrl: 'https://img.modetour.com/air/logo/NX.png', color: '#00A19B' },
    'BR': { name: '에바항공', logoUrl: 'https://img.modetour.com/air/logo/BR.png', color: '#008543' },
    'CI': { name: '중화항공', logoUrl: 'https://img.modetour.com/air/logo/CI.png', color: '#9782B3' },
    'JX': { name: '스타룩스항공', logoUrl: 'https://img.modetour.com/air/logo/JX.png', color: '#C8A165' },
    'NH': { name: '전일본공수(ANA)', logoUrl: 'https://img.modetour.com/air/logo/NH.png', color: '#004F9F' },
    'JL': { name: '일본항공(JAL)', logoUrl: 'https://img.modetour.com/air/logo/JL.png', color: '#CC0000' },
    'MM': { name: '피치항공', logoUrl: 'https://img.modetour.com/air/logo/MM.png', color: '#D4006B' },
    'GK': { name: '젯스타 재팬', logoUrl: 'https://img.modetour.com/air/logo/GK.png', color: '#FF5000' },
    'MU': { name: '중국동방항공', logoUrl: 'https://img.modetour.com/air/logo/MU.png', color: '#D6000F' },
    'CZ': { name: '중국남방항공', logoUrl: 'https://img.modetour.com/air/logo/CZ.png', color: '#00529A' },
    'CA': { name: '중국국제항공', logoUrl: 'https://img.modetour.com/air/logo/CA.png', color: '#E3000F' },
    'FM': { name: '상하이항공', logoUrl: 'https://img.modetour.com/air/logo/FM.png', color: '#E3000F' },
    'MF': { name: '샤먼항공', logoUrl: 'https://img.modetour.com/air/logo/MF.png', color: '#008CFF' },
    'ZH': { name: '심천항공', logoUrl: 'https://img.modetour.com/air/logo/ZH.png', color: '#E3000F' },
    'HO': { name: '길상항공', logoUrl: 'https://img.modetour.com/air/logo/HO.png', color: '#B52636' },
    'FD': { name: '타이 에어아시아', logoUrl: 'https://img.modetour.com/air/logo/FD.png', color: '#FF0000' },
    'D7': { name: '에어아시아 X', logoUrl: 'https://img.modetour.com/air/logo/D7.png', color: '#FF0000' },
    'AK': { name: '에어아시아', logoUrl: 'https://img.modetour.com/air/logo/AK.png', color: '#FF0000' },
    'MH': { name: '말레이시아항공', logoUrl: 'https://img.modetour.com/air/logo/MH.png', color: '#002E6D' },
    'GA': { name: '가루다인도네시아', logoUrl: 'https://img.modetour.com/air/logo/GA.png', color: '#005C8A' },
    'KC': { name: '에어아스타나', logoUrl: 'https://img.modetour.com/air/logo/KC.png', color: '#BAA276' },
    'HY': { name: '우즈베키스탄항공', logoUrl: 'https://img.modetour.com/air/logo/HY.png', color: '#002E6D' },
    'OM': { name: '몽골항공', logoUrl: 'https://img.modetour.com/air/logo/OM.png', color: '#003F87' },
    'AI': { name: '에어인디아', logoUrl: 'https://img.modetour.com/air/logo/AI.png', color: '#E3000F' },
    'QF': { name: '콴타스항공', logoUrl: 'https://img.modetour.com/air/logo/QF.png', color: '#E40000' },
    'JQ': { name: '젯스타', logoUrl: 'https://img.modetour.com/air/logo/JQ.png', color: '#FF5C00' },
    'NZ': { name: '에어뉴질랜드', logoUrl: 'https://img.modetour.com/air/logo/NZ.png', color: '#000000' },

    // 🌍 중동 & 유럽
    'EK': { name: '에미레이트항공', logoUrl: 'https://img.modetour.com/air/logo/EK.png', color: '#D71A21' },
    'QR': { name: '카타르항공', logoUrl: 'https://img.modetour.com/air/logo/QR.png', color: '#5C0632' },
    'EY': { name: '에티하드항공', logoUrl: 'https://img.modetour.com/air/logo/EY.png', color: '#C8A165' },
    'KU': { name: '쿠웨이트항공', logoUrl: 'https://img.modetour.com/air/logo/KU.png', color: '#005DAA' },
    'TK': { name: '터키항공', logoUrl: 'https://img.modetour.com/air/logo/TK.png', color: '#C8102E' },
    'AF': { name: '에어프랑스', logoUrl: 'https://img.modetour.com/air/logo/AF.png', color: '#002157' },
    'KL': { name: 'KLM네덜란드항공', logoUrl: 'https://img.modetour.com/air/logo/KL.png', color: '#00A1DE' },
    'LH': { name: '루프트한자', logoUrl: 'https://img.modetour.com/air/logo/LH.png', color: '#05164D' },
    'BA': { name: '영국항공', logoUrl: 'https://img.modetour.com/air/logo/BA.png', color: '#012A5E' },
    'AY': { name: '핀에어', logoUrl: 'https://img.modetour.com/air/logo/AY.png', color: '#0B1560' },
    'LO': { name: 'LOT폴란드항공', logoUrl: 'https://img.modetour.com/air/logo/LO.png', color: '#002664' },
    'LX': { name: '스위스항공', logoUrl: 'https://img.modetour.com/air/logo/LX.png', color: '#E31D3C' },
    'OS': { name: '오스트리아항공', logoUrl: 'https://img.modetour.com/air/logo/OS.png', color: '#E31D3C' },
    'SK': { name: '스칸디나비아항공', logoUrl: 'https://img.modetour.com/air/logo/SK.png', color: '#003399' },
    'IB': { name: '이베리아항공', logoUrl: 'https://img.modetour.com/air/logo/IB.png', color: '#D71A21' },
    'TP': { name: 'TAP포르투갈항공', logoUrl: 'https://img.modetour.com/air/logo/TP.png', color: '#54A810' },
    'AZ': { name: 'ITA항공(구 알리탈리아)', logoUrl: 'https://img.modetour.com/air/logo/AZ.png', color: '#003366' },

    // 🇺🇸 미주
    'HA': { name: '하와이안항공', logoUrl: 'https://img.modetour.com/air/logo/HA.png', color: '#3A1958' },
    'DL': { name: '델타항공', logoUrl: 'https://img.modetour.com/air/logo/DL.png', color: '#E3132C' },
    'UA': { name: '유나이티드항공', logoUrl: 'https://img.modetour.com/air/logo/UA.png', color: '#005DAA' },
    'AA': { name: '아메리칸항공', logoUrl: 'https://img.modetour.com/air/logo/AA.png', color: '#004F9F' },
    'AC': { name: '에어캐나다', logoUrl: 'https://img.modetour.com/air/logo/AC.png', color: '#F01428' },
    'LA': { name: '라탐항공', logoUrl: 'https://img.modetour.com/air/logo/LA.png', color: '#272F5E' },
};

// 2. 전 세계 주요 공항/도시 코드 (대륙별 총망라)
export const CITY_CODE_MAP: Record<string, string> = {
    // 🇰🇷 국내
    '인천': 'ICN', '김포': 'GMP', '서울': 'ICN', 
    '김해': 'PUS', '부산': 'PUS', 
    '제주': 'CJU', '청주': 'CJJ', '대구': 'TAE', '광주': 'KWJ', '무안': 'MWX', '양양': 'YNY',

    // 🇯🇵 일본
    '도쿄': 'NRT', '나리타': 'NRT', '하네다': 'HND',
    '오사카': 'KIX', '간사이': 'KIX', '이타미': 'ITM',
    '후쿠오카': 'FUK', '오키나와': 'OKA', '나하': 'OKA',
    '삿포로': 'CTS', '치토세': 'CTS', '신치토세': 'CTS',
    '나고야': 'NGO', '추부': 'NGO', '시즈오카': 'FSZ', '가고시마': 'KOJ', 
    '마쓰야마': 'MYJ', '구마모토': 'KMJ', '다카마쓰': 'TAK', '미야자키': 'KMI', '아오모리': 'AOJ',
    '오이타': 'OIT', '나가사키': 'NGS', '도야마': 'TOY', '요나고': 'YGJ', '하나마키': 'HNA',

    // 🇻🇳 베트남
    '다낭': 'DAD', '하노이': 'HAN', '호치민': 'SGN',
    '나트랑': 'CXR', '냐짱': 'CXR', '깜란': 'CXR', 
    '푸꾸옥': 'PQC', '달랏': 'DLI', '하이퐁': 'HPH', '다랏': 'DLI',

    // 🇹🇭 태국 & 🇵🇭 필리핀
    '방콕': 'BKK', '수완나품': 'BKK', '돈므앙': 'DMK',
    '푸켓': 'HKT', '치앙마이': 'CNX', '파타야': 'UTP', '코사무이': 'USM', '끄라비': 'KBV',
    '세부': 'CEB', '막탄': 'CEB',
    '보라카이': 'KLO', '칼리보': 'KLO', '까띠끌란': 'MPH', 
    '보홀': 'TAG', '팡라오': 'TAG', '클락': 'CRK', '마닐라': 'MNL', '팔라완': 'PPS',

    // 🇲🇾 말레이시아 & 🇮🇩 인도네시아 & 기타 동남아
    '발리': 'DPS', '응우라라이': 'DPS', '자카르타': 'CGK', '롬복': 'LOP',
    '쿠알라룸푸르': 'KUL', '코타키나발루': 'BKI', '페낭': 'PEN', '조호르바루': 'JHB',
    '싱가포르': 'SIN', '창이': 'SIN',
    '비엔티안': 'VTE', '루앙프라방': 'LPQ', // 라오스
    '씨엠립': 'SAI', '프놈펜': 'PNH', // 캄보디아
    '양곤': 'RGN', // 미얀마
    '울란바토르': 'UBN', // 몽골

    // 🇹🇼 대만 & 🇨🇳 중국 & 🇲🇴 마카오/홍콩
    '타이베이': 'TPE', '타오위안': 'TPE', '송산': 'TSA', '가오슝': 'KHH', '타이중': 'RMQ',
    '홍콩': 'HKG', '마카오': 'MFM',
    '베이징': 'PEK', '다싱': 'PKX', '상하이': 'PVG', '푸동': 'PVG', '홍차오': 'SHA', 
    '칭다오': 'TAO', '광저우': 'CAN', '장자지에': 'DYG', '장가계': 'DYG', 
    '시안': 'XIY', '청두': 'TFU', '항저우': 'HGH', '선전': 'SZX', '싼야': 'SYX', '하이난': 'SYX',
    '연길': 'YNJ', '대련': 'DLC', '천진': 'TSN', '곤명': 'KMG', '하얼빈': 'HRB',

    // 🌴 대양주 (휴양지) & 🇦🇺 호주/뉴질랜드
    '괌': 'GUM', '사이판': 'SPN', '팔라우': 'ROR', '피지': 'NAN',
    '시드니': 'SYD', '멜버른': 'MEL', '브리즈번': 'BNE', '골드코스트': 'OOL', '퍼스': 'PER', '케언즈': 'CNS',
    '오클랜드': 'AKL', '크라이스트처치': 'CHC', '퀸스타운': 'ZQN',

    // 🇺🇸 미주 (미국/캐나다/남미)
    '하와이': 'HNL', '호놀룰루': 'HNL',
    '로스앤젤레스': 'LAX', 'LA': 'LAX', '뉴욕': 'JFK', '뉴어크': 'EWR', 
    '샌프란시스코': 'SFO', '시애틀': 'SEA', '라스베가스': 'LAS', '시카고': 'ORD', '애틀랜타': 'ATL', '댈러스': 'DFW',
    '토론토': 'YYZ', '밴쿠버': 'YVR', '캘거리': 'YYC', '몬트리올': 'YUL',
    '칸쿤': 'CUN', // 멕시코 휴양지
    '상파울루': 'GRU', '리마': 'LIM', '부에노스아이레스': 'EZE',

    // 🇪🇺 유럽 & 🇦🇪 중동
    '파리': 'CDG', '샤를드골': 'CDG', 
    '런던': 'LHR', '히드로': 'LHR', '개트윅': 'LGW',
    '프랑크푸르트': 'FRA', '뮌헨': 'MUC', 
    '로마': 'FCO', '피우미치노': 'FCO', '밀라노': 'MXP', '베니스': 'VCE',
    '마드리드': 'MAD', '바르셀로나': 'BCN',
    '프라하': 'PRG', '비엔나': 'VIE', '부다페스트': 'BUD', '취리히': 'ZRH', '암스테르담': 'AMS', '헬싱키': 'HEL',
    '자그레브': 'ZAG', '두브로브니크': 'DBV', '스플리트': 'SPU', // 크로아티아
    '오슬로': 'OSL', '스톡홀름': 'ARN', '코펜하겐': 'CPH', // 북유럽
    '리스본': 'LIS', '아테네': 'ATH', '이스탄불': 'IST',
    '두바이': 'DXB', '아부다비': 'AUH', '도하': 'DOH', '무스카트': 'MCT',
    '타슈켄트': 'TAS', '알마티': 'ALA'
};
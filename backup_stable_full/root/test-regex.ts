const text = `==== TARGET METADATA START ====
PAGE_TITLE: "[자연품은큐슈] 후쿠오카/구마모토/유후인/벳부/아소 3일 (전일정온천호텔+호텔석식2회+술음료무제한) > 패키지 | 모두투어"
OG_TITLE: "[자연품은큐슈] 후쿠오카/구마모토/유후인/벳부/아소 3일 (전일정온천호텔+호텔석식2회+술음료무제한)"
BODY_TITLE: ""
CLASS_TITLE: "[자연품은큐슈] 후쿠오카/구마모토/유후인/벳부/아소 3일 (전일정온천호텔+호텔석식2회+술음료무제한)"
TARGET_TITLE: "[자연품은큐슈] 후쿠오카/구마모토/유후인/벳부/아소 3일 (전일정온천호텔+호텔석식2회+술음료무제한)"
TARGET_PRICE: "799000"
TARGET_DURATION: "undefined"
TARGET_AIRLINE: "제주항공"
TARGET_DEPARTURE_AIRPORT: "인천"
==== TARGET METADATA END ====`;

const stripQuotes = (s: string) => s.replace(/^"|"$/g, '').trim();

const extractMatch = (regex: RegExp) => {
    const match = text.match(regex);
    return match ? stripQuotes(match[1]) : '';
};

console.log("TITLE:", extractMatch(/TARGET_TITLE:\s*"?([^"\n]*)"?/));
console.log("PAGE_TITLE:", extractMatch(/PAGE_TITLE:\s*"?([^"\n]*)"?/));
console.log("PRICE:", extractMatch(/TARGET_PRICE:\s*"?([^"\n]*)"?/));

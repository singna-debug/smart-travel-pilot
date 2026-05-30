'use client';

import { useState, useEffect, useRef } from 'react';

interface Customer {
    name: string;
    phone: string;
    destination: string;
    departureDate: string;
    returnDate: string;
    duration: string;
    productName: string;
    url: string;
    status: string;
    balanceDueDate: string;
    travelersCount: string;
    visitorId: string;
    reservationNumber?: string;
    confirmationLink?: string;
    timestamp: string;
}

interface ProductInfo {
    title: string;
    price: string;
    destination: string;
    departureDate: string;
    returnDate?: string;
    airline: string;
    flightCode?: string;
    duration: string;
    departureAirport: string;
    departureTime?: string;
    arrivalTime?: string;
    returnDepartureTime?: string;
    returnArrivalTime?: string;
    itinerary?: any[];
    keyPoints: string[];
    exclusions: string[];
    specialTerms?: string;
}

type TemplateType = 'remind' | 'booking' | 'dotcom' | 'balance' | 'ticket' | 'confirmation' | 'pre_4w' | 'departure' | 'happy_call' | 'china_barcode';

export interface FeeItem {
    id: string;
    label: string;
    amount: string;
    type: 'add' | 'discount';
    applyType: 'per_person' | 'total';
}

const TEMPLATE_LABELS: Record<TemplateType, { label: string; icon: string }> = {
    remind: { label: '리마인드', icon: '⏰' },
    booking: { label: '예약 및 결제', icon: '✅' },
    dotcom: { label: '닷컴안내', icon: '🌐' },
    balance: { label: '잔금 안내', icon: '💰' },
    ticket: { label: '항공권 발권', icon: '🎫' },
    confirmation: { label: '확정서 안내', icon: '📖' },
    pre_4w: { label: '출발전 체크사항', icon: '📅' },
    departure: { label: '출발 안내', icon: '✈️' },
    happy_call: { label: '해피콜', icon: '📞' },
    china_barcode: { label: '중국 바코드', icon: '📱' },
};

const AGENT_NAME = '김호기';

// 가격 문자열에서 숫자 추출
function extractPriceNumber(priceStr: string): number {
    const num = priceStr.replace(/[^0-9]/g, '');
    return num ? parseInt(num, 10) : 0;
}

// 숫자를 천 단위 콤마 포맷
function formatPrice(num: number): string {
    return num.toLocaleString('ko-KR');
}

export default function MessageTemplateCreator() {
    // State
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [loadingCustomers, setLoadingCustomers] = useState(false);

    const [url, setUrl] = useState('');
    const [product, setProduct] = useState<ProductInfo | null>(null);
    const [loadingProduct, setLoadingProduct] = useState(false);

    const [templateType, setTemplateType] = useState<TemplateType>('remind');
    const [productPrice, setProductPrice] = useState('');

    // 추가/할인 및 수동 최종 잔금 상태
    const [feeItems, setFeeItems] = useState<FeeItem[]>([]);
    const [isManualBalance, setIsManualBalance] = useState(false);
    const [manualBalanceValue, setManualBalanceValue] = useState('');
    const [remainingBalance, setRemainingBalance] = useState('0원');

    // 행 추가/삭제/수정 헬퍼 함수
    const addFeeItem = (type: 'add' | 'discount') => {
        const newItem: FeeItem = {
            id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
            label: type === 'add' ? '추가 비용' : '할인 혜택',
            amount: '',
            type,
            applyType: 'per_person'
        };
        setFeeItems([...feeItems, newItem]);
    };

    const removeFeeItem = (id: string) => {
        setFeeItems(feeItems.filter(item => item.id !== id));
    };

    const updateFeeItem = (id: string, fields: Partial<FeeItem>) => {
        setFeeItems(feeItems.map(item => item.id === id ? { ...item, ...fields } : item));
    };

    // 추가 입력 필드
    const [bookingNumber, setBookingNumber] = useState('');
    const [travelers, setTravelers] = useState('');
    const [deposit, setDeposit] = useState('1인 80만원');
    const [depositDeadline, setDepositDeadline] = useState('');
    const [bankAccount, setBankAccount] = useState('');
    const [bankHolder, setBankHolder] = useState('모두투어네트워크');
    const [excludedCosts, setExcludedCosts] = useState('가이드 팁, 매너 팁, 개인 경비');
    const [depositPerPerson, setDepositPerPerson] = useState('');
    const [confirmationLink, setConfirmationLink] = useState('');
    const [reviewLink, setReviewLink] = useState('');
    const [specialTerms, setSpecialTerms] = useState('');
    const [airline, setAirline] = useState('');
    const [departureDate, setDepartureDate] = useState('');

    const [generatedText, setGeneratedText] = useState('');
    const [copied, setCopied] = useState(false);

    const dropdownRef = useRef<HTMLDivElement>(null);

    // 고객 목록 로드
    useEffect(() => {
        fetchCustomers();
    }, []);

    // 드롭다운 외부 클릭 닫기
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // 고객 선택 시 자동 입력 (URL, 인원 등)
    useEffect(() => {
        if (selectedCustomer) {
            if (selectedCustomer.url) setUrl(selectedCustomer.url);
            if (selectedCustomer.travelersCount) setTravelers(selectedCustomer.travelersCount);
            if (selectedCustomer.departureDate) setDepartureDate(selectedCustomer.departureDate);
            
            // 예약번호 로드
            const resNum = selectedCustomer.reservationNumber || '';
            setBookingNumber(resNum);

            if (selectedCustomer.confirmationLink) {
                setConfirmationLink(selectedCustomer.confirmationLink);
            } else {
                const resId = resNum || selectedCustomer.visitorId || '';
                if (resId) {
                    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://clubmode.kr';
                    setConfirmationLink(`${baseUrl}/confirmation/${resId}`);
                }
            }
        }
    }, [selectedCustomer]);

    useEffect(() => {
        if (product?.exclusions && product.exclusions.length > 0) {
            setExcludedCosts(product.exclusions.join(', '));
        }
        if (product?.specialTerms) {
            setSpecialTerms(product.specialTerms);
        }
        if (product?.departureDate) {
            setDepartureDate(product.departureDate);
        }
        if (product?.airline) {
            setAirline(product.airline);
        }
        if (product?.price) {
            setProductPrice(product.price);
        }
    }, [product]);

    // 멘트 자동 생성 (실시간 반영)
    useEffect(() => {
        generateMessage();
    }, [
        selectedCustomer, product, templateType, url, 
        bookingNumber, travelers, deposit, depositDeadline, 
        bankAccount, bankHolder, excludedCosts, depositPerPerson, 
        confirmationLink, reviewLink, specialTerms, airline, departureDate, bookingNumber,
        productPrice, feeItems, isManualBalance, manualBalanceValue
    ]);

    async function fetchCustomers() {
        setLoadingCustomers(true);
        try {
            const res = await fetch('/api/messages');
            const data = await res.json();
            if (data.success) {
                setCustomers(data.customers);
            }
        } catch (e) {
            console.error('고객 목록 로딩 실패:', e);
        } finally {
            setLoadingCustomers(false);
        }
    }

    async function fetchProductInfo() {
        if (!url) return;
        setLoadingProduct(true);
        // 기존 데이터 초기화
        setSpecialTerms('');
        setExcludedCosts('');
        setDepartureDate('');
        setAirline('');

        try {
            const res = await fetch('/api/analyze-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, mode: 'reservation_guide' }),
            });
            const data = await res.json();
            if (data.success && data.data?.raw) {
                const p = data.data.raw;
                setProduct(p);
                setProductPrice(p.price || '');
                // 상세정보 필드 자동 채우기 (데이터가 없을 경우 기본값 제공)
                setSpecialTerms(p.specialTerms || '현지 가이드 안내 및 상품 페이지 내 약관 규정 내용에 따름');

                const excl = Array.isArray(p.exclusions) ? p.exclusions.join(', ') : (p.exclusions || '');
                setExcludedCosts(excl || '가이드팁, 매너 팁, 개인 경비');

                setDepartureDate(p.departureDate || selectedCustomer?.departureDate || '');
                setAirline(p.airline || '');
            }
        } catch (e) {
            console.error('상품 정보 로딩 실패:', e);
            // 에러 시에도 기본값은 세팅 (사용자 편의)
            setExcludedCosts('가이드팁, 매너 팁, 개인 경비');
            setSpecialTerms('상품 페이지 내 약관 규정 내용에 따름');
        } finally {
            setLoadingProduct(false);
        }
    }

    function generateMessage() {
        const customer = selectedCustomer;
        const p = product;

        const name = customer?.name || '고객';
        const phone = customer?.phone || '';
        const dest = p?.destination || customer?.destination || '';
        const title = p?.title || customer?.productName || '';
        const price = productPrice || p?.price || '';
        const airlineDisplay = airline || p?.airline || '';
        const departureDateDisplay = departureDate || p?.departureDate || customer?.departureDate || '';
        const duration = p?.duration || customer?.duration || '';
        const depAirport = p?.departureAirport || '';
        const today = new Date();
        const todayStr = `${today.getFullYear()}. ${today.getMonth() + 1}. ${today.getDate()}`;

        const travelersNum = extractPriceNumber(travelers) || 1; // 최소 1명으로 가정
        const priceNum = extractPriceNumber(price);

        // 상품가 및 잔금 총액 계산
        const totalPrice = priceNum * travelersNum;
        const totalPriceStr = totalPrice > 0 ? `${formatPrice(totalPrice)}원` : '';

        // 계약금 총액 계산
        const depositPP = parseInt(depositPerPerson.replace(/[^0-9]/g, ''), 10) || 0;
        const totalDeposit = depositPP * travelersNum;
        const totalDepositStr = totalDeposit > 0 ? `${formatPrice(totalDeposit)}원` : '';
        const depositDisplay = deposit;

        // 다중 추가금 및 할인금 동적 계산
        let totalAdd = 0;
        let totalDiscount = 0;
        let addDetails = '';
        let discountDetails = '';

        feeItems.forEach((item) => {
            const amt = parseInt(item.amount.replace(/[^0-9]/g, ''), 10) || 0;
            if (amt <= 0) return;

            const itemTotal = item.applyType === 'per_person' ? amt * travelersNum : amt;
            if (item.type === 'add') {
                totalAdd += itemTotal;
                addDetails += `- ${item.label}: +${formatPrice(itemTotal)}원${item.applyType === 'per_person' ? ` (1인 ${formatPrice(amt)}원)` : ''}\n`;
            } else {
                totalDiscount += itemTotal;
                discountDetails += `- ${item.label}: -${formatPrice(itemTotal)}원${item.applyType === 'per_person' ? ` (1인 ${formatPrice(amt)}원)` : ''}\n`;
            }
        });

        // 최종 잔금 계산
        const finalBalance = totalPrice - totalDeposit + totalAdd - totalDiscount;
        const remainingBalanceStr = isManualBalance 
            ? (manualBalanceValue || '0원') 
            : (finalBalance > 0 ? `${formatPrice(finalBalance)}원` : '0원');

        let text = '';

        switch (templateType) {
            case 'remind':
                text = `✈️ [모두투어] 상담 상품 리마인드 (담당: ${AGENT_NAME})

안녕하세요, ${name}(${phone})님! (주)클럽모두투어 ${AGENT_NAME}입니다. 😊
일전에 상담 도와드린 ${dest ? dest + ' ' : ''}여행 상품은 잘 확인해 보셨을까요?

🔗 기존 안내한 일정 URL : ${url || '(일정표 링크)'}

상품을 살펴보시다 더 궁금하신 점이나 조정이 필요한 부분이 있으시면 언제든 편하게 말씀해 주세요. ${name}님께 가장 꼭 맞고 만족스러운 여행이 되도록 정성껏 다듬어 드리겠습니다.

──────────────────

🏆 믿고 맡길 수 있는 '클럽모두투어'

✅ 모두투어 직영 운영 20년
✅ 축적된 전문성과 노하우
✅ 25년 연속 모두투어 최우수 대리점 선정
✅ 2023년 고객만족 대상 수상
✅ 중소기업청 공식 인증 우수 중소기업
✅ "김반장과 함께" 단체여행 전문

생애 첫 허니문부터 소중한 부모님 효도 관광까지, 저희는 고객님의 생애 모든 소중한 여정을 진심으로 함께합니다.

신뢰와 전문성으로 완벽한 여행을 약속드립니다.
답장 기다리겠습니다. 감사합니다! ✈️

📞 상담 및 문의
• 담당자: (주)클럽모두투어 ${AGENT_NAME}
• 직통전화: 02-951-9004
• 휴대폰: 010-9307-9004`;
                break;

            case 'booking':
                const bookingPriceCalc = `성인 ${price}
(계약금 입금 시 요금으로 확정됩니다.)
+ 0(유류 할증료 매월 변동되며 잔금 시 최종 확정 적용됩니다.) 
${travelersNum > 0 && priceNum > 0 ? ` = ${price} * ${travelersNum}명 = ${totalPriceStr}` : ''}`;

                text = `✈️ [모두투어] 여행 예약 안내

안녕하세요, ${name}님! 모두투어 ${AGENT_NAME}입니다. 😊
예약을 진심으로 감사드립니다.
원활한 여행 준비를 위해 주요 사항을 안내해 드립니다.

──────────────────

Ⅰ. 예약 및 결제 정보

1. 예약 정보
- 예약일자 : ${todayStr}
- 예약/여행자 : ${name}님 ${phone}${travelersNum > 0 ? ` 일행 ${travelersNum}분` : ''}
- 예약번호 : ${bookingNumber || '(예약번호)'}
- 출 발 일 : ${departureDateDisplay}
- 귀 국 일 : ${p?.returnDate || ''}
- 항 공 사 : ${airlineDisplay}
${(() => {
                        if (!p?.itinerary || p.itinerary.length === 0) return '';
                        const out = p.itinerary[0]?.transport;
                        const ret = p.itinerary[p.itinerary.length - 1]?.transport;
                        let flightText = '';
                        if (out && out.departureTime) {
                            flightText += `- 가는편 : ${out.airline || ''} ${out.flightNo || ''} (${out.departureTime} 출발 → ${out.arrivalTime || ''} 도착)\n`;
                        }
                        if (ret && ret.departureTime && p.itinerary.length > 1) {
                            flightText += `- 오는편 : ${ret.airline || ''} ${ret.flightNo || ''} (${ret.departureTime} 출발 → ${ret.arrivalTime || ''} 도착)\n`;
                        }
                        return flightText.trim() ? flightText : '';
                    })()}
- 상세일정 : ${url}
(위 주소를 클릭하시면 일정, 호텔 등 세부 사항을 확인할 수 있습니다.)

──────────────────

2. 상품가 및 결제 안내 (가상계좌 및 카드)

- 상 품 가 : 
${bookingPriceCalc}

- 상품 가격은 예약일에 따라 변동될 수 있습니다.
- 불 포 함 : ${excludedCosts || '가이드팁, 매너 팁, 개인 경비'}
- 상기 상품은 항공, 현지 호텔이 완료되면 확정됩니다.

- 계  약  금: ${deposit}${depositDeadline ? ` (${depositDeadline}까지)` : ''}
${(() => {
                        let extraLines = '';
                        if (addDetails) extraLines += `[추가 비용]\n${addDetails}`;
                        if (discountDetails) extraLines += `[할인 내역]\n${discountDetails}`;
                        return extraLines ? `${extraLines.trim()}\n` : '';
                    })()}- 최종 잔금: ${remainingBalanceStr} (출발 3주전 다시 안내드립니다.)

──────────────────

3. 결제방법
1) 카드결제: 모두투어 홈페이지 혹은 어플을 통해 결제

2) 가상계좌
${bankAccount}
예  금  주 : ${bankHolder}

──────────────────

Ⅱ. 취소 규정 및 계약 진행 일정

1. 취소료 규정 (국외여행 특별약관)
예약/결제 취소 안내
인터넷상에서 예약/결제 취소 및 변경은 불가능하오니, 예약/결제 취소나 여행자정보 변경을 원하시면 반드시 예약담당자에게 연락하여 주시기 바랍니다.

여행자의 여행계약 해제 요청 시 취소료
여행약관에 의거하여 다음과 같이 취소료가 부과됩니다.
[특별약관]
${specialTerms || `■ 여행자의 여행계약 해제 요청 시 여행약관에 의거하여 취소료가 부과됩니다.
- 여행개시(출발일) ~30일전까지 취소 통보 시 - 계약금 환급
- 여행개시(출발일) 29~20일전까지 취소 통보 시 - 여행경비의 10% 배상
- 여행개시(출발일) 19~10일전까지 취소 통보 시 - 여행경비의 15% 배상
- 여행개시(출발일) 9~8일전까지 취소 통보 시 - 여행경비의 20% 배상
- 여행개시(출발일) 7~1일전까지 취소 통보 시 - 여행경비의 30% 배상
- 여행개시(출발일) 당일 취소 통보 시 - 여행경비의 50% 배상`}

여행 취소 접수 안내
- 취소는 업무시간 내 접수 시 확인 및 적용이 가능합니다.
- 업무시간은 월-금 09:00~18:00 (주말,공휴일 제외)

2. 계약 진행 일정
1) 계약 시: 계약금 및 여권 수령
2) 계약 시: 호텔 및 항공 확보
3) 출발 3~5주 전: 공항버스 예약
4) 출발 3주 전: 잔금 납부
5) 출발 1주 전: 최종 안내서 배부
6) 출발 2~5일 전: 호텔/일정 확정, 가이드 배정
7) 출발: 즐거운 여행!

📞 상담 및 문의
• 담당자: 모두투어 ${AGENT_NAME}
• 직통전화: 02-951-9004
• 휴대폰: 010-9307-9004`;
                break;

            case 'dotcom':
                text = `✈️  여행 예약 안내

${name}(${phone}) 고객님, 안녕하세요! 😊
이번 여행의 담당자로 배정된 모두투어 ${AGENT_NAME}입니다.

신속한 예약을 위해 현재 항공, 호텔 확인 중이며,
잠시 후 예약 관련 안내를 위해 전화 드리겠습니다.
통화하기 편한 시간 알려주시면 좋습니다. 

📋 예약 확인 내역
• 여 행 지 : ${dest}
• 출 발 일 : ${departureDateDisplay}
• 인      원: 총 ${travelersNum > 0 ? travelersNum : '(미정)'}명
• 예약상품 : ${url || '(일정표 링크)'}

기타 궁금하신 점은 아래 연락처로 언제든 편하게 문의해 주세요.
고객님의 즐거운 여행을 위해 정성을 다해 준비하겠습니다!

📞 상담 및 문의
• 담당자: (주)클럽모두투어 ${AGENT_NAME}
• 직통전화: 02-951-9004
• 휴대폰: 010-9307-9004

감사합니다. ${AGENT_NAME} 드림`;
                break;

            case 'pre_4w':
                text = `✈️ [모두투어] 출발 전 필수 체크사항 안내 (담당: ${AGENT_NAME})

안녕하세요, ${name}님! (주)클럽모두투어 ${AGENT_NAME}입니다. 😊
${dest} 여행 출발이 어느덧 한 달 앞으로 다가왔습니다.
미리 챙기시면 좋은 체크사항들을 안내해 드립니다.

1. 현금영수증
- 현금 결제 부분만 발행 가능
- 담당자에게 번호 알려주세요

──────────────────

2. 모두투어 회원가입 (마일리지 적립)

🎁 신규가입 혜택
- 2만원 할인 쿠폰 발행 (현금처럼 사용 가능)
- 모두투어 마일리지 적립 (항공사 마일리지와 별도)
- 다음 여행 시 현금처럼 사용 가능

📝 가입 방법
- 가입 사이트: https://www.modetour.com/
- 거래처명: "클럽모두" 입력
- 개인별 가입 필수

⚠️ 중요 안내
- 출발 전 미가입 시 마일리지 적립 불가
- 가입 후 전체 일행의 스마트폰 번호를 각각 알려주셔야 적립됨

💳 2만원 쿠폰 사용 순서
1) "신규" 회원가입 (광고수신 동의 필수)
2) 로그아웃 후 1회 로그인
3) 쿠폰함에서 2만원 확인 후 결제 시 사용

──────────────────

3. 인천공항 버스 예약 (필수!) - 광주권 출발 고객

🚌 예약 정보
- 수속 시작: 출발 3시간 전부터
- 시간에 맞는 버스로 예약하세요

🔗 예약 사이트
- 상행버스: https://www.kobus.co.kr/main.do (출발 1달 전~)
- 하행버스: https://txbus.t-money.co.kr/main.do (출발 2~3주 전~)

📞 예약 후
- 예약한 버스 시간을 여행사에 알려주세요

📞 상담 및 문의
• 담당자: (주)클럽모두투어 ${AGENT_NAME}
• 직통전화: 02-951-9004
• 휴대폰: 010-9307-9004`;
                break;

            case 'balance': {
                let detailBreakdown = '';
                if (addDetails) detailBreakdown += `\n[추가 비용]\n${addDetails.trim()}`;
                if (discountDetails) detailBreakdown += `\n[할인 내역]\n${discountDetails.trim()}`;

                text = `✈️ [모두투어] 여행 상품 잔금 결제 안내 (담당: ${AGENT_NAME})

안녕하세요, ${name}님! (주)클럽모두투어 ${AGENT_NAME}입니다. 😊
기다려주신 ${dest} 여행이 이제 곧 시작됩니다!
안전하고 즐거운 여행을 위해 기간 내 잔금 결제 부탁드립니다.

──────────────────

💳 납부 금액
- 상품 총액: ${totalPriceStr} (${travelersNum}인)
- 기납 계약금: -${totalDepositStr}원 (납부 완료)${detailBreakdown ? `\n${detailBreakdown}` : ''}
──────────────────
- 최종 결제 잔금: ${remainingBalanceStr}

──────────────────

📅 납부 기한
- ${selectedCustomer?.balanceDueDate || '출발 3주 전'}까지

──────────────────

💡 결제 방법
1) 가상계좌 입금
${bankAccount}
예금주 : ${bankHolder}

2) 카드 결제
- 모두투어 홈페이지 마이페이지에서 직접 결제

──────────────────

📞 담당자 정보
(주)클럽모두투어 ${AGENT_NAME}
- 전화: 02-951-9004
- 휴대폰: 010-9307-9004`;
                break;
            }

            case 'ticket':
                text = `✈️ [모두투어] 항공권 발권 및 좌석 지정 안내

안녕하세요, ${name}님! 
항공권 발권이 완료되었습니다.
편안한 여행을 위해 좌석을 미리 지정하세요.

──────────────────

🪑 좌석 지정 방법

1. 온라인 사전 신청 (항공사 홈페이지)
- 예약번호로 접속하여 좌석 선택
- 좌석 위치에 따라 추가 요금 발생
- 출발 1~2일 전 무료 지정 가능


2. 온라인 체크인 (출발 24시간 전)
- 항공사 홈페이지/앱에서 체크인 후 변경 가능
- 무료 좌석 지정 최종 기회

3. 공항 카운터 (당일)
- 잔여 좌석 범위 내에서 조정 요청

──────────────────

📞 문의처
• 각 항공사 고객센터: ${airlineDisplay || '[항공사명]'}

──────────────────

⚠️ 주의사항
- 항공사마다 좌석 지정 요건이 다릅니다.
- 기종 변경 시 좌석이 재배정될 수 있습니다

즐거운 여행 되세요! ✈️`;
                break;

            case 'confirmation':
                text = `안녕하세요! ${name} 고객님
이번 여행의 모바일 가이드북을 보내드립니다. ✈️

1. 세부 일정은 아래 모두투어 일정표를 기준으로 움직입니다.
${url}

2. 아래 가이드북은 모두투어 일정을 바탕으로 고객님의 여행 날짜에 맞게 저희 여행사에서 별도로 만들었습니다. 

📍 날씨 정보
🧳 준비물 
💰 환전 정보
📞 로밍
🗺️ 여행지 가이드 
등을 담았습니다.

출발 전 아래 링크에서 확인하셔서 
즐거운 여행을 만드세요! 🌟
${confirmationLink}`;
                break;

            case 'departure':
                text = `✈️ [모두투어] 드디어 출발! 즐거운 여행 되세요! (담당: ${AGENT_NAME})

안녕하세요, ${name}님! (주)클럽모두투어 ${AGENT_NAME}입니다. 😊
드디어 기다리시던 ${dest} 여행 출발일입니다!

짐은 빠짐없이 잘 챙기셨나요? 🧳
공항에는 항공기 출발 최소 3시간 전에는 도착하셔서 여유 있게 수속하시길 권장드립니다.

──────────────────

현지에서 혹시라도 비상상황이 발생하거나 도움이 필요하실 경우 아래 연락처로 연락 주세요.
📞 현지 비상연락처: (현지 연락처)

──────────────────

설레는 마음 가득 안고 조심히 잘 다녀오세요!
${name}님의 여행이 눈부시게 아름답길 진심으로 응원합니다. ✨

${AGENT_NAME} 드림 ✈️`;
                break;

            case 'happy_call':
                text = `✈️ [모두투어] 여행은 즐거우셨나요? 해피콜 안내 (담당: ${AGENT_NAME})

안녕하세요, ${name}님! (주)클럽모두투어 ${AGENT_NAME}입니다. 😊
${dest} 여행은 무사히 잘 다녀오셨나요? 일상으로 돌아오신 소감이 어떠신지 궁금합니다.

이번 여행이 ${name}님께 소중한 추억으로 남았길 진심으로 바라며,
바쁘시겠지만 소중한 여행 후기 한 줄 부탁드려도 될까요? 📝
${name}님의 진솔한 후기는 저에게도 큰 힘이 됩니다!

──────────────────

🔗 후기 남기러 가기: ${reviewLink || '(후기 링크)'}

──────────────────

다음 여행도 ${name}님께 가장 완벽한 일정으로 준비해 드리겠습니다.
항상 감사드립니다! 💖

📞 상담 및 문의
• 담당자: (주)클럽모두투어 ${AGENT_NAME}
• 직통전화: 02-951-9004
• 휴대폰: 010-9307-9004`;
                break;
            case 'china_barcode':
                text = `📱 중국 입국 온라인 출입국 바코드 안내

안녕하세요!
중국 입국 시 필요한 온라인 출입국 바코드를 준비했습니다.

──────────────────

✅ 준비 방법

1️⃣ 바코드 다운로드
   스마트폰에 바코드 이미지를 저장하세요

2️⃣ 중국 도착 후
   공항 입국심사 시 직원이 보여달라고 요청할 수 있습니다

3️⃣ 제시 방법
   스마트폰 사진으로 보여주면 됩니다
   (인쇄 불필요)

──────────────────

📌 참고사항

• 기본적으로 전산에 기록되어 있어 확인하지 않을 수도 있습니다
• 요청 시에만 제시하면 되므로 항상 준비해두세요


──────────────────

궁금한 점은 언제든 연락주세요
☎️ 062-269-9362 / 010-9307-9004`;
                break;
        }

        setGeneratedText(text);
        setRemainingBalance(remainingBalanceStr);
    }

    function handleCopy() {
        navigator.clipboard.writeText(generatedText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    // 필터링된 고객 목록
    const filteredCustomers = customers.filter((c) =>
        c.name.includes(searchQuery) ||
        c.phone.includes(searchQuery) ||
        c.destination?.includes(searchQuery)
    );

    return (
        <div className="msg-creator">
            {/* 왼쪽 설정 패널 */}
            <div className="msg-settings">
                {/* 고객 선택 */}
                <div>
                    <div className="msg-section-title">👤 고객 선택</div>
                    {selectedCustomer ? (
                        <div className="msg-selected-customer">
                            <div className="msg-selected-info">
                                <div className="msg-selected-name">{selectedCustomer.name}</div>
                                <div className="msg-selected-detail">
                                    {selectedCustomer.phone} · {selectedCustomer.destination || '목적지 미정'}
                                </div>
                            </div>
                            <button
                                className="msg-clear-btn"
                                onClick={() => { setSelectedCustomer(null); setSearchQuery(''); }}
                            >
                                ✕
                            </button>
                        </div>
                    ) : (
                        <div className="msg-customer-search" ref={dropdownRef}>
                            <input
                                className="msg-search-input"
                                placeholder={loadingCustomers ? '로딩중...' : '고객명 또는 연락처 검색...'}
                                value={searchQuery}
                                onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true); }}
                                onFocus={() => setShowDropdown(true)}
                            />
                            {showDropdown && filteredCustomers.length > 0 && (
                                <div className="msg-customer-dropdown">
                                    {filteredCustomers.map((c, i) => (
                                        <div
                                            key={i}
                                            className="msg-customer-item"
                                            onClick={() => {
                                                setSelectedCustomer(c);
                                                setShowDropdown(false);
                                                setSearchQuery('');
                                            }}
                                        >
                                            <div className="msg-customer-name">{c.name}</div>
                                            <div className="msg-customer-phone">{c.phone}</div>
                                            {c.destination && (
                                                <div className="msg-customer-dest">{c.destination} {c.departureDate}</div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* URL 입력 */}
                <div>
                    <div className="msg-section-title">🔗 상품 URL</div>
                    <div className="msg-url-row">
                        <input
                            className="msg-url-input"
                            placeholder="모두투어 상품 URL 입력..."
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                        />
                        {(templateType === 'booking' || templateType === 'balance') && (
                            <button
                                className="msg-fetch-btn"
                                onClick={fetchProductInfo}
                                disabled={!url || loadingProduct}
                            >
                                {loadingProduct ? '분석중...' : '추출'}
                            </button>
                        )}
                    </div>
                </div>

                {/* 템플릿 유형 */}
                <div>
                    <div className="msg-section-title">📋 멘트 유형</div>
                    <div className="msg-template-tabs">
                        {(Object.keys(TEMPLATE_LABELS) as TemplateType[]).map((type) => (
                            <button
                                key={type}
                                className={`msg-tab ${templateType === type ? 'active' : ''}`}
                                onClick={() => setTemplateType(type)}
                            >
                                {TEMPLATE_LABELS[type].icon} {TEMPLATE_LABELS[type].label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 추가 입력 필드 (예약확정 전용) */}
                {templateType === 'booking' && (
                    <div>
                        <div className="msg-section-title">📝 추가 정보</div>
                        <div className="msg-fields-grid">
                            <div className="msg-field full">
                                <label className="msg-field-label">예약번호</label>
                                <input
                                    className="msg-field-input"
                                    placeholder="51202764"
                                    value={bookingNumber}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setBookingNumber(val);
                                        // 예약번호가 입력되면 확정서 링크도 업데이트 시도
                                        if (val && val.trim() !== '') {
                                            const baseUrl = 'https://clubmode.vercel.app';
                                            setConfirmationLink(`${baseUrl}/confirmation/${val.trim()}`);
                                        }
                                    }}
                                />
                            </div>
                            <div className="msg-field">
                                <label className="msg-field-label">일행 수 (인원)</label>
                                <input
                                    className="msg-field-input"
                                    placeholder="7"
                                    type="number"
                                    value={travelers}
                                    onChange={(e) => setTravelers(e.target.value)}
                                />
                            </div>
                            <div className="msg-field">
                                <label className="msg-field-label">1인 상품가 (숫자)</label>
                                <input
                                    className="msg-field-input"
                                    placeholder="1290000"
                                    value={productPrice}
                                    onChange={(e) => setProductPrice(e.target.value)}
                                />
                            </div>
                            <div className="msg-field">
                                <label className="msg-field-label">
                                    총 잔금
                                    {travelers && productPrice ? ' (자동계산)' : ''}
                                </label>
                                <input
                                    className="msg-field-input"
                                    readOnly
                                    value={
                                        (() => {
                                            const pNum = extractPriceNumber(productPrice);
                                            const tNum = parseInt(travelers, 10) || 0;
                                            if (pNum > 0 && tNum > 0) return `${formatPrice(pNum * tNum)}원`;
                                            return '인원 입력 시 자동 계산';
                                        })()
                                    }
                                    style={{ color: travelers && productPrice ? 'var(--accent-primary)' : 'var(--text-muted)', fontWeight: travelers && productPrice ? 600 : 400 }}
                                />
                            </div>
                            <div className="msg-field">
                                <label className="msg-field-label">계약금</label>
                                <input
                                    className="msg-field-input"
                                    value={deposit}
                                    onChange={(e) => setDeposit(e.target.value)}
                                />
                            </div>
                            <div className="msg-field">
                                <label className="msg-field-label">1인 기납금 (숫자)</label>
                                <input
                                    className="msg-field-input"
                                    placeholder="800000"
                                    type="number"
                                    value={depositPerPerson}
                                    onChange={(e) => setDepositPerPerson(e.target.value)}
                                />
                            </div>
                            <div className="msg-field">
                                <label className="msg-field-label">계약금 마감일</label>
                                <input
                                    className="msg-field-input"
                                    placeholder="2월 9일"
                                    value={depositDeadline}
                                    onChange={(e) => setDepositDeadline(e.target.value)}
                                />
                            </div>
                            <div className="msg-field">
                                <label className="msg-field-label">출발일</label>
                                <input
                                    className="msg-field-input"
                                    placeholder="2024-05-20"
                                    value={departureDate}
                                    onChange={(e) => setDepartureDate(e.target.value)}
                                />
                            </div>
                            <div className="msg-field">
                                <label className="msg-field-label">항공사</label>
                                <input
                                    className="msg-field-input"
                                    placeholder="대한항공"
                                    value={airline}
                                    onChange={(e) => setAirline(e.target.value)}
                                />
                            </div>
                            <div className="msg-field full">
                                <label className="msg-field-label">가상계좌</label>
                                <input
                                    className="msg-field-input"
                                    value={bankAccount}
                                    onChange={(e) => setBankAccount(e.target.value)}
                                />
                            </div>
                            <div className="msg-field full">
                                <label className="msg-field-label">
                                    불포함 사항
                                    {product?.exclusions && product.exclusions.length > 0 ? ' (URL에서 자동 추출됨)' : ''}
                                </label>
                                <input
                                    className="msg-field-input"
                                    placeholder="가이드팁, 매너 팁, 개인 경비"
                                    value={excludedCosts}
                                    onChange={(e) => setExcludedCosts(e.target.value)}
                                />
                            </div>
                            <div className="msg-field full">
                                <label className="msg-field-label">[특별약관] 취소 규정 {product?.specialTerms ? ' (URL에서 자동 추출됨)' : ''}</label>
                                <textarea
                                    className="msg-field-input"
                                    style={{ height: '120px', resize: 'vertical', paddingTop: '8px' }}
                                    placeholder="취소료 규정 입력..."
                                    value={specialTerms}
                                    onChange={(e) => setSpecialTerms(e.target.value)}
                                />
                            </div>

                            {/* 추가금 / 할인금 동적 다중 입력 폼 */}
                            <div className="msg-field full" style={{ marginTop: '16px', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <label className="msg-field-label" style={{ fontSize: '0.95rem', fontWeight: 'bold', marginBottom: 0 }}>💳 추가 비용 / 할인 혜택</label>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button 
                                            type="button" 
                                            onClick={() => addFeeItem('add')}
                                            style={{ padding: '6px 12px', fontSize: '0.8rem', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                                        >
                                            ➕ 추가금 추가
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => addFeeItem('discount')}
                                            style={{ padding: '6px 12px', fontSize: '0.8rem', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                                        >
                                            ➖ 할인 추가
                                        </button>
                                    </div>
                                </div>

                                {feeItems.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                                        {feeItems.map((item) => (
                                            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: item.type === 'add' ? '1px solid rgba(239,68,68,0.1)' : '1px solid rgba(59,130,246,0.1)' }}>
                                                <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', backgroundColor: item.type === 'add' ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)', color: item.type === 'add' ? '#ef4444' : '#3b82f6' }}>
                                                    {item.type === 'add' ? '추가' : '할인'}
                                                </span>
                                                <input
                                                    className="msg-field-input"
                                                    placeholder={item.type === 'add' ? '명칭 (예: 비자비)' : '명칭 (예: 단체할인)'}
                                                    value={item.label}
                                                    onChange={(e) => updateFeeItem(item.id, { label: e.target.value })}
                                                    style={{ flex: 2, height: '34px', fontSize: '0.85rem', marginBottom: 0 }}
                                                />
                                                <input
                                                    className="msg-field-input"
                                                    placeholder="금액 (숫자)"
                                                    type="number"
                                                    value={item.amount}
                                                    onChange={(e) => updateFeeItem(item.id, { amount: e.target.value })}
                                                    style={{ flex: 1.5, height: '34px', fontSize: '0.85rem', marginBottom: 0 }}
                                                />
                                                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>원</span>
                                                <div style={{ display: 'flex', gap: '6px', fontSize: '0.8rem' }}>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '2px', cursor: 'pointer', marginBottom: 0 }}>
                                                        <input
                                                            type="radio"
                                                            checked={item.applyType === 'per_person'}
                                                            onChange={() => updateFeeItem(item.id, { applyType: 'per_person' })}
                                                        />
                                                        인당
                                                    </label>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '2px', cursor: 'pointer', marginBottom: 0 }}>
                                                        <input
                                                            type="radio"
                                                            checked={item.applyType === 'total'}
                                                            onChange={() => updateFeeItem(item.id, { applyType: 'total' })}
                                                        />
                                                        전체
                                                    </label>
                                                </div>
                                                <button 
                                                    type="button" 
                                                    onClick={() => removeFeeItem(item.id)}
                                                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '1rem', cursor: 'pointer', padding: '0 4px' }}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* 🔒 최종 잔금 수동 조정 */}
                            <div className="msg-field full" style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <label className="msg-field-label" style={{ marginBottom: 0 }}>🔒 최종 결제 잔금</label>
                                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.8rem', gap: '6px', color: 'var(--text-muted)', marginBottom: 0 }}>
                                        <input
                                            type="checkbox"
                                            checked={isManualBalance}
                                            onChange={(e) => setIsManualBalance(e.target.checked)}
                                        />
                                        직접 금액 타이핑 (수동 조정)
                                    </label>
                                </div>
                                {isManualBalance ? (
                                    <input
                                        className="msg-field-input"
                                        placeholder="예: 1,354,200원 (원하는 텍스트 자유 입력)"
                                        value={manualBalanceValue}
                                        onChange={(e) => setManualBalanceValue(e.target.value)}
                                        style={{ borderColor: 'var(--accent-primary)', fontWeight: 600, color: 'var(--accent-primary)' }}
                                    />
                                ) : (
                                    <input
                                        className="msg-field-input"
                                        readOnly
                                        value={remainingBalance}
                                        style={{ color: 'var(--accent-primary)', fontWeight: 600 }}
                                    />
                                )}
                            </div>

                        </div>
                    </div>
                )}

                {/* 잔금안내 전용 추가 필드 */}
                {templateType === 'balance' && (
                    <div>
                        <div className="msg-section-title">📝 잔금 정보</div>
                        <div className="msg-fields-grid">
                            <div className="msg-field">
                                <label className="msg-field-label">1인 상품가 (숫자)</label>
                                <input
                                    className="msg-field-input"
                                    placeholder="1290000"
                                    value={productPrice}
                                    onChange={(e) => setProductPrice(e.target.value)}
                                />
                            </div>
                            <div className="msg-field">
                                <label className="msg-field-label">일행 수 (인원)</label>
                                <input
                                    className="msg-field-input"
                                    placeholder="7"
                                    type="number"
                                    value={travelers}
                                    onChange={(e) => setTravelers(e.target.value)}
                                />
                            </div>
                            <div className="msg-field">
                                <label className="msg-field-label">1인 기납금 (숫자)</label>
                                <input
                                    className="msg-field-input"
                                    placeholder="800000"
                                    type="number"
                                    value={depositPerPerson}
                                    onChange={(e) => setDepositPerPerson(e.target.value)}
                                />
                            </div>
                            <div className="msg-field full">
                                <label className="msg-field-label">
                                    잔금 자동계산
                                </label>
                                <input
                                    className="msg-field-input"
                                    readOnly
                                    value={
                                        (() => {
                                            const pNum = extractPriceNumber(productPrice);
                                            const tNum = parseInt(travelers, 10) || 1;
                                            const dPP = parseInt(depositPerPerson.replace(/[^0-9]/g, ''), 10) || 0;
                                            const total = pNum * tNum;
                                            const paid = dPP * tNum;
                                            const remaining = total - paid;
                                            if (pNum > 0 && dPP > 0) return `${formatPrice(total)}원 - ${formatPrice(paid)}원 = ${formatPrice(remaining)}원`;
                                            if (pNum > 0) return `총 ${formatPrice(total)}원 (기납금 입력 시 잔금 계산)`;
                                            return '1인 상품가 입력 시 자동 계산';
                                        })()
                                    }
                                    style={{ color: 'var(--accent-primary)', fontWeight: 600 }}
                                />
                            </div>
                            <div className="msg-field full">
                                <label className="msg-field-label">가상계좌</label>
                                <input
                                    className="msg-field-input"
                                    value={bankAccount}
                                    onChange={(e) => setBankAccount(e.target.value)}
                                />
                            </div>

                            {/* 추가금 / 할인금 동적 다중 입력 폼 */}
                            <div className="msg-field full" style={{ marginTop: '16px', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <label className="msg-field-label" style={{ fontSize: '0.95rem', fontWeight: 'bold', marginBottom: 0 }}>💳 추가 비용 / 할인 혜택</label>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button 
                                            type="button" 
                                            onClick={() => addFeeItem('add')}
                                            style={{ padding: '6px 12px', fontSize: '0.8rem', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                                        >
                                            ➕ 추가금 추가
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => addFeeItem('discount')}
                                            style={{ padding: '6px 12px', fontSize: '0.8rem', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                                        >
                                            ➖ 할인 추가
                                        </button>
                                    </div>
                                </div>

                                {feeItems.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                                        {feeItems.map((item) => (
                                            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: item.type === 'add' ? '1px solid rgba(239,68,68,0.1)' : '1px solid rgba(59,130,246,0.1)' }}>
                                                <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', backgroundColor: item.type === 'add' ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)', color: item.type === 'add' ? '#ef4444' : '#3b82f6' }}>
                                                    {item.type === 'add' ? '추가' : '할인'}
                                                </span>
                                                <input
                                                    className="msg-field-input"
                                                    placeholder={item.type === 'add' ? '명칭 (예: 비자비)' : '명칭 (예: 단체할인)'}
                                                    value={item.label}
                                                    onChange={(e) => updateFeeItem(item.id, { label: e.target.value })}
                                                    style={{ flex: 2, height: '34px', fontSize: '0.85rem', marginBottom: 0 }}
                                                />
                                                <input
                                                    className="msg-field-input"
                                                    placeholder="금액 (숫자)"
                                                    type="number"
                                                    value={item.amount}
                                                    onChange={(e) => updateFeeItem(item.id, { amount: e.target.value })}
                                                    style={{ flex: 1.5, height: '34px', fontSize: '0.85rem', marginBottom: 0 }}
                                                />
                                                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>원</span>
                                                <div style={{ display: 'flex', gap: '6px', fontSize: '0.8rem' }}>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '2px', cursor: 'pointer', marginBottom: 0 }}>
                                                        <input
                                                            type="radio"
                                                            checked={item.applyType === 'per_person'}
                                                            onChange={() => updateFeeItem(item.id, { applyType: 'per_person' })}
                                                        />
                                                        인당
                                                    </label>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '2px', cursor: 'pointer', marginBottom: 0 }}>
                                                        <input
                                                            type="radio"
                                                            checked={item.applyType === 'total'}
                                                            onChange={() => updateFeeItem(item.id, { applyType: 'total' })}
                                                        />
                                                        전체
                                                    </label>
                                                </div>
                                                <button 
                                                    type="button" 
                                                    onClick={() => removeFeeItem(item.id)}
                                                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '1rem', cursor: 'pointer', padding: '0 4px' }}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* 🔒 최종 잔금 수동 조정 */}
                            <div className="msg-field full" style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <label className="msg-field-label" style={{ marginBottom: 0 }}>🔒 최종 결제 잔금</label>
                                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.8rem', gap: '6px', color: 'var(--text-muted)', marginBottom: 0 }}>
                                        <input
                                            type="checkbox"
                                            checked={isManualBalance}
                                            onChange={(e) => setIsManualBalance(e.target.checked)}
                                        />
                                        직접 금액 타이핑 (수동 조정)
                                    </label>
                                </div>
                                {isManualBalance ? (
                                    <input
                                        className="msg-field-input"
                                        placeholder="예: 1,354,200원 (원하는 텍스트 자유 입력)"
                                        value={manualBalanceValue}
                                        onChange={(e) => setManualBalanceValue(e.target.value)}
                                        style={{ borderColor: 'var(--accent-primary)', fontWeight: 600, color: 'var(--accent-primary)' }}
                                    />
                                ) : (
                                    <input
                                        className="msg-field-input"
                                        readOnly
                                        value={remainingBalance}
                                        style={{ color: 'var(--accent-primary)', fontWeight: 600 }}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {templateType === 'confirmation' && (
                    <div>
                        <div className="msg-section-title">📖 확정서 정보</div>
                        <div className="msg-fields-grid">
                            <div className="msg-field full">
                                <label className="msg-field-label">확정서(가이드북) 링크</label>
                                <input
                                    className="msg-field-input"
                                    placeholder="https://clubmode.vercel.app/confirmation/..."
                                    value={confirmationLink}
                                    onChange={(e) => setConfirmationLink(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {templateType === 'happy_call' && (
                    <div>
                        <div className="msg-section-title">📞 후기 정보</div>
                        <div className="msg-fields-grid">
                            <div className="msg-field full">
                                <label className="msg-field-label">여행 후기 작성 링크</label>
                                <input
                                    className="msg-field-input"
                                    placeholder="https://www.modetour.com/..."
                                    value={reviewLink}
                                    onChange={(e) => setReviewLink(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* 생성 버튼 */}
                <button
                    className="msg-generate-btn"
                    onClick={generateMessage}
                >
                    ✨ 멘트 생성
                </button>
            </div>

            {/* 오른쪽 미리보기 */}
            <div className="msg-preview-panel">
                <div className="msg-preview-header">
                    <div className="msg-preview-title">
                        {TEMPLATE_LABELS[templateType].icon} {TEMPLATE_LABELS[templateType].label} 미리보기
                    </div>
                    {generatedText && (
                        <button
                            className={`msg-copy-btn ${copied ? 'copied' : ''}`}
                            onClick={handleCopy}
                        >
                            {copied ? '✅ 복사됨' : '📋 복사'}
                        </button>
                    )}
                </div>
                <div className="msg-preview-body">
                    {generatedText ? (
                        <textarea
                            className="msg-preview-textarea"
                            value={generatedText}
                            onChange={(e) => setGeneratedText(e.target.value)}
                        />
                    ) : (
                        <div className="msg-preview-empty">
                            <div className="msg-preview-empty-icon">✉️</div>
                            <div className="msg-preview-empty-text">
                                고객과 상품을 선택한 후 &quot;멘트 생성&quot;을 눌러주세요
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

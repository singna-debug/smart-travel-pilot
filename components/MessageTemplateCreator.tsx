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
    timestamp: string;
}

interface ProductInfo {
    title: string;
    price: string;
    destination: string;
    departureDate: string;
    airline: string;
    duration: string;
    departureAirport: string;
    keyPoints: string[];
    exclusions: string[];
}

type TemplateType = 'booking' | 'remind' | 'balance' | 'postTrip';

const TEMPLATE_LABELS: Record<TemplateType, { label: string; icon: string }> = {
    booking: { label: '예약확정', icon: '✅' },
    remind: { label: '리마인드', icon: '⏰' },
    balance: { label: '잔금안내', icon: '💰' },
    postTrip: { label: '여행후/후기', icon: '🏖️' },
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

    const [templateType, setTemplateType] = useState<TemplateType>('booking');

    // 추가 입력 필드
    const [bookingNumber, setBookingNumber] = useState('');
    const [travelers, setTravelers] = useState('');
    const [deposit, setDeposit] = useState('1인 80만원');
    const [depositDeadline, setDepositDeadline] = useState('');
    const [bankAccount, setBankAccount] = useState('신한은행 : 56217390843309');
    const [bankHolder, setBankHolder] = useState('모두투어네트워크');
    const [excludedCosts, setExcludedCosts] = useState('');
    const [depositPerPerson, setDepositPerPerson] = useState('');

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

    // 고객 선택 시 URL 자동 입력
    useEffect(() => {
        if (selectedCustomer?.url) {
            setUrl(selectedCustomer.url);
        }
    }, [selectedCustomer]);

    // 상품 정보 로드 시 불포함사항 자동 입력
    useEffect(() => {
        if (product?.exclusions && product.exclusions.length > 0) {
            setExcludedCosts(product.exclusions.join(', '));
        }
    }, [product]);

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
        try {
            const res = await fetch('/api/analyze-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
            });
            const data = await res.json();
            if (data.success && data.data?.raw) {
                setProduct(data.data.raw);
            }
        } catch (e) {
            console.error('상품 정보 로딩 실패:', e);
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
        const price = p?.price || '';
        const airline = p?.airline || '';
        const departureDate = p?.departureDate || customer?.departureDate || '';
        const duration = p?.duration || customer?.duration || '';
        const depAirport = p?.departureAirport || '';
        const today = new Date();
        const todayStr = `${today.getFullYear()}. ${today.getMonth() + 1}. ${today.getDate()}`;

        // 항공사(공항) 포맷
        const airlineDisplay = airline + (depAirport ? `(${depAirport})` : '');

        // 잔금 자동 계산: 인당가격 * 인원수
        const priceNum = extractPriceNumber(price);
        const travelersNum = parseInt(travelers, 10) || 0;
        const totalPrice = priceNum * travelersNum;
        const totalPriceStr = totalPrice > 0 ? `${formatPrice(totalPrice)}원` : '';

        // 잔금 표시 문자열
        let priceCalcLine = `성인 ${price}(계약금 입금 시 요금으로 확정됩니다.)
+ 0(유류 할증료 매월 변동되며 잔금 시 최종 확정 적용됩니다.)`;
        if (travelersNum > 0 && priceNum > 0) {
            priceCalcLine += ` = ${price} * ${travelersNum}명 = ${totalPriceStr}`;
        }

        let text = '';

        switch (templateType) {
            case 'booking':
                text = `✈️ [모두투어] 여행 예약 안내 (담당: ${AGENT_NAME})
안녕하세요, ${name}님! 예약을 진심으로 감사드립니다.
원활한 여행 준비를 위해 주요 사항을 안내해 드립니다.

────────────────────────

Ⅰ. 예약 및 결제 정보

1. 예약 정보

- 예약일자 : ${todayStr}
- 예약/여행자 : ${name}님 ${phone}${travelersNum > 0 ? ` 일행 ${travelersNum}분` : ''}
- 예약번호 : ${bookingNumber || '(예약번호)'}
- 출 발 일 : ${departureDate}
- 상품제목 : ${title}

- 상세일정 : ${url}
(위 주소를 클릭하시면. 일정, 호텔 등 세부 사항을 확인할 수 있습니다.)
- 항 공 사 :  ${airlineDisplay}

────────────────────────

2. 상품가 및 결제 안내 (가상계좌 및 카드)

- 상 품 가 : 
${priceCalcLine}

- 상품 가격은 예약일에 따라 변동될 수 있습니다.
- 불 포 함 : ${excludedCosts || '가이드팁, 매너 팁, 개인 경비'}
- 상기 상품은 항공, 현지 호텔이 완료되면 확정됩니다.

- 계  약  금: ${deposit}${depositDeadline ? ` (${depositDeadline}까지)` : ''}
- 잔       금: 출발 3주전 다시 안내드립니다.

────────────────────────

3. 결제방법
1) 카드결제: 모두투어 홈페이지 혹은 어플을 통해 결제

2) 가상계좌
${bankAccount}
예  금  주 : ${bankHolder}
────────────────────────

Ⅱ. 취소 규정 및 계약 진행 일정

1. 취소료 규정 (국외여행 특별약관)

예약/결제 취소 안내
인터넷상에서 예약/결제 취소 및 변경은 불가능하오니, 예약/결제 취소나 여행자정보 변경을 원하시면 반드시 예약담당자에게 연락하여 주시기 바랍니다.

여행자의 여행계약 해제 요청 시 취소료
여행약관에 의거하여 다음과 같이 취소료가 부과됩니다.
[특별약관]
■ 여행자의 여행계약 해제 요청 시 여행약관에 의거하여 취소료가 부과됩니다.
- 여행개시(출발일) ~40일전까지 취소 통보 시 - 계약금 환급
- 여행개시(출발일) 39~30일전까지 취소 통보 시 - 여행경비의 20% 배상
- 여행개시(출발일) 29~20일전까지 취소 통보 시 - 여행경비의 40% 배상
- 여행개시(출발일) 19~8일전까지 취소 통보 시 - 여행경비의 60% 배상
- 여행개시(출발일) 7~1일전까지 취소 통보 시 - 여행경비의 90% 배상
- 여행개시(출발일) 당일 취소 통보 시 - 여행경비의 100% 배상

본 상품은 항공료와 숙박비용이 해당 업체로 선납된 상품으로 일반 약관보다 높은 취소 수수료가 적용됩니다.

취소 접수 안내
- 업무시간: 월-금 09:00 ~ 18:00 (주말/공휴일 제외)
- 업무시간 외 접수는 다음 영업일 접수로 간주
- 취소료 발생일은 영업일 기준 (주말/공휴일 제외)`;
                break;

            case 'remind':
                text = `✈️ [모두투어] 출발 안내 (담당: ${AGENT_NAME})

안녕하세요, ${name}님! 😊
다가오는 ${dest} 여행 출발일이 얼마 남지 않았습니다!

📅 출발일: ${departureDate}
✈️ 항공사: ${airlineDisplay}
📦 상품명: ${title}

────────────────────────

📋 출발 전 체크리스트

✅ 여권 유효기간 확인 (입국일 기준 6개월 이상)
✅ 여행자보험 가입 여부 확인
✅ 환전 준비
✅ 짐 꾸리기 (기내 반입 금지 물품 확인)

────────────────────────

📌 주의사항
- 공항에는 출발 2~3시간 전에 도착해 주세요.
- 여권을 반드시 소지해 주세요.
- 기타 궁금한 사항은 언제든 연락 주세요!

담당자 ${AGENT_NAME} 드림 ✈️`;
                break;

            case 'balance': {
                // 기납금 계산
                const depositPP = parseInt(depositPerPerson.replace(/[^0-9]/g, ''), 10) || 0;
                const totalDeposit = depositPP * (travelersNum || 1);
                const remainingBalance = (priceNum * (travelersNum || 1)) - totalDeposit;

                // 상품가 라인
                let balPriceLine = `- 상 품 가: ${price}`;
                if (travelersNum > 0 && priceNum > 0) {
                    balPriceLine = `- 상 품 가: ${price} × ${travelersNum}명 = ${totalPriceStr}`;
                }

                // 기납금 & 잔금 라인
                let balDepositLine = '';
                let balRemainingLine = '';
                if (depositPP > 0) {
                    balDepositLine = `- 기 납 금: ${formatPrice(depositPP)}원 × ${travelersNum || 1}명 = ${formatPrice(totalDeposit)}원`;
                    balRemainingLine = `- 잔    금: ${formatPrice(remainingBalance)}원`;
                }

                text = `💰 [모두투어] 잔금 안내 (담당: ${AGENT_NAME})

안녕하세요, ${name}님! 😊
${dest} 여행 잔금 결제 안내드립니다.

📦 상품명: ${title}
📅 출발일: ${departureDate}

────────────────────────

💳 잔금 결제 안내

- 잔금 마감일: ${selectedCustomer?.balanceDueDate || '출발 3주 전'}
${balPriceLine}
${balDepositLine ? balDepositLine + '\n' + balRemainingLine : ''}

결제방법:
1) 카드결제: 모두투어 홈페이지 혹은 어플
2) 가상계좌:
${bankAccount}
예금주: ${bankHolder}

────────────────────────

⚠️ 잔금 미납 시 예약이 자동 취소될 수 있으니 기한 내 결제 부탁드립니다.

궁금한 사항이 있으시면 편하게 연락 주세요! 😊
담당자 ${AGENT_NAME} 드림`;
                break;
            }

            case 'postTrip':
                text = `🏖️ [모두투어] 여행 후 인사 (담당: ${AGENT_NAME})

안녕하세요, ${name}님! 😊
${dest} 여행은 잘 다녀오셨나요? ✈️

${duration ? `${duration}간의 ` : ''}여행이 즐거우셨길 바랍니다!
혹시 여행 중 불편하셨던 점이나 개선이 필요한 부분이 있으시면 편하게 말씀해 주세요.

고객님의 소중한 의견은 더 나은 여행 서비스를 위해 적극 반영하겠습니다. 🙏

────────────────────────

⭐ 여행 후기 안내

혹시 시간이 되신다면, 간단한 여행 후기를 남겨주시면 정말 큰 힘이 됩니다!

📝 후기 작성 방법:
- 모두투어 홈페이지 또는 앱 → 마이페이지 → 여행 후기

${name}님의 솔직한 후기는 다른 여행자분들에게 큰 도움이 되고,
저희에게는 더 좋은 서비스를 만들어가는 소중한 자산이 됩니다. ✨

────────────────────────

다음에도 멋진 여행을 함께 준비하겠습니다!
항상 감사드립니다.

담당자 ${AGENT_NAME} 드림 ✈️`;
                break;
        }

        setGeneratedText(text);
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
                        <button
                            className="msg-fetch-btn"
                            onClick={fetchProductInfo}
                            disabled={!url || loadingProduct}
                        >
                            {loadingProduct ? '분석중...' : '추출'}
                        </button>
                    </div>
                    {product && (
                        <div className="msg-product-info" style={{ marginTop: '8px' }}>
                            <strong>{product.title}</strong><br />
                            💰 {product.price} · ✈️ {product.airline}{product.departureAirport ? `(${product.departureAirport})` : ''} · 📅 {product.departureDate}
                            {product.exclusions && product.exclusions.length > 0 && (
                                <><br />🚫 불포함: {product.exclusions.join(', ')}</>
                            )}
                        </div>
                    )}
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
                                    onChange={(e) => setBookingNumber(e.target.value)}
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
                                <label className="msg-field-label">
                                    총 잔금
                                    {travelers && product?.price ? ' (자동계산)' : ''}
                                </label>
                                <input
                                    className="msg-field-input"
                                    readOnly
                                    value={
                                        (() => {
                                            const pNum = extractPriceNumber(product?.price || '');
                                            const tNum = parseInt(travelers, 10) || 0;
                                            if (pNum > 0 && tNum > 0) return `${formatPrice(pNum * tNum)}원`;
                                            return '인원 입력 시 자동 계산';
                                        })()
                                    }
                                    style={{ color: travelers && product?.price ? 'var(--accent-primary)' : 'var(--text-muted)', fontWeight: travelers && product?.price ? 600 : 400 }}
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
                        </div>
                    </div>
                )}

                {/* 잔금안내 전용 추가 필드 */}
                {templateType === 'balance' && (
                    <div>
                        <div className="msg-section-title">📝 잔금 정보</div>
                        <div className="msg-fields-grid">
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
                                            const pNum = extractPriceNumber(product?.price || '');
                                            const tNum = parseInt(travelers, 10) || 1;
                                            const dPP = parseInt(depositPerPerson.replace(/[^0-9]/g, ''), 10) || 0;
                                            const total = pNum * tNum;
                                            const paid = dPP * tNum;
                                            const remaining = total - paid;
                                            if (pNum > 0 && dPP > 0) return `${formatPrice(total)}원 - ${formatPrice(paid)}원 = ${formatPrice(remaining)}원`;
                                            if (pNum > 0) return `총 ${formatPrice(total)}원 (기납금 입력 시 잔금 계산)`;
                                            return '상품 추출 후 자동 계산';
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
                        <div className="msg-preview-text">{generatedText}</div>
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

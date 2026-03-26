const fs = require('fs');
const path = 'c:/Users/vbxn6/.gemini/antigravity/scratch/smart-travel-pilot/app/confirmation/[id]/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// ═══════════════════════════════════════════════════════════════
// (1) WEATHER SECTION - Complete redesign matching reference image
// ═══════════════════════════════════════════════════════════════
const weatherAnchor = '/* ── 날씨 및 복장 ── */';
const customsAnchor = '/* ── 입국·세관 유의사항 ── */';
const weatherStart = content.indexOf(weatherAnchor);
const weatherEnd = content.indexOf(customsAnchor);

if (weatherStart !== -1 && weatherEnd !== -1) {
    const newWeatherBlock = `/* ── 날씨 및 복장 ── */
                            {sr.weather && (
                                <GuideAccordion
                                    id="weather"
                                    title={<><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sec-icon-svg"><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path><circle cx="12" cy="12" r="4"></circle></svg> 날씨 및 여행 복장 가이드</>}
                                    isOpen={expandedSections['weather'] || false}
                                    onToggle={toggleSection}
                                >
                                    {/* 헤더 배너 */}
                                    <div style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', borderRadius: '16px', padding: '20px', marginBottom: '20px', color: '#ffffff', position: 'relative', overflow: 'hidden' }}>
                                        <div style={{ position: 'absolute', top: '-20px', right: '-10px', opacity: 0.15 }}>
                                            <svg width="120" height="120" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path><circle cx="12" cy="12" r="4"></circle></svg>
                                        </div>
                                        <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.85, marginBottom: '6px' }}>WEATHER & CLOTHING GUIDE</div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>날씨 및 여행 복장 가이드</div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 500, marginTop: '4px', opacity: 0.9 }}>{safeStr(sr.weather.month)} 기준</div>
                                    </div>

                                    {/* 기후 개요 카드 */}
                                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', marginBottom: '20px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
                                            <div style={{ background: '#dbeafe', width: '48px', height: '48px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"></path></svg>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Average Climate</div>
                                                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>{safeStr(sr.weather.temperature)}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 여행 복장 가이드 (Layering Tip) */}
                                    <div style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '16px', padding: '20px', marginBottom: '20px' }}>
                                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ background: '#dbeafe', width: '32px', height: '32px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5"><path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.62 1.96v4.42a2 2 0 0 0 .39 1.16l7 9a2 2 0 0 0 3.22 0l7-9a2 2 0 0 0 .39-1.16V5.42a2 2 0 0 0-1.62-1.96z"></path></svg>
                                            </div>
                                            여행 복장 가이드 (Layering Tip)
                                        </div>

                                        {/* 복장 추천 내용 */}
                                        <div style={{ background: '#eff6ff', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px', borderLeft: '4px solid #3b82f6' }}>
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: '2px' }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                                                <p style={{ fontSize: '0.88rem', color: '#1e3a8a', lineHeight: 1.65, margin: 0, wordBreak: 'keep-all' }}>
                                                    {safeStr(sr.weather.clothing)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* 2 Column Cards */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                            <div style={{ background: '#f8fafc', borderRadius: '14px', padding: '16px', border: '1px solid #e2e8f0' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2"><path d="M4 16l4.586-4.586a2 2 0 0 1 2.828 0L16 16m-2-2l1.586-1.586a2 2 0 0 1 2.828 0L20 14"></path><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
                                                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#475569' }}>상의 & 외투</div>
                                                </div>
                                                <p style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.55, margin: 0 }}>통풍이 잘되는 반팔이나 민소매 위주로 준비하세요. 냉방 시설 대비 얇은 가디건이나 바람막이도 챙기세요.</p>
                                            </div>
                                            <div style={{ background: '#f8fafc', borderRadius: '14px', padding: '16px', border: '1px solid #e2e8f0' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
                                                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#475569' }}>신발 & 기타</div>
                                                </div>
                                                <p style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.55, margin: 0 }}>편한 샌들이나 운동화가 필수입니다. 강렬한 햇살 차단을 위해 선글라스, 모자, 선크림(SPF50+)을 챙기세요.</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 종합 추천 세트 요약 */}
                                    <div style={{ background: '#f1f5f9', borderRadius: '16px', padding: '18px', border: '1px solid #e2e8f0' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                            <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#1e293b' }}>종합 추천 세트 (요약)</div>
                                        </div>
                                        <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.6, margin: 0, wordBreak: 'keep-all' }}>
                                            반팔/민소매 3~4벌, 얇은 외투 1벌, 반바지/긴바지, 편한 샌들, 선크림(SPF50+), 선글라스, 모자, 우산 또는 우비를 준비하세요.
                                        </p>
                                    </div>
                                </GuideAccordion>
                            )}

                            `;
    content = content.substring(0, weatherStart) + newWeatherBlock + content.substring(weatherEnd);
}

// ═══════════════════════════════════════════════════════════════
// (2) Replace ALL emojis with SVG icons in Customs section
// ═══════════════════════════════════════════════════════════════

// Replace 🆔 -> passport SVG
content = content.replace(
    /<div style={{ fontSize: '1\.2rem' }}>🆔<\/div>/g,
    '<div style={{ background: "#ccfbf1", width: "32px", height: "32px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2.5"><rect x="2" y="4" width="20" height="16" rx="2"></rect><line x1="6" y1="8" x2="18" y2="8"></line><rect x="6" y="12" width="5" height="4" rx="1"></rect></svg></div>'
);

// Replace ✈️ -> airplane SVG
content = content.replace(
    /<div style={{ fontSize: '1\.2rem' }}>✈️<\/div>/g,
    '<div style={{ background: "#ccfbf1", width: "32px", height: "32px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"></path></svg></div>'
);

// Replace 🏨 -> building SVG
content = content.replace(
    /<div style={{ fontSize: '1\.2rem' }}>🏨<\/div>/g,
    '<div style={{ background: "#ccfbf1", width: "32px", height: "32px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2"><path d="M3 21h18"></path><path d="M5 21V7l8-4v18"></path><path d="M19 21V11l-6-4"></path><path d="M9 9v.01M9 12v.01M9 15v.01M9 18v.01"></path></svg></div>'
);

// Replace 📧 -> mail SVG
content = content.replace(
    /<div style={{ fontSize: '1\.2rem' }}>📧<\/div>/g,
    '<div style={{ background: "#ccfbf1", width: "32px", height: "32px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg></div>'
);

// Replace 🛂 -> shield SVG
content = content.replace(
    /<div style={{ fontSize: '1\.2rem' }}>🛂<\/div>/g,
    '<div style={{ background: "#e0e7ff", width: "36px", height: "36px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg></div>'
);

// Replace 💡 in roaming tip -> lightbulb SVG
content = content.replace(
    /<div style={{ fontSize: '1\.2rem' }}>💡<\/div>/g,
    '<div style={{ background: "#dcfce7", width: "32px", height: "32px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><line x1="9" y1="18" x2="15" y2="18"></line><line x1="10" y1="22" x2="14" y2="22"></line><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"></path></svg></div>'
);

// Replace 💡 emoji in 추가 안내 section (span)
content = content.replace(
    /<span className="sec-icon">💡<\/span>/g,
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sec-icon-svg"><line x1="9" y1="18" x2="15" y2="18"></line><line x1="10" y1="22" x2="14" y2="22"></line><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"></path></svg>'
);

// Replace 🌤️ emoji in weather
content = content.replace(
    /<div style={{ fontSize: '2\.2rem' }}>🌤️<\/div>/g,
    '<div style={{ background: "#dbeafe", width: "48px", height: "48px", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path></svg></div>'
);

// ═══════════════════════════════════════════════════════════════
// (3) Fix the syntax error at line 1308 (missing brace '{')
// ═══════════════════════════════════════════════════════════════
content = content.replace(
    /\n\s*\/\* ── 환전 & 계산기 ── \*\/\}\r?\n/,
    '\n                            {/* ── 환전 & 계산기 ── */}\r\n'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Premium UI redesign applied successfully!');
console.log('- Weather section: Complete redesign with gradient header, clothing guide cards');
console.log('- All emojis replaced with SVG icons');
console.log('- Syntax error at currency section fixed');

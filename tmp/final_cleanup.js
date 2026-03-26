const fs = require('fs');
const path = 'c:/Users/vbxn6/.gemini/antigravity/scratch/smart-travel-pilot/app/confirmation/[id]/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// (1) Target the entire Customs Accordion content
const customsStart = /<GuideAccordion[^>]*?id="customs"[^>]*?>/;
const customsEnd = /<\/GuideAccordion>/;

// I'll use a more surgical approach by finding the block between <GuideAccordion id="customs" ... > and the next </GuideAccordion>
const startIdx = content.indexOf('id="customs"');
if (startIdx !== -1) {
    const openingTagEnd = content.indexOf('>', startIdx) + 1;
    let closingTagStart = content.indexOf('</GuideAccordion>', openingTagEnd);
    
    if (closingTagStart !== -1) {
        const newCustomsContent = `
                                 {/* (1) 국가별 필수 입국 절차 (Arrival Procedure) */}
                                 {sr.customs?.arrivalProcedure && sr.customs.arrivalProcedure.steps?.length > 0 && (
                                     <div style={{ marginBottom: '24px' }}>
                                         <div className="mc-section-header-sm" style={{ color: '#0d9488', borderBottom: '2px solid #0d9488', paddingBottom: '8px', marginBottom: '16px', fontSize: '0.95rem', fontWeight: 800 }}>
                                             {safeStr(sr.customs.arrivalProcedure.title)}
                                         </div>
                                         <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                                             <div style={{ background: '#f0fdfa', padding: '12px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid #ccfbf1' }}>
                                                 <div style={{ fontSize: '1.2rem' }}>🆔</div>
                                                 <div>
                                                     <div style={{ fontSize: '0.7rem', color: '#0d9488', fontWeight: 800 }}>여권 정보</div>
                                                     <div style={{ fontSize: '0.78rem', color: '#115e59', fontWeight: 600 }}>여권번호, 만료일</div>
                                                 </div>
                                             </div>
                                             <div style={{ background: '#f0fdfa', padding: '12px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid #ccfbf1' }}>
                                                 <div style={{ fontSize: '1.2rem' }}>✈️</div>
                                                 <div>
                                                     <div style={{ fontSize: '0.7rem', color: '#0d9488', fontWeight: 800 }}>항공편 정보</div>
                                                     <div style={{ fontSize: '0.78rem', color: '#115e59', fontWeight: 600 }}>{safeStr(doc.flight.airline)}</div>
                                                 </div>
                                             </div>
                                             <div style={{ background: '#f0fdfa', padding: '12px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid #ccfbf1' }}>
                                                 <div style={{ fontSize: '1.2rem' }}>🏨</div>
                                                 <div>
                                                     <div style={{ fontSize: '0.7rem', color: '#0d9488', fontWeight: 800 }}>체류 주소</div>
                                                     <div style={{ fontSize: '0.78rem', color: '#115e59', fontWeight: 600 }}>호텔 영문명 및 주소</div>
                                                 </div>
                                             </div>
                                             <div style={{ background: '#f0fdfa', padding: '12px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid #ccfbf1' }}>
                                                 <div style={{ fontSize: '1.2rem' }}>📧</div>
                                                 <div>
                                                     <div style={{ fontSize: '0.7rem', color: '#0d9488', fontWeight: 800 }}>연락처</div>
                                                     <div style={{ fontSize: '0.78rem', color: '#115e59', fontWeight: 600 }}>이메일, 휴대폰</div>
                                                 </div>
                                             </div>
                                         </div>
                                         <div className="mc-arrival-steps" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                             {sr.customs.arrivalProcedure.steps.map((st, i) => (
                                                 <div key={i} style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '16px', padding: '16px', display: 'flex', gap: '14px', position: 'relative' }}>
                                                     <div style={{ background: '#0d9488', color: '#ffffff', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 800, flexShrink: 0 }}>{i + 1}</div>
                                                     <div>
                                                         <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>{safeStr(st.step)}</div>
                                                         <div style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.5, wordBreak: 'keep-all' }}>{safeStr(st.description)}</div>
                                                     </div>
                                                 </div>
                                             ))}
                                         </div>
                                     </div>
                                 )}

                                 {/* (2) 핵심 경보 */}
                                 {sr.customs?.majorAlert && sr.customs.majorAlert.title && (
                                     <div style={{ marginBottom: '24px', border: '2px solid #ef4444', background: '#fef2f2', padding: '16px', borderRadius: '16px' }}>
                                         <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                             <div style={{ background: '#dc2626', color: '#ffffff', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>!</div>
                                             <div style={{ fontSize: '1rem', fontWeight: 800, color: '#b91c1c' }}>{safeStr(sr.customs.majorAlert.title)}</div>
                                         </div>
                                         <div style={{ fontSize: '0.88rem', color: '#7f1d1d', lineHeight: 1.6, marginBottom: '8px', wordBreak: 'keep-all' }}>
                                             {safeStr(sr.customs.majorAlert.content)}
                                         </div>
                                         {sr.customs.majorAlert.penalty && (
                                             <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#dc2626', background: '#fee2e2', display: 'inline-block', padding: '4px 10px', borderRadius: '6px' }}>
                                                 적발 시 처벌: {safeStr(sr.customs.majorAlert.penalty)}
                                             </div>
                                         )}
                                     </div>
                                 )}

                                 {/* (3) 품목별 금지/주의 사항 */}
                                 {sr.customs?.prohibitedItems && sr.customs.prohibitedItems.length > 0 && (
                                     <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px', marginBottom: '24px' }}>
                                         {sr.customs.prohibitedItems.map((pi, pii) => (
                                             <div key={pii} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px' }}>
                                                 <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#1e293b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                     <div style={{ width: '6px', height: '14px', background: pii === 0 ? '#dc2626' : '#f59e0b', borderRadius: '2px' }}></div>
                                                     {safeStr(pi.category)}
                                                 </div>
                                                 <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                     {pi.items.map((it, iti) => (
                                                         <span key={iti} style={{ fontSize: '0.78rem', background: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: '20px', fontWeight: 600 }}>
                                                             {safeStr(it)}
                                                         </span>
                                                     ))}
                                                 </div>
                                                 {pi.note && (
                                                     <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '8px', paddingLeft: '8px', borderLeft: '2px solid #e2e8f0' }}>* {safeStr(pi.note)}</div>
                                                 )}
                                             </div>
                                         ))}
                                     </div>
                                 )}

                                 {/* (4) 미성년자(만 14세 미만) 자녀 동반 규정 */}
                                 {(sr.customs?.minorEntry || sr.customs?.minorDetail) && (
                                     <div style={{ marginBottom: '24px', background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '16px', padding: '18px' }}>
                                         <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                             <div style={{ fontSize: '1.2rem' }}>🛂</div>
                                             <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>만 14세 미만 자녀 입국 규정</div>
                                         </div>
                                         <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', marginBottom: '12px' }}>
                                             <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0d9488', marginBottom: '6px' }}>[기본 수속 서류]</div>
                                             <div style={{ fontSize: '0.88rem', color: '#1e293b', lineHeight: 1.5 }}>
                                                 {safeStr(sr.customs.minorEntry)}
                                             </div>
                                         </div>
                                         {sr.customs.minorDetail && (
                                             <div style={{ background: '#f1f5f9', borderRadius: '12px', padding: '14px' }}>
                                                 <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#475569', marginBottom: '6px' }}>[영문 서류 및 공증 가이드]</div>
                                                 <div style={{ fontSize: '0.86rem', color: '#334155', lineHeight: 1.6, wordBreak: 'keep-all' }}>
                                                     {safeStr(sr.customs.minorDetail)}
                                                 </div>
                                             </div>
                                         )}
                                         <div style={{ marginTop: '12px', fontSize: '0.78rem', color: '#dc2626', fontWeight: 700, paddingLeft: '4px' }}>
                                             * 부모 미동반(조부모, 친척 등) 시 영문 부모동의서 공증이 필수인 국가가 많으니 반드시 확인 바랍니다.
                                         </div>
                                     </div>
                                 )}

                                 {/* (5) 국가별 공식 사이트 퀵링크 */}
                                 {sr.customs?.links && sr.customs.links.length > 0 && (
                                     <div style={{ marginBottom: '24px' }}>
                                         <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1e293b', marginBottom: '14px', paddingLeft: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ width: '4px', height: '14px', background: '#0d9488', borderRadius: '2px' }}></div>
                                            공식 신청 및 안내 사이트
                                         </div>
                                         <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                             {sr.customs.links.map((link, li) => (
                                                 <a key={li} href={link.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff', border: '1.5px solid #e2e8f0', padding: '14px 18px', borderRadius: '16px', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                                     <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                         <div style={{ background: '#f0fdfa', width: '34px', height: '34px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                                                         </div>
                                                         <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a' }}>{safeStr(link.label)}</span>
                                                     </div>
                                                     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                                                 </a>
                                             ))}
                                         </div>
                                     </div>
                                 )}

                                 {/* 면세 / 여권 기본 정보 */}
                                 <div className="customs-dual-cards" style={{ marginBottom: '16px' }}>
                                     <div className="customs-mini-card">
                                         <div className="cm-header">면세 한도 요약</div>
                                         <p>{safeStr(sr.customs.dutyFree)}</p>
                                     </div>
                                     <div className="customs-mini-card">
                                         <div className="cm-header">여권 유의사항</div>
                                         <p>{safeStr(sr.customs.passportNote)}</p>
                                     </div>
                                 </div>

                                 <div className="customs-warning-card">
                                     <div className="cw-icon">
                                         <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                                     </div>
                                     <h3>{safeStr(sr.customs.warningTitle || '기본 유의사항')}</h3>
                                     <p>{safeStr(sr.customs.warningContent)}</p>
                                 </div>
`;
        content = content.substring(0, openingTagEnd) + newCustomsContent + content.substring(closingTagStart);
    }
}

// (2) Clean up Currency Section (Remove duplicated warning card if it leaked there)
// No, the Currency section looked okay but I'll check it.

// (3) Final check: Writing back
fs.writeFileSync(path, content, 'utf8');
console.log('Final clean-up complete for app/confirmation/[id]/page.tsx');

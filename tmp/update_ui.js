const fs = require('fs');
const path = 'c:/Users/vbxn6/.gemini/antigravity/scratch/smart-travel-pilot/app/confirmation/[id]/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// (1) Customs Section Redesign
const customsTarget = /<div className="customs-warning-card">[\s\S]*?<\/div>/;
const customsReplacement = `                                {/* (1) 국가별 필수 입국 절차 (Arrival Procedure) */}
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
                                     <div style={{ marginBottom: '20px', border: '2px solid #ef4444', background: '#fef2f2', padding: '16px', borderRadius: '16px' }}>
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
                                     <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px', marginBottom: '20px' }}>
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
                                             </div>
                                         ))}
                                     </div>
                                 )}

                                 <div className="customs-warning-card">
                                     <div className="cw-icon">
                                         <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                                     </div>
                                     <h3>{safeStr(sr.customs.warningTitle || '기본 유의사항')}</h3>
                                     <p>{safeStr(sr.customs.warningContent)}</p>
                                 </div>`;

content = content.replace(customsTarget, customsReplacement);

// (2) Roaming Section Redesign
const roamingTarget = /<div className="roaming-tip-box" style={{ background: '#eff6ff'[\s\S]*?<\/div>/;
const roamingReplacement = `                                     {/* 통신 꿀팁 섹션 */}
                                     {sr.roaming?.roamingTip && (
                                         <div className="roaming-tip-box" style={{ background: '#f0fdf4', borderRadius: '12px', padding: '16px', marginTop: '16px', border: '1px solid #dcfce7' }}>
                                             <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                 <div style={{ fontSize: '1.2rem' }}>💡</div>
                                                 <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#166534' }}>{safeStr(doc.trip.destination).split(' ').pop()} 여행 통신 꿀팁</div>
                                             </div>
                                             <p style={{ fontSize: '0.85rem', color: '#14532d', lineHeight: 1.6, margin: 0, wordBreak: 'keep-all' }}>
                                                 {safeStr(sr.roaming.roamingTip)}
                                             </p>
                                         </div>
                                     )}

                                     <div className="roaming-tip-box" style={{ background: '#eff6ff', borderRadius: '12px', padding: '16px', marginTop: '12px', fontSize: '0.85rem', color: '#1e3a8a', lineHeight: 1.6 }}>
                                         <strong style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                                             유심/eSIM 추천 및 준비
                                         </strong>
                                         {safeStr(sr.roaming?.simEsim) || '그랩(Grab) 호출이나 길찾기 시 데이터가 필요하므로 유심이나 로밍 준비를 추천합니다.'}
                                     </div>`;

content = content.replace(roamingTarget, roamingReplacement);

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully updated app/confirmation/[id]/page.tsx');

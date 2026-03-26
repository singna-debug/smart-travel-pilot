const fs = require('fs');
const path = 'c:/Users/vbxn6/.gemini/antigravity/scratch/smart-travel-pilot/app/confirmation/[id]/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// (1) Add Under 14 / Child Protection section (after Customs Prohibited items)
const customsEndMarker = /<div className="customs-warning-card">/;
const childGuidanceHtml = `                                 {/* (4) 미성년자(만 14세 미만) 자녀 동반 규정 */}
                                 {(sr.customs?.minorEntry || sr.customs?.minorDetail) && (
                                     <div style={{ marginBottom: '24px', background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '16px', padding: '18px' }}>
                                         <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                             <div style={{ fontSize: '1.2rem' }}>🛂</div>
                                             <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>만 14세 미만 자녀 입국 규정</div>
                                         </div>
                                         <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', marginBottom: '12px' }}>
                                             <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>[기본 수속 서류]</div>
                                             <div style={{ fontSize: '0.88rem', color: '#0f172a', lineHeight: 1.5 }}>
                                                 {safeStr(sr.customs.minorEntry)}
                                             </div>
                                         </div>
                                         {sr.customs.minorDetail && (
                                             <div style={{ background: '#f1f5f9', borderRadius: '12px', padding: '14px' }}>
                                                 <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>[영문 서류 및 공증 가이드]</div>
                                                 <div style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.6, wordBreak: 'keep-all' }}>
                                                     {safeStr(sr.customs.minorDetail)}
                                                 </div>
                                             </div>
                                         )}
                                         <div style={{ marginTop: '12px', fontSize: '0.78rem', color: '#dc2626', fontWeight: 600 }}>
                                             * 부모 미동반(조부모, 친척 등) 시 영문 부모동의서 공증이 필수인 국가가 많으니 반드시 확인 바랍니다.
                                         </div>
                                     </div>
                                 )}

                                 {/* (5) 국가별 공식 신청/조회 링크 (Quick Links) */}
                                 {sr.customs?.links && sr.customs.links.length > 0 && (
                                     <div style={{ marginBottom: '24px' }}>
                                         <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#1e293b', marginBottom: '12px', paddingLeft: '4px' }}>공식 신청 및 안내 링크</div>
                                         <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                             {sr.customs.links.map((link, li) => (
                                                 <a key={li} href={link.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff', border: '1.5px solid #e2e8f0', padding: '14px 18px', borderRadius: '14px', transition: 'all 0.2s' }}>
                                                     <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                         <div style={{ background: '#f1f5f9', width: '32px', height: '32px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                                                         </div>
                                                         <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>{safeStr(link.label)}</span>
                                                     </div>
                                                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                                                 </a>
                                             ))}
                                         </div>
                                     </div>
                                 )}

                                 <div className="customs-warning-card">`;

content = content.replace(customsEndMarker, childGuidanceHtml);

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully added Minor Guidance and Quick Links to app/confirmation/[id]/page.tsx');

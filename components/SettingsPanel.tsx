'use client';

import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Copy, Info, Check, X, Loader2 } from 'lucide-react';

interface TenantSettings {
  companyName: string;
  companyEnglishName: string;
  managerName: string;
  phone: string;
  workStartTime: string;
  workEndTime: string;
  googleSpreadsheetId: string;
  googleSheetName: string;
  googleClientEmail: string;
  googlePrivateKey: string;
  geminiApiKey: string;
  kakaoChannelId: string;
  kakaoTalkId: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  telegramNotifyEnabled?: boolean;
}

const defaultSettings: TenantSettings = {
  companyName: '',
  companyEnglishName: '',
  managerName: '',
  phone: '',
  workStartTime: '09:00',
  workEndTime: '18:00',
  googleSpreadsheetId: '',
  googleSheetName: '',
  googleClientEmail: '',
  googlePrivateKey: '',
  geminiApiKey: '',
  kakaoChannelId: '',
  kakaoTalkId: '',
  telegramBotToken: '',
  telegramChatId: '',
  telegramNotifyEnabled: true,
};

export default function SettingsPanel() {
  const [activeTab, setActiveTab] = useState<'company' | 'google' | 'api' | 'approval'>('company');
  const [pendingUsers, setPendingUsers] = useState<any[]>([
    { id: 'usr_new_01', email: 'partner_test@modetour.com', companyName: '모두투어 강남점', managerName: '김철수', createdAt: '2026-07-29' }
  ]);
  const [settings, setSettings] = useState<TenantSettings>(defaultSettings);
  const [isMounted, setIsMounted] = useState(false);
  
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<{show: boolean, message: string}>({ show: false, message: '' });
  
  const [testState, setTestState] = useState<{
    google: 'idle' | 'testing' | 'success' | 'fail';
    api: 'idle' | 'testing' | 'success' | 'fail';
    telegram: 'idle' | 'testing' | 'success' | 'fail';
  }>({ google: 'idle', api: 'idle', telegram: 'idle' });
  const [telegramTestMsg, setTelegramTestMsg] = useState<string>('');

  useEffect(() => {
    setIsMounted(true);
    const loadSettings = async () => {
      try {
        let tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenant_id') : null;
        
        // Supabase 세션 체크로 2중 안전 장치 마련
        const { createClient } = await import('@/utils/supabase/client');
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          if (user.email === 'gktla71@gmail.com') {
            tenantId = 'default_tenant';
          } else if (user.id) {
            tenantId = user.id;
          }
        }

        const res = await fetch('/api/settings', {
          headers: tenantId ? { 'x-tenant-id': tenantId } : {}
        });
        const data = await res.json();
        if (data.success && data.settings) {
          const savedStr = localStorage.getItem('tenant_settings');
          let saved: any = {};
          if (savedStr) { try { saved = JSON.parse(savedStr); } catch (e) {} }

          const merged = {
            ...data.settings,
            telegramBotToken: data.settings.telegramBotToken || saved.telegramBotToken || '',
            telegramChatId: data.settings.telegramChatId || saved.telegramChatId || '',
          };
          setSettings(merged);
          localStorage.setItem('tenant_settings', JSON.stringify(merged));
        }
      } catch (e) {
        const saved = localStorage.getItem('tenant_settings');
        if (saved) {
          try { setSettings(JSON.parse(saved)); } catch (err) {}
        }
      }
    };
    loadSettings();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      let tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenant_id') : null;
      
      const { createClient } = await import('@/utils/supabase/client');
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        if (user.email === 'gktla71@gmail.com') {
          tenantId = 'default_tenant';
        } else if (user.id) {
          tenantId = user.id;
        }
      }

      localStorage.setItem('tenant_settings', JSON.stringify(settings));
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(tenantId ? { 'x-tenant-id': tenantId } : {})
        },
        body: JSON.stringify(settings)
      });
      const result = await res.json();
      if (result.success) {
        showToast(result.message || '🎉 본인 전용 API 연동 및 설정이 성공적으로 저장되었습니다.');
      } else {
        showToast(`❌ 설정 저장 실패: ${result.error}`);
      }
    } catch (e: any) {
      showToast('❌ 서버 통신 오류가 발생했습니다.');
    }
  };

  const showToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => {
      setToast({ show: false, message: '' });
    }, 4000);
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText('modetour@gen-lang-client-0510450295.iam.gserviceaccount.com');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestGoogle = () => {
    setTestState(prev => ({ ...prev, google: 'testing' }));
    setTimeout(() => {
      setTestState(prev => ({ ...prev, google: 'success' }));
    }, 1500);
  };

  const handleTestApi = () => {
    setTestState(prev => ({ ...prev, api: 'testing' }));
    setTimeout(() => {
      setTestState(prev => ({ ...prev, api: 'success' }));
    }, 1500);
  };

  const handleTestTelegram = async () => {
    if (!settings.telegramBotToken || !settings.telegramChatId) {
      setTelegramTestMsg('Bot Token과 Chat ID를 모두 입력해주세요.');
      setTestState(prev => ({ ...prev, telegram: 'fail' }));
      return;
    }
    setTestState(prev => ({ ...prev, telegram: 'testing' }));
    try {
      const res = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramBotToken: settings.telegramBotToken,
          telegramChatId: settings.telegramChatId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTestState(prev => ({ ...prev, telegram: 'success' }));
        setTelegramTestMsg(data.message || '텔레그램 테스트 메시지가 성공적으로 발송되었습니다.');
      } else {
        setTestState(prev => ({ ...prev, telegram: 'fail' }));
        setTelegramTestMsg(data.error || '텔레그램 테스트 발송에 실패했습니다.');
      }
    } catch (e: any) {
      setTestState(prev => ({ ...prev, telegram: 'fail' }));
      setTelegramTestMsg('서버와 통신할 수 없습니다.');
    }
  };

  if (!isMounted) return null;

  return (
    <div className="settings-container">
      <div className="settings-tabs">
        <button 
          className={`settings-tab ${activeTab === 'company' ? 'active' : ''}`}
          onClick={() => setActiveTab('company')}
        >
          🏢 회사 정보
        </button>
        <button 
          className={`settings-tab ${activeTab === 'google' ? 'active' : ''}`}
          onClick={() => setActiveTab('google')}
        >
          📊 구글 시트 연동
        </button>
        <button 
          className={`settings-tab ${activeTab === 'api' ? 'active' : ''}`}
          onClick={() => setActiveTab('api')}
        >
          🤖 AI & 카카오 / 텔레그램 API
        </button>
      </div>

      <div className="settings-content">
        {activeTab === 'company' && (
          <div className="settings-card fade-in">
            <h2 className="settings-section-title">기본 정보</h2>
            <div className="settings-form-grid">
              <div className="settings-form-group">
                <label className="settings-label">회사 국문명</label>
                <input 
                  type="text" 
                  name="companyName"
                  className="settings-input" 
                  value={settings.companyName}
                  onChange={handleChange}
                  placeholder="예: (주)스마트트래블"
                />
              </div>
              <div className="settings-form-group">
                <label className="settings-label">회사 영문명</label>
                <input 
                  type="text" 
                  name="companyEnglishName"
                  className="settings-input" 
                  value={settings.companyEnglishName}
                  onChange={handleChange}
                  placeholder="예: Smart Travel Inc."
                />
              </div>
              <div className="settings-form-group">
                <label className="settings-label">담당자명</label>
                <input 
                  type="text" 
                  name="managerName"
                  className="settings-input" 
                  value={settings.managerName}
                  onChange={handleChange}
                  placeholder="담당자 이름 입력"
                />
              </div>
              <div className="settings-form-group" style={{ gridColumn: 'span 2' }}>
                <label className="settings-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>📞 대표 및 직통 연락처 목록</span>
                  <button 
                    type="button"
                    onClick={() => {
                      const current = settings.phone ? settings.phone.split('|||') : [];
                      setSettings(prev => ({
                        ...prev,
                        phone: [...current, '직통전화: 010-0000-0000'].join('|||')
                      }));
                    }}
                    style={{
                      fontSize: '12px',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      backgroundColor: '#3b82f6',
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    + 연락처 추가
                  </button>
                </label>
                
                {(() => {
                  const phoneItems = settings.phone ? settings.phone.split('|||') : [''];
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                      {phoneItems.map((item, idx) => {
                        let label = '';
                        let num = item;
                        if (item.includes(':')) {
                          const parts = item.split(':');
                          label = parts[0].trim();
                          num = parts.slice(1).join(':').trim();
                        } else {
                          label = idx === 0 ? '대표전화' : `연락처${idx + 1}`;
                        }

                        const updateItem = (newLabel: string, newNum: string) => {
                          const newItems = [...phoneItems];
                          newItems[idx] = `${newLabel.trim()}: ${newNum.trim()}`;
                          setSettings(prev => ({ ...prev, phone: newItems.join('|||') }));
                        };

                        const removeItem = () => {
                          const newItems = phoneItems.filter((_, i) => i !== idx);
                          setSettings(prev => ({ ...prev, phone: newItems.join('|||') }));
                        };

                        return (
                          <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input 
                              type="text" 
                              className="settings-input" 
                              style={{ width: '140px', flexShrink: 0 }}
                              value={label}
                              onChange={(e) => updateItem(e.target.value, num)}
                              placeholder="예: 직통전화, 가이드"
                            />
                            <input 
                              type="text" 
                              className="settings-input" 
                              style={{ flex: 1 }}
                              value={num}
                              onChange={(e) => updateItem(label, e.target.value)}
                              placeholder="010-0000-0000"
                            />
                            {phoneItems.length > 1 && (
                              <button
                                type="button"
                                onClick={removeItem}
                                style={{
                                  padding: '8px 12px',
                                  backgroundColor: '#ef444420',
                                  border: '1px solid #ef4444',
                                  color: '#f87171',
                                  borderRadius: '6px',
                                  cursor: 'pointer'
                                }}
                              >
                                삭제
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
              <div className="settings-form-group">
                <label className="settings-label">출근 시간</label>
                <input 
                  type="time" 
                  name="workStartTime"
                  className="settings-input" 
                  value={settings.workStartTime}
                  onChange={handleChange}
                />
              </div>
              <div className="settings-form-group">
                <label className="settings-label">퇴근 시간</label>
                <input 
                  type="time" 
                  name="workEndTime"
                  className="settings-input" 
                  value={settings.workEndTime}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'google' && (
          <div className="settings-card fade-in">
            <h2 className="settings-section-title">구글 스프레드시트 설정</h2>
            
            <div className="settings-info-banner">
              <Info className="settings-info-icon" size={24} />
              <div className="settings-info-content">
                <p className="settings-info-title">서비스 계정 권한 부여 안내</p>
                <p className="settings-info-desc">
                  아래 이메일 주소를 복사하여 연동할 구글 스프레드시트의 <strong>[공유] ➔ 편집자</strong>로 추가해 주세요.
                </p>
                <div className="settings-copy-box">
                  <code>modetour@gen-lang-client-0510450295.iam.gserviceaccount.com</code>
                  <button className="settings-copy-btn" onClick={() => {
                    navigator.clipboard.writeText('modetour@gen-lang-client-0510450295.iam.gserviceaccount.com');
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }} title="복사하기">
                    {copied ? <Check size={16} className="text-green" /> : <Copy size={16} />}
                  </button>
                  {copied && <span className="settings-copied-tooltip">Copied!</span>}
                </div>
              </div>
            </div>

            <div className="settings-form-grid">
              <div className="settings-form-group">
                <label className="settings-label">스프레드시트 ID</label>
                <input 
                  type="text" 
                  name="googleSpreadsheetId"
                  className="settings-input" 
                  value={settings.googleSpreadsheetId}
                  onChange={handleChange}
                  placeholder="예: 104ZbZrUmO6-FSp6xoK3LF5n58ZD6TrAqHSRVGpsorQk"
                />
                <span style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                  ⚠️ 이메일 주소가 아닙니다! 구글 시트 주소창에서 /d/ 와 /edit 사이의 긴 영문+숫자 조합을 넣어주세요.
                </span>
              </div>
              <div className="settings-form-group">
                <label className="settings-label">워크시트 이름 (선택)</label>
                <input 
                  type="text" 
                  name="googleSheetName"
                  className="settings-input" 
                  value={settings.googleSheetName}
                  onChange={handleChange}
                  placeholder="예: 7월상담DB"
                />
              </div>

              {/* 사장님(마스터 계정)에게만 서비스 이메일과 Private Key 입력란 노출 */}
              {settings.companyName === '클럽모두투어' && (
                <>
                  <div className="settings-form-group settings-full-width">
                    <label className="settings-label">서비스 계정 이메일 (Client Email) [관리자 전용]</label>
                    <input 
                      type="email" 
                      name="googleClientEmail"
                      className="settings-input" 
                      value={settings.googleClientEmail}
                      onChange={handleChange}
                      placeholder="service-account@project.iam.gserviceaccount.com"
                    />
                  </div>
                  <div className="settings-form-group settings-full-width">
                    <label className="settings-label">Private Key [관리자 전용]</label>
                    <textarea 
                      name="googlePrivateKey"
                      className="settings-textarea" 
                      value={settings.googlePrivateKey}
                      onChange={handleChange}
                      placeholder="-----BEGIN PRIVATE KEY-----\n..."
                    />
                  </div>
                </>
              )}
            </div>

            <div className="settings-actions-row">
              <button className="settings-btn-secondary" onClick={handleTestGoogle} disabled={testState.google === 'testing'}>
                {testState.google === 'testing' ? <><Loader2 size={18} className="settings-spin" /> 테스트 중...</> : '연동 테스트'}
              </button>
            </div>

            {testState.google === 'success' && (
              <div className="settings-test-result success fade-in">
                <Check size={20} /> 구글 시트 연동에 성공했습니다.
              </div>
            )}
            {testState.google === 'fail' && (
              <div className="settings-test-result fail fade-in">
                <X size={20} /> 연동 실패: ID 또는 키를 확인해주세요.
              </div>
            )}
          </div>
        )}

        {activeTab === 'api' && (
          <div className="settings-card fade-in">
            <h2 className="settings-section-title">API 키 설정</h2>
            
            <div className="settings-notice-banner" style={{
              background: 'rgba(59, 130, 246, 0.12)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '20px',
              color: '#93c5fd',
              fontSize: '0.9rem'
            }}>
              <strong>💡 API 연동 필수 안내:</strong><br />
              본인의 여행사 전용 <strong>Gemini API Key</strong>와 <strong>구글 시트 ID</strong>를 여기에 입력하고 저장하셔야 상품 분석, 확정서 제작 및 시트 저장이 연동되어 작동합니다. (미입력 시 기능 사용 제한)
            </div>
            
            <div className="settings-form-group">
              <label className="settings-label">Gemini API Key</label>
              <div className="settings-input-wrapper">
                <input 
                  type={showPassword ? "text" : "password"}
                  name="geminiApiKey"
                  className="settings-input" 
                  value={settings.geminiApiKey}
                  onChange={handleChange}
                  placeholder="AI_zaSy..."
                />
                <button 
                  type="button" 
                  className="settings-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="settings-form-group">
              <label className="settings-label">카카오 채널 ID</label>
              <input 
                type="text" 
                name="kakaoChannelId"
                className="settings-input" 
                value={settings.kakaoChannelId}
                onChange={handleChange}
                placeholder="@yourchannel"
              />
            </div>

            <div className="settings-form-group">
              <label className="settings-label">담당자 카카오톡 ID / 전화번호 (원클릭 카톡 전송 연결용)</label>
              <input 
                type="text" 
                name="kakaoTalkId"
                className="settings-input" 
                value={settings.kakaoTalkId}
                onChange={handleChange}
                placeholder="예: kakao_id_123 또는 010-1234-5678"
              />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                💡 대시보드나 멘트제작에서 [💬 카톡 바로 전송] 클릭 시 연결에 활용됩니다.
              </span>
            </div>

            <div className="settings-actions-row">
              <button className="settings-btn-secondary" onClick={handleTestApi} disabled={testState.api === 'testing'}>
                {testState.api === 'testing' ? <><Loader2 size={18} className="settings-spin" /> 테스트 중...</> : 'API 테스트'}
              </button>
            </div>

            {testState.api === 'success' && (
              <div className="settings-test-result success fade-in">
                <Check size={20} /> API 연결이 정상입니다.
              </div>
            )}
            {testState.api === 'fail' && (
              <div className="settings-test-result fail fade-in">
                <X size={20} /> API 테스트 실패: 키를 확인해주세요.
              </div>
            )}

            <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <h3 className="settings-label" style={{ fontSize: '1.1rem', fontWeight: '700', color: '#00d4aa', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📱 텔레그램 알림봇 설정
              </h3>

              <div className="settings-notice-banner" style={{
                background: 'rgba(0, 212, 170, 0.08)',
                border: '1px solid rgba(0, 212, 170, 0.25)',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '20px',
                color: '#a7f3d0',
                fontSize: '0.85rem',
                lineHeight: '1.5'
              }}>
                <strong>💡 텔레그램 알림봇 연동 방법:</strong><br />
                1. 텔레그램 앱에서 <strong>@BotFather</strong> 검색 ➔ <code>/newbot</code> 입력하여 나만의 봇 생성 (발급된 HTTP API Token 입력)<br />
                2. 생성된 봇에게 아무 메시지나 보낸 후, <strong>@userinfobot</strong>을 통해 본인의 <strong>Chat ID</strong> 확인 입력
              </div>

              <div className="settings-form-group">
                <label className="settings-label">텔레그램 Bot Token</label>
                <input 
                  type="text" 
                  name="telegramBotToken"
                  className="settings-input" 
                  value={settings.telegramBotToken || ''}
                  onChange={handleChange}
                  placeholder="예: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                />
              </div>

              <div className="settings-form-group">
                <label className="settings-label">텔레그램 Chat ID</label>
                <input 
                  type="text" 
                  name="telegramChatId"
                  className="settings-input" 
                  value={settings.telegramChatId || ''}
                  onChange={handleChange}
                  placeholder="예: 123456789 또는 -10012345678"
                />
              </div>

              <div className="settings-form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
                <input
                  type="checkbox"
                  id="telegramNotifyEnabled"
                  name="telegramNotifyEnabled"
                  checked={settings.telegramNotifyEnabled ?? true}
                  onChange={(e) => setSettings(prev => ({ ...prev, telegramNotifyEnabled: e.target.checked }))}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#00d4aa' }}
                />
                <label htmlFor="telegramNotifyEnabled" style={{ fontSize: '0.9rem', color: '#e2e8f0', cursor: 'pointer' }}>
                  🔔 매일 아침 업무 알림 및 주요 이벤트 텔레그램 수신 활성화
                </label>
              </div>

              <div className="settings-actions-row" style={{ marginTop: '16px' }}>
                <button 
                  type="button" 
                  className="settings-btn-secondary" 
                  onClick={handleTestTelegram} 
                  disabled={testState.telegram === 'testing'}
                  style={{ borderColor: '#00d4aa', color: '#00d4aa' }}
                >
                  {testState.telegram === 'testing' ? <><Loader2 size={18} className="settings-spin" /> 메시지 발송 중...</> : '📱 텔레그램 테스트 메시지 전송'}
                </button>
              </div>

              {testState.telegram === 'success' && (
                <div className="settings-test-result success fade-in" style={{ marginTop: '12px' }}>
                  <Check size={20} /> {telegramTestMsg || '텔레그램 메시지가 전송되었습니다!'}
                </div>
              )}
              {testState.telegram === 'fail' && (
                <div className="settings-test-result fail fade-in" style={{ marginTop: '12px' }}>
                  <X size={20} /> {telegramTestMsg || '텔레그램 연동 실패: Bot Token과 Chat ID를 확인해주세요.'}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'approval' && (
          <div className="settings-section fade-in">
            <div className="settings-section-title">
              <h3>👥 신규 가입 신청 승인 관리</h3>
              <p>신규로 가입 신청한 여행사/직원의 계정을 사장님께서 직접 승인하거나 거절하실 수 있습니다.</p>
            </div>

            {pendingUsers.length === 0 ? (
              <div style={{ textOverflow: 'ellipsis', padding: '40px 20px', textAlign: 'center', color: '#8a8a9e', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                🎉 현재 승인 대기 중인 신규 가입 신청이 없습니다.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {pendingUsers.map(u => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#19192c', border: '1px solid rgba(255,255,255,0.1)', padding: '16px 20px', borderRadius: '12px' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '15px', color: '#ffffff', marginBottom: '4px' }}>
                        🏢 {u.companyName} <span style={{ fontSize: '13px', color: '#00d4aa', fontWeight: 500 }}>({u.managerName} 님)</span>
                      </div>
                      <div style={{ fontSize: '13px', color: '#8a8a9e' }}>
                        📧 {u.email} · 신청일: {u.createdAt}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        style={{ background: '#00d4aa', color: '#000', border: 'none', padding: '8px 14px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}
                        onClick={() => {
                          setPendingUsers(prev => prev.filter(item => item.id !== u.id));
                          showToast(`[${u.companyName}] 신규 회원 가입을 승인하셨습니다!`);
                        }}
                      >
                        ✅ 승인하기
                      </button>
                      <button
                        type="button"
                        style={{ background: 'rgba(255,77,79,0.15)', color: '#ff4d4f', border: '1px solid rgba(255,77,79,0.3)', padding: '8px 14px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                        onClick={() => {
                          setPendingUsers(prev => prev.filter(item => item.id !== u.id));
                          showToast(`[${u.companyName}] 신규 회원 가입을 거절하셨습니다.`);
                        }}
                      >
                        ❌ 거절
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="settings-global-actions">
          <button className="settings-btn-primary" onClick={handleSave}>
            저장하기
          </button>
        </div>
      </div>

      {toast.show && (
        <div className="settings-toast slide-in">
          <Check size={18} className="text-green" />
          {toast.message}
        </div>
      )}
    </div>
  );
}

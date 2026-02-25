'use client';

import { useState, useEffect } from 'react';

// 타입 정의
interface Contact {
    id: string;
    name: string;
    phone: string;
    photoUrl?: string;
}

interface GoogleContactsPickerProps {
    onSelectContact: (name: string, phone: string) => void;
}

export default function GoogleContactsPicker({ onSelectContact }: GoogleContactsPickerProps) {
    const [isScriptLoaded, setIsScriptLoaded] = useState(false);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    // Google Identity Service 스크립트 로드
    useEffect(() => {
        if (!CLIENT_ID) {
            console.warn('NEXT_PUBLIC_GOOGLE_CLIENT_ID 환경변수가 설정되지 않았습니다.');
            return;
        }

        const loadScript = () => {
            if (window.google?.accounts?.oauth2) {
                setIsScriptLoaded(true);
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.onload = () => setIsScriptLoaded(true);
            document.body.appendChild(script);
        };
        loadScript();
    }, [CLIENT_ID]);

    // 검색어 필터링
    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredContacts(contacts);
        } else {
            const lowerQuery = searchQuery.toLowerCase();
            const filtered = contacts.filter(c =>
                c.name.toLowerCase().includes(lowerQuery) ||
                c.phone.includes(lowerQuery)
            );
            setFilteredContacts(filtered);
        }
    }, [searchQuery, contacts]);

    const handleFetchContacts = () => {
        if (!CLIENT_ID) {
            alert('구글 로그인 클라이언트 ID가 설정되지 않았습니다. 관리자에게 문의하세요.');
            return;
        }

        if (!window.google?.accounts?.oauth2) {
            alert('구글 로그인 스크립트를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
            return;
        }

        setErrorMsg('');
        setIsLoading(true);

        const tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/contacts.readonly',
            callback: async (response: any) => {
                if (response.error) {
                    setErrorMsg('인증에 실패했습니다: ' + response.error);
                    setIsLoading(false);
                    return;
                }

                try {
                    await fetchContactsData(response.access_token);
                } catch (err: any) {
                    setErrorMsg('연락처를 불러오는 중 오류가 발생했습니다: ' + err.message);
                    setIsLoading(false);
                }
            },
        });

        // 팝업 띄우기 (만약 이미 동의했다면 바로 callback 호출됨)
        tokenClient.requestAccessToken({ prompt: 'consent' });
    };

    const fetchContactsData = async (accessToken: string) => {
        let allConnections: any[] = [];
        let nextPageToken = '';
        let hasMore = true;

        try {
            while (hasMore) {
                const url = `https://people.googleapis.com/v1/people/me/connections?personFields=names,phoneNumbers,photos&pageSize=1000${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;

                const res = await fetch(url, {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        Accept: 'application/json',
                    }
                });

                if (!res.ok) {
                    throw new Error(`Google API Error (${res.status})`);
                }

                const data = await res.json();

                if (data.connections) {
                    allConnections = [...allConnections, ...data.connections];
                }

                nextPageToken = data.nextPageToken || '';
                hasMore = !!nextPageToken;

                // 너무 많은 요청을 방지하기 위해 최대 20페이지(20,000명) 정도로 제한 (안전장치)
                if (allConnections.length > 20000) {
                    hasMore = false;
                }
            }

            if (allConnections.length === 0) {
                setErrorMsg('저장된 연락처가 없습니다.');
                setIsLoading(false);
                setContacts([]);
                return;
            }

            const parsedContacts: Contact[] = [];

            allConnections.forEach((person: any) => {
                const name = person.names?.[0]?.displayName;
                const phone = person.phoneNumbers?.[0]?.value || person.phoneNumbers?.[0]?.canonicalForm;
                const photoUrl = person.photos?.[0]?.url;

                // 이름과 전화번호가 모두 있는 사람만 필터링
                if (name && phone) {
                    parsedContacts.push({
                        id: person.resourceName,
                        name,
                        phone: formatKoreanPhone(phone),
                        photoUrl
                    });
                }
            });

            // 가나다 순 정렬
            parsedContacts.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

            setContacts(parsedContacts);
            setIsModalOpen(true);
            setIsLoading(false);

        } catch (err: any) {
            setErrorMsg('연락처를 불러오는 중 오류가 발생했습니다: ' + err.message);
            setIsLoading(false);
        }
    };

    const formatKoreanPhone = (phone: string) => {
        // "+82 " 등 공백이나 국가코드 제거, 대시 추가 등의 간단한 처리
        let clean = phone.replace(/[^0-9]/g, '');
        if (clean.startsWith('82') && clean.length > 10) {
            clean = '0' + clean.substring(2);
        }
        return clean;
    };

    const handleSelect = (contact: Contact) => {
        onSelectContact(contact.name, contact.phone);
        setIsModalOpen(false);
        setSearchQuery('');
    };

    return (
        <>
            <button
                type="button"
                onClick={handleFetchContacts}
                disabled={isLoading || !isScriptLoaded}
                style={{
                    padding: '8px 12px',
                    backgroundColor: '#e2e8f0',
                    color: '#1e293b',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: (isLoading || !isScriptLoaded) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    height: '100%'
                }}
            >
                {isLoading ? (
                    <span className="spinner-small" style={{ width: '12px', height: '12px', borderTopColor: '#1e293b' }}></span>
                ) : '👤'}
                {isLoading ? '불러오는 중...' : '구글 연락처 불러오기'}
            </button>

            {/* 모달 */}
            {isModalOpen && (
                <div style={{
                    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }} onClick={() => setIsModalOpen(false)}>

                    <div style={{
                        backgroundColor: 'var(--bg-card)',
                        padding: '24px',
                        borderRadius: '16px',
                        width: '90%',
                        maxWidth: '400px',
                        maxHeight: '80vh',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: 'var(--shadow-xl)'
                    }} onClick={e => e.stopPropagation()}>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>구글 연락처 선택</h3>
                            <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
                        </div>

                        <input
                            type="text"
                            placeholder="이름 또는 전화번호로 검색"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                padding: '12px',
                                borderRadius: '8px',
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'var(--bg-tertiary)',
                                color: 'var(--text-primary)',
                                marginBottom: '16px',
                                outline: 'none'
                            }}
                        />

                        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                            {filteredContacts.length === 0 ? (
                                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px 0' }}>검색 결과가 없습니다.</p>
                            ) : (
                                filteredContacts.map(c => (
                                    <div
                                        key={c.id}
                                        onClick={() => handleSelect(c)}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '12px 16px',
                                            backgroundColor: 'var(--bg-tertiary)',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            border: '1px solid transparent',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
                                        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
                                    >
                                        <span style={{ fontWeight: 600 }}>{c.name}</span>
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{c.phone}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

// 타입 선언 추가 (타입스크립트 에러 방지)
declare global {
    interface Window {
        google: any;
    }
}

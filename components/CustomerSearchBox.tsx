'use client';

import { useState, useRef, useEffect } from 'react';
import useSWR from 'swr';
import { Search, User, Phone, X, Loader2 } from 'lucide-react';
import { ConsultationData } from '@/types';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface CustomerSearchBoxProps {
    onSelect: (customer: ConsultationData) => void;
    placeholder?: string;
    label?: string;
}

export default function CustomerSearchBox({ 
    onSelect, 
    placeholder = "이름 또는 연락처로 고객 검색...",
    label = "기존 고객 정보 불러오기"
}: CustomerSearchBoxProps) {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // SWR uses the query as a key for automatic caching and revalidation
    // If query is empty, it fetches the recent 20 customers
    const { data, error, isLoading } = useSWR(
        `/api/customers/search?q=${encodeURIComponent(query)}`,
        fetcher,
        {
            revalidateOnFocus: false,
            dedupingInterval: 60000, // 1 minute cache
        }
    );

    const results = data?.success ? data.data : [];

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (customer: ConsultationData) => {
        onSelect(customer);
        setQuery('');
        setIsOpen(false);
    };

    return (
        <div className="customer-search-container" ref={dropdownRef}>
            {label && <label className="search-label">{label}</label>}
            <div className="search-input-wrapper">
                <input
                    type="text"
                    className="search-input"
                    style={{ paddingLeft: '8px' }}
                    placeholder={placeholder}
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                />
                {query && (
                    <button className="clear-button" onClick={() => setQuery('')}>
                        <X size={16} />
                    </button>
                )}
                {isLoading && (
                    <div className="loading-indicator">
                        <Loader2 size={16} className="animate-spin" />
                    </div>
                )}
            </div>

            {isOpen && (
                <div className="search-dropdown shadow-lg">
                    {!query && <div className="dropdown-divider-text">최근 상담 고객</div>}
                    {isLoading ? (
                        <div className="dropdown-status">불러오는 중...</div>
                    ) : results.length > 0 ? (
                        results.map((c: ConsultationData, i: number) => (
                            <button 
                                key={i} 
                                className="dropdown-item"
                                onClick={() => handleSelect(c)}
                            >
                                <div className="item-info">
                                    <div className="item-primary">
                                        <User size={14} className="inline-icon" />
                                        <span className="name">{c.customer.name}</span>
                                        <span className="dest">{c.trip.destination}</span>
                                    </div>
                                    <div className="item-secondary">
                                        <Phone size={12} className="inline-icon" />
                                        <span>{c.customer.phone}</span>
                                        <span className="date">({c.trip.departure_date || '날짜미정'})</span>
                                    </div>
                                </div>
                            </button>
                        ))
                    ) : (
                        <div className="dropdown-status">검색 결과가 없습니다.</div>
                    )}
                </div>
            )}

            <style jsx>{`
                .customer-search-container {
                    position: relative;
                    width: 100%;
                    margin-bottom: 20px;
                }
                .search-label {
                    display: block;
                    font-size: 13px;
                    font-weight: 600;
                    color: var(--text-secondary);
                    margin-bottom: 8px;
                }
                .search-input-wrapper {
                    position: relative;
                    display: flex;
                    align-items: center;
                    background: var(--bg-tertiary);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    padding: 0 12px;
                    transition: all 0.2s ease;
                }
                .search-input-wrapper:focus-within {
                    border-color: var(--accent-primary);
                    box-shadow: 0 0 10px rgba(0, 212, 170, 0.2);
                    background: rgba(255, 255, 255, 0.03);
                }
                .search-icon {
                    color: var(--text-muted);
                    margin-right: 10px;
                }
                .search-input {
                    flex: 1;
                    background: transparent;
                    border: none;
                    color: var(--text-primary);
                    padding: 12px 0;
                    font-size: 14px;
                    outline: none;
                }
                .clear-button {
                    background: transparent;
                    border: none;
                    color: var(--text-muted);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 4px;
                    border-radius: 50%;
                }
                .clear-button:hover {
                    background: rgba(255, 255, 255, 0.1);
                    color: var(--text-primary);
                }
                .loading-indicator {
                    margin-left: 8px;
                    color: var(--accent-primary);
                }
                .search-dropdown {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    margin-top: 8px;
                    background: var(--bg-card);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    max-height: 300px;
                    overflow-y: auto;
                    z-index: 1000;
                    background: #1a1a2e;
                    backdrop-filter: blur(10px);
                }
                .dropdown-divider-text {
                    padding: 8px 16px;
                    font-size: 11px;
                    font-weight: 700;
                    color: var(--accent-primary);
                    background: rgba(0, 212, 170, 0.05);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .dropdown-status {
                    padding: 16px;
                    text-align: center;
                    color: var(--text-muted);
                    font-size: 14px;
                }
                .dropdown-item {
                    width: 100%;
                    display: flex;
                    flex-direction: column;
                    padding: 12px 16px;
                    background: transparent;
                    border: none;
                    border-bottom: 1px solid var(--border-color);
                    text-align: left;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .dropdown-item:last-child {
                    border-bottom: none;
                }
                .dropdown-item:hover {
                    background: rgba(255, 255, 255, 0.05);
                }
                .item-info {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .item-primary {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 15px;
                    font-weight: 600;
                    color: var(--text-primary);
                }
                .item-secondary {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 12px;
                    color: var(--text-secondary);
                }
                .name {
                    color: var(--accent-primary);
                }
                .dest {
                    font-size: 12px;
                    color: var(--text-muted);
                    font-weight: normal;
                }
                .inline-icon {
                    opacity: 0.6;
                }
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}

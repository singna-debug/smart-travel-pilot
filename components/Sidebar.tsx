'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
    href: string;
    label: string;
    icon: string;
}

const navItems: NavItem[] = [
    { href: '/', label: '대시보드', icon: '📊' },
    { href: '/chat', label: 'AI 채팅', icon: '🤖' },
    { href: '/chats', label: '상담 목록', icon: '💬' },
    { href: '/products', label: '상품 교육', icon: '🎓' },
    { href: '/manual-log', label: '수동 상담', icon: '📝' },
    { href: '/tools', label: 'URL 분석', icon: '🔧' },
    { href: '/messages', label: '멘트제작', icon: '✉️' },
    { href: '/logs', label: '활동 로그', icon: '📋' },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="sidebar-logo">✈️</div>
                <div className="sidebar-title">
                    <h1>Smart Travel</h1>
                    <span>Pilot</span>
                </div>
            </div>

            <nav className="sidebar-nav">
                {navItems.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`nav-item ${pathname === item.href ? 'active' : ''}`}
                    >
                        <span className="nav-icon">{item.icon}</span>
                        <span className="nav-label">{item.label}</span>
                    </Link>
                ))}
            </nav>

            <div className="sidebar-footer">
                <a
                    href="https://center-pf.kakao.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="nav-item external"
                >
                    <span className="nav-icon">💬</span>
                    <span className="nav-label">카카오 채널</span>
                    <span className="external-icon">↗</span>
                </a>
                <a
                    href={`https://docs.google.com/spreadsheets/d/${process.env.NEXT_PUBLIC_SHEET_ID || ''}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="nav-item external"
                >
                    <span className="nav-icon">📊</span>
                    <span className="nav-label">Google Sheets</span>
                    <span className="external-icon">↗</span>
                </a>
            </div>
        </aside>
    );
}

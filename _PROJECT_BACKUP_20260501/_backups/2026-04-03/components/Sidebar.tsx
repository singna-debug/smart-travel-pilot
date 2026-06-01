'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart2, MessageSquareText, FileText, GraduationCap, PenLine, Wrench, Mail, MessageCircle, TableProperties, Plane } from 'lucide-react';

interface NavItem {
    href: string;
    label: string;
    icon: React.ReactNode;
}

const navItems: NavItem[] = [
    { href: '/', label: '대시보드', icon: <BarChart2 size={20} /> },
    { href: '/chats', label: '상담 목록', icon: <MessageSquareText size={20} /> },
    { href: '/confirmation', label: '확정서 제작', icon: <FileText size={20} /> },
    { href: '/products', label: '상품 교육', icon: <GraduationCap size={20} /> },
    { href: '/manual-log', label: '수동 상담', icon: <PenLine size={20} /> },
    { href: '/tools', label: 'URL 분석', icon: <Wrench size={20} /> },
    { href: '/messages', label: '멘트제작', icon: <Mail size={20} /> },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="sidebar">
            <Link href="/" style={{ textDecoration: 'none' }}>
                <div className="sidebar-header">
                    <div className="sidebar-logo">
                        <Plane size={28} strokeWidth={2.5} style={{ transform: 'rotate(-45deg)', color: '#fff' }} />
                    </div>
                    <div className="sidebar-title">
                        <h1>Smart Travel</h1>
                        <span>Pilot</span>
                    </div>
                </div>
            </Link>

            <nav className="sidebar-nav">
                {navItems.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`nav-item ${pathname === item.href ? 'active' : ''}`}
                    >
                        <span className="nav-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {item.icon}
                        </span>
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
                    <span className="nav-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <MessageCircle size={20} />
                    </span>
                    <span className="nav-label">카카오 채널</span>
                    <span className="external-icon">↗</span>
                </a>
                <a
                    href={`https://docs.google.com/spreadsheets/d/${process.env.NEXT_PUBLIC_SHEET_ID || ''}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="nav-item external"
                >
                    <span className="nav-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <TableProperties size={20} />
                    </span>
                    <span className="nav-label">Google Sheets</span>
                    <span className="external-icon">↗</span>
                </a>
            </div>
        </aside>
    );
}

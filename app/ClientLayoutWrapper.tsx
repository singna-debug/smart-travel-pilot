"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import React from "react";

export default function ClientLayoutWrapper({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    // If the path is exactly /confirmation (admin page), we show the sidebar.
    // If the path is /confirmation/[id] (client viewer), we hide the sidebar.
    const isClientViewer = pathname?.startsWith("/confirmation/") && pathname !== "/confirmation";

    if (isClientViewer) {
        return <main className="viewer-content">{children}</main>;
    }

    return (
        <div className="app-layout">
            <Sidebar />
            <main className="main-content">{children}</main>
        </div>
    );
}

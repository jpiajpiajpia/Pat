"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/app";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { PreviewDrawer } from "@/components/preview/PreviewDrawer";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { setUser } = useAppStore();

  useEffect(() => {
    fetch("/api/user")
      .then((r) => r.json())
      .then((u) => { if (u?.id) setUser(u); });
  }, [setUser]);

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: "var(--pat-bg)", color: "var(--pat-text)" }}>
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
        <PreviewDrawer />
      </div>
    </div>
  );
}

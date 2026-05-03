import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Mode } from "@/lib/strength";

interface User {
  id: string;
  name: string;
  email: string;
  avatarInitials?: string | null;
  settings?: {
    defaultStrength?: number;
    theme?: string;
    systemPrompt?: string;
    defaultChatModel?: string;
    defaultCodeModel?: string;
    enabledTools?: string | null;
  } | null;
}

interface AppState {
  user: User | null;
  mode: Mode;
  selectedChatModel: string | null;  // null → use user's default
  selectedCodeModel: string | null;
  sidebarOpen: boolean;
  setUser: (user: User) => void;
  setMode: (mode: Mode) => void;
  setSelectedChatModel: (id: string | null) => void;
  setSelectedCodeModel: (id: string | null) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      mode: "chat",
      selectedChatModel: null,
      selectedCodeModel: null,
      sidebarOpen: true,
      setUser: (user) => set({ user }),
      setMode: (mode) => set({ mode }),
      setSelectedChatModel: (id) => set({ selectedChatModel: id }),
      setSelectedCodeModel: (id) => set({ selectedCodeModel: id }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
    }),
    {
      name: "nexus-app-store",
      partialize: (s) => ({
        user: s.user,
        mode: s.mode,
        selectedChatModel: s.selectedChatModel,
        selectedCodeModel: s.selectedCodeModel,
      }),
    }
  )
);

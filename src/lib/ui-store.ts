"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  paletteOpen: boolean;
  askOpen: boolean;
  askSeed: string;
  toggleSidebar: () => void;
  setMobileNav: (v: boolean) => void;
  setPalette: (v: boolean) => void;
  openAsk: (seed?: string) => void;
  setAsk: (v: boolean) => void;
}

export const useUI = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      mobileNavOpen: false,
      paletteOpen: false,
      askOpen: false,
      askSeed: "",
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setMobileNav: (v) => set({ mobileNavOpen: v }),
      setPalette: (v) => set({ paletteOpen: v }),
      openAsk: (seed = "") => set({ askOpen: true, askSeed: seed, paletteOpen: false }),
      setAsk: (v) => set({ askOpen: v }),
    }),
    { name: "kitchi-ui", partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed }), skipHydration: true },
  ),
);

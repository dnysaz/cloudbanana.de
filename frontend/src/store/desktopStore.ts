import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WinState } from '../types';

interface DesktopState {
  windows: Record<string, WinState>;
  startMenuOpen: boolean;
  winZIndex: number;
  pendingTerminalCommand: string | null;
  tbSearchQuery: string;
  pinnedApps: string[];
  pinApp: (id: string) => void;
  unpinApp: (id: string) => void;
  isPinned: (id: string) => boolean;
  setTbSearchQuery: (q: string) => void;
  setPendingTerminalCommand: (cmd: string | null) => void;
  openWindow: (id: string, title: string, data?: Record<string, unknown>) => void;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  setWindowData: (id: string, data: Record<string, unknown>) => void;
  toggleStartMenu: () => void;
  closeStartMenu: () => void;
  closeAllWindows: () => void;
}

let nextZIndex = (() => {
  try {
    const raw = localStorage.getItem('cloudbanana-desktop');
    if (raw) {
      const parsed = JSON.parse(raw);
      const zValues = Object.values(parsed.state?.windows || {}).map((w: any) => w.zIndex || 0);
      return zValues.length ? Math.max(...zValues) + 1 : 100;
    }
  } catch {}
  return 100;
})();

export const useDesktopStore = create<DesktopState>()(
  persist(
    (set, get) => ({
  windows: {},
  startMenuOpen: false,
  winZIndex: 100,
  pendingTerminalCommand: null,
  tbSearchQuery: '',
  pinnedApps: ['terminal','bnote','www','bananabrowser','taskmgr','settings','nginx-editor'],
  pinApp: (id) => set((s) => ({ pinnedApps: s.pinnedApps.includes(id) ? s.pinnedApps : [...s.pinnedApps, id] })),
  unpinApp: (id) => set((s) => ({ pinnedApps: s.pinnedApps.filter((p) => p !== id) })),
  isPinned: (id) => get().pinnedApps.includes(id),
  setTbSearchQuery: (q) => set({ tbSearchQuery: q }),
  setPendingTerminalCommand: (cmd) => set({ pendingTerminalCommand: cmd }),

  openWindow: (id: string, title: string, data?: Record<string, unknown>) => {
    const state = get();
    if (state.windows[id]) {
      const w = state.windows[id];
      set({
        windows: {
          ...state.windows,
          [id]: { ...w, minimized: false, zIndex: id === 'widgets' ? 40 : ++nextZIndex },
        },
        winZIndex: nextZIndex,
      });
      return;
    }

    const newWin: WinState = {
      id,
      title,
      minimized: false,
      maximized: false,
      restore: null,
      zIndex: id === 'widgets' ? 40 : ++nextZIndex,
      data,
    };

    set({
      windows: { ...state.windows, [id]: newWin },
      winZIndex: nextZIndex,
    });
  },

  closeWindow: (id: string) => {
    const { [id]: _, ...rest } = get().windows;
    set({ windows: rest });
  },

  focusWindow: (id: string) => {
    const w = get().windows[id];
    if (!w) return;
    // Widget always stays behind app windows
    if (id === 'widgets') return;
    set({
      windows: { ...get().windows, [id]: { ...w, minimized: false, zIndex: ++nextZIndex } },
      winZIndex: nextZIndex,
    });
  },

  minimizeWindow: (id: string) => {
    const w = get().windows[id];
    if (!w) return;
    set({
      windows: { ...get().windows, [id]: { ...w, minimized: true } },
    });
  },

  maximizeWindow: (id: string) => {
    const w = get().windows[id];
    if (!w) return;
    if (w.maximized) {
      set({
        windows: {
          ...get().windows,
          [id]: { ...w, maximized: false, restore: null },
        },
      });
    } else {
      set({
        windows: {
          ...get().windows,
          [id]: { ...w, maximized: true, restore: { x: 100, y: 50, w: 600, h: 400 } },
        },
      });
    }
  },

  setWindowData: (id: string, data: Record<string, unknown>) => {
    const w = get().windows[id];
    if (!w) return;
    set({
      windows: { ...get().windows, [id]: { ...w, data: { ...w.data, ...data } } },
    });
  },

  toggleStartMenu: () => set((s) => ({ startMenuOpen: !s.startMenuOpen })),
  closeStartMenu: () => set({ startMenuOpen: false }),

  closeAllWindows: () => set({ windows: {} }),
}),
    { name: 'cloudbanana-desktop', partialize: (state) => {
      const { tbSearchQuery, ...rest } = state;
      return rest;
    } },
  ),
);

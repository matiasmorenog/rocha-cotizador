import { create } from "zustand";

type AdminNavState = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

export const useAdminNavStore = create<AdminNavState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((state) => ({ open: !state.open })),
}));

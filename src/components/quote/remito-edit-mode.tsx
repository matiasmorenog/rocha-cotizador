"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";

type RemitoEditModeContextValue = {
  editMode: boolean;
  setEditMode: (value: boolean) => void;
};

const RemitoEditModeContext =
  createContext<RemitoEditModeContextValue | null>(null);

/** Default off — remito opens in clean view/screenshot mode. */
export function RemitoEditModeProvider({ children }: { children: ReactNode }) {
  const [editMode, setEditMode] = useState(false);
  return (
    <RemitoEditModeContext.Provider value={{ editMode, setEditMode }}>
      {children}
    </RemitoEditModeContext.Provider>
  );
}

export function useRemitoEditMode(): RemitoEditModeContextValue {
  const ctx = useContext(RemitoEditModeContext);
  if (!ctx) {
    return { editMode: false, setEditMode: () => undefined };
  }
  return ctx;
}

/** Outside remito card, next to print actions — toggles interactive edit UI. */
export function RemitoEditModeToggle() {
  const { editMode, setEditMode } = useRemitoEditMode();
  return (
    <Button
      type="button"
      variant={editMode ? "secondary" : "outline"}
      className="print:hidden"
      onClick={() => setEditMode(!editMode)}
    >
      {editMode ? "Salir de edición" : "Editar remito"}
    </Button>
  );
}

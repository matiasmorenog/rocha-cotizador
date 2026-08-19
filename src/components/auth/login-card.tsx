"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type AnimationEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

const LOGIN_CARD_CLASS =
  "w-full space-y-6 rounded-xl border border-[var(--brand-primary)]/20 bg-[var(--brand-primary-soft)]/95 p-6 shadow-sm backdrop-blur-[2px]";

const LoginShakeContext = createContext<{ shake: () => void } | null>(null);

export function useLoginShake() {
  const ctx = useContext(LoginShakeContext);
  if (!ctx) {
    throw new Error("useLoginShake must be used within LoginCard");
  }
  return ctx;
}

export function LoginCard({ children }: { children: ReactNode }) {
  const [shaking, setShaking] = useState(false);
  const shake = useCallback(() => setShaking(true), []);
  const stopShaking = useCallback((e: AnimationEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    setShaking(false);
  }, []);

  return (
    <LoginShakeContext.Provider value={{ shake }}>
      <div
        className={cn(LOGIN_CARD_CLASS, shaking && "login-shake")}
        onAnimationEnd={stopShaking}
      >
        {children}
      </div>
    </LoginShakeContext.Provider>
  );
}

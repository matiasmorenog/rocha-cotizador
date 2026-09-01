"use client";

import type { ReactNode } from "react";
import { isDemoLoginUiEnabled } from "@/lib/demo-login";
import {
  EntrarDemoSection,
  LoginWithDemoOption,
} from "@/components/auth/demo-login-panel";

export function DemoLoginGate({ children }: { children: ReactNode }) {
  if (!isDemoLoginUiEnabled()) return null;
  return children;
}

export function CustomerLoginWithDemo({ children }: { children: ReactNode }) {
  if (!isDemoLoginUiEnabled()) return children;
  return <LoginWithDemoOption kind="customer">{children}</LoginWithDemoOption>;
}

export function AdminLoginWithDemo({ children }: { children: ReactNode }) {
  if (!isDemoLoginUiEnabled()) return children;
  return <LoginWithDemoOption kind="staff">{children}</LoginWithDemoOption>;
}

export function EntrarDemoBlock() {
  return (
    <DemoLoginGate>
      <EntrarDemoSection />
    </DemoLoginGate>
  );
}

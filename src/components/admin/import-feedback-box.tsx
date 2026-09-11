"use client";

import { type ReactNode, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useExitPresence } from "@/hooks/use-exit-presence";
import { cn } from "@/lib/utils";
import {
  type ImportDuplicateWarning,
  type ImportFatalFeedback,
  type ImportRowError,
} from "@/lib/import-feedback";

/** Same exit window as admin payment/customer form collapse. */
const IMPORT_FEEDBACK_EXIT_MS = 250;

type Tone = "success" | "warning" | "error" | "progress";

const toneStyles: Record<
  Tone,
  { box: string; icon: string; title: string; body: string }
> = {
  success: {
    box: "admin-import-feedback admin-import-feedback--success",
    icon: "text-green-700",
    title: "text-green-900",
    body: "text-green-800",
  },
  warning: {
    box: "admin-import-feedback admin-import-feedback--warning",
    icon: "text-amber-700",
    title: "text-amber-950",
    body: "text-amber-900",
  },
  error: {
    box: "admin-import-feedback admin-import-feedback--error",
    icon: "text-red-700",
    title: "text-red-900",
    body: "text-red-800",
  },
  progress: {
    box: "admin-import-feedback admin-import-feedback--progress",
    icon: "text-blue-700",
    title: "text-blue-900",
    body: "text-blue-800",
  },
};

/**
 * Height + fade/slide enter/exit for import alert boxes (same language as
 * admin form collapse: 0fr↔1fr + payment-form-enter/exit).
 * Keeps last non-null `value` while exiting so mid-validate unmount still
 * animates out.
 */
export function ImportFeedbackReveal<T>({
  value,
  className,
  children,
}: {
  value: T | null;
  className?: string;
  children: (snapshot: T) => ReactNode;
}) {
  const show = value != null;
  const { present, exiting, animKey } = useExitPresence(
    show,
    IMPORT_FEEDBACK_EXIT_MS,
  );
  const [snap, setSnap] = useState<T | null>(value);
  if (value != null && !Object.is(value, snap)) {
    setSnap(value);
  }
  const display = value ?? snap;

  if (!present || display == null) return null;

  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows] duration-[250ms] ease-in",
        className,
      )}
      style={{ gridTemplateRows: !exiting ? "1fr" : "0fr" }}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          key={animKey}
          className={cn(exiting ? "payment-form-exit" : "payment-form-enter")}
        >
          {children(display)}
        </div>
      </div>
    </div>
  );
}

function ToneIcon({ tone }: { tone: Tone }) {
  const className = cn("mt-0.5 size-4 shrink-0", toneStyles[tone].icon);
  if (tone === "success") return <CheckCircle2 className={className} aria-hidden />;
  if (tone === "warning") return <AlertTriangle className={className} aria-hidden />;
  if (tone === "progress") {
    return <Loader2 className={cn(className, "animate-spin")} aria-hidden />;
  }
  return <AlertCircle className={className} aria-hidden />;
}

function FeedbackShell({
  tone,
  title,
  children,
}: {
  tone: Tone;
  title: string;
  children?: React.ReactNode;
}) {
  const styles = toneStyles[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "progress" ? "polite" : undefined}
      aria-busy={tone === "progress" ? true : undefined}
      className={cn("rounded-md border px-3 py-2.5 text-sm", styles.box)}
    >
      <div className="flex gap-2">
        <ToneIcon tone={tone} />
        <div className="min-w-0 flex-1 space-y-1">
          <p className={cn("font-medium", styles.title)}>{title}</p>
          {children ? (
            <div className={cn("space-y-1.5 text-xs leading-relaxed", styles.body)}>
              {children}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FeedbackBulletList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="list-disc space-y-0.5 pl-4">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function formatImportElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

/** In-progress banner while validate/import fetch is open. */
export function ImportProgressFeedbackBox({
  phase,
  elapsedSeconds,
  rowHint,
}: {
  phase: "validating" | "importing";
  elapsedSeconds: number;
  /** e.g. validated row count before confirm */
  rowHint?: number;
}) {
  const title =
    phase === "validating"
      ? "Validación en progreso…"
      : "Sincronización en progreso…";
  const elapsed = formatImportElapsed(elapsedSeconds);

  return (
    <FeedbackShell tone="progress" title={title}>
      <p className="flex flex-wrap items-center gap-2">
        <Spinner className="size-3.5" />
        <span>
          Tiempo transcurrido: <strong>{elapsed}</strong>
          {rowHint != null && phase === "importing"
            ? ` · ${rowHint} fila${rowHint === 1 ? "" : "s"}`
            : null}
        </span>
      </p>
      {phase === "importing" ? (
        <p>
          Puede tardar según el tamaño del archivo. No cierres esta pestaña: al
          terminar vas a ver el resultado (ok o error).
        </p>
      ) : (
        <p>Revisando el Excel…</p>
      )}
    </FeedbackShell>
  );
}

export function ImportFatalFeedbackBox({ feedback }: { feedback: ImportFatalFeedback }) {
  return (
    <FeedbackShell tone="error" title={feedback.title}>
      {feedback.detail ? <p>{feedback.detail}</p> : null}
      {feedback.status ? (
        <p className="opacity-80">Código HTTP: {feedback.status}</p>
      ) : null}
    </FeedbackShell>
  );
}

export function ImportRowErrorsBox({
  errors,
  tone = "warning",
  title,
  intro,
}: {
  errors: ImportRowError[];
  tone?: "warning" | "error";
  title?: string;
  intro?: string;
}) {
  if (errors.length === 0) return null;

  const boxTitle =
    title ??
    (tone === "error" ? "Error de importación" : "Filas no importadas");

  return (
    <FeedbackShell tone={tone} title={boxTitle}>
      {intro ? <p>{intro}</p> : null}
      <FeedbackBulletList
        items={errors.map((e) => `Fila ${e.row}: ${e.message}`)}
      />
    </FeedbackShell>
  );
}

export function ImportDuplicateWarningsBox({
  warnings,
}: {
  warnings: ImportDuplicateWarning[];
}) {
  if (warnings.length === 0) return null;

  const title =
    warnings.length === 1
      ? "1 código duplicado en el archivo"
      : `${warnings.length} códigos duplicados en el archivo`;

  return (
    <FeedbackShell tone="warning" title={title}>
      <FeedbackBulletList items={warnings.map((w) => w.message)} />
    </FeedbackShell>
  );
}

export function ImportSuccessFeedbackBox({
  headline,
  partial,
  title,
}: {
  headline: string;
  partial?: boolean;
  title?: string;
}) {
  const boxTitle =
    title ??
    (partial ? "Importación parcial" : "Importación completada");

  return (
    <FeedbackShell
      tone={partial ? "warning" : "success"}
      title={boxTitle}
    >
      <p>{headline}</p>
      {partial ? (
        <p>Algunas filas se guardaron; el resto quedó con error.</p>
      ) : null}
    </FeedbackShell>
  );
}

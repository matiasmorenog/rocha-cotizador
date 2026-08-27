import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ImportFatalFeedback, ImportRowError } from "@/lib/import-feedback";

type Tone = "success" | "warning" | "error";

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
};

function ToneIcon({ tone }: { tone: Tone }) {
  const className = cn("mt-0.5 size-4 shrink-0", toneStyles[tone].icon);
  if (tone === "success") return <CheckCircle2 className={className} aria-hidden />;
  if (tone === "warning") return <AlertTriangle className={className} aria-hidden />;
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
      className={cn("rounded-md border px-3 py-2.5 text-sm", styles.box)}
    >
      <div className="flex gap-2">
        <ToneIcon tone={tone} />
        <div className="min-w-0 flex-1 space-y-1">
          <p className={cn("font-medium", styles.title)}>{title}</p>
          {children ? (
            <div className={cn("space-y-2 text-xs leading-relaxed", styles.body)}>
              {children}
            </div>
          ) : null}
        </div>
      </div>
    </div>
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
}: {
  errors: ImportRowError[];
  tone?: "warning" | "error";
}) {
  if (errors.length === 0) return null;

  const title =
    tone === "error"
      ? `${errors.length} fila${errors.length === 1 ? "" : "s"} con error`
      : `${errors.length} fila${errors.length === 1 ? "" : "s"} no importada${errors.length === 1 ? "" : "s"}`;

  return (
    <FeedbackShell tone={tone} title={title}>
      <ul className="max-h-48 list-none space-y-1 overflow-y-auto pr-1">
        {errors.map((item) => (
          <li key={`${item.row}-${item.message}`}>
            <span className="font-medium">Fila {item.row}:</span> {item.message}
          </li>
        ))}
      </ul>
    </FeedbackShell>
  );
}

export function ImportSuccessFeedbackBox({
  headline,
  partial,
}: {
  headline: string;
  partial?: boolean;
}) {
  return (
    <FeedbackShell
      tone={partial ? "warning" : "success"}
      title={partial ? "Importación parcial" : "Importación completada"}
    >
      <p>{headline}</p>
      {partial ? (
        <p>Algunas filas se guardaron; revisá los errores de fila abajo.</p>
      ) : null}
    </FeedbackShell>
  );
}

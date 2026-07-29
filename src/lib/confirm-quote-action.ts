/** localStorage: last chosen post-confirm redirect for quote submit. */
export const CONFIRM_QUOTE_ACTION_KEY = "rocha:confirm-quote-action";

export type ConfirmQuoteAction = "view" | "new";

export function readConfirmQuoteAction(): ConfirmQuoteAction {
  try {
    const value = localStorage.getItem(CONFIRM_QUOTE_ACTION_KEY);
    if (value === "view" || value === "new") return value;
  } catch {
    // private mode / quota
  }
  return "view";
}

export function saveConfirmQuoteAction(action: ConfirmQuoteAction): void {
  try {
    localStorage.setItem(CONFIRM_QUOTE_ACTION_KEY, action);
  } catch {
    // private mode / quota
  }
}

export function confirmQuoteActionLabel(action: ConfirmQuoteAction): string {
  return action === "new"
    ? "Confirmar y crear nuevo remito"
    : "Confirmar y ver remito";
}

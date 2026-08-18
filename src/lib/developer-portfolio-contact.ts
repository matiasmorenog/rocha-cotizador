/**
 * Portfolio CTA shown on customer pages (cotizar, remitos, cuenta).
 * Update email / WhatsApp before go-live if needed.
 */
export const DEVELOPER_PORTFOLIO_CONTACT = {
  email: "hola@matiasmorenogallo.com",
  mailtoSubject: "Consulta — app o web para mi negocio",
} as const;

export function developerPortfolioMailtoHref(): string {
  const subject = encodeURIComponent(DEVELOPER_PORTFOLIO_CONTACT.mailtoSubject);
  return `mailto:${DEVELOPER_PORTFOLIO_CONTACT.email}?subject=${subject}`;
}

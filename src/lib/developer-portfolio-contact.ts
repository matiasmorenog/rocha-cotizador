/**
 * Portfolio CTA shown on customer pages (cotizar, remitos, cuenta).
 * Update email / WhatsApp before go-live if needed.
 */
export const DEVELOPER_PORTFOLIO_CONTACT = {
  email: "hola@matiasmorenogallo.com",
  mailtoSubject: "Consulta — app o web para mi negocio",
  /** AR mobile: 54 + 9 + 11 6353 7809 (Buenos Aires) */
  whatsAppPhoneE164: "5491163537809",
  whatsAppMessage:
    "Hola! Vi el aviso en Rocha Cotizador. Necesito una app o página web para mi negocio.",
} as const;

export function developerPortfolioWhatsAppHref(): string {
  const text = encodeURIComponent(DEVELOPER_PORTFOLIO_CONTACT.whatsAppMessage);
  return `https://wa.me/${DEVELOPER_PORTFOLIO_CONTACT.whatsAppPhoneE164}?text=${text}`;
}

export function developerPortfolioMailtoHref(): string {
  const subject = encodeURIComponent(DEVELOPER_PORTFOLIO_CONTACT.mailtoSubject);
  return `mailto:${DEVELOPER_PORTFOLIO_CONTACT.email}?subject=${subject}`;
}

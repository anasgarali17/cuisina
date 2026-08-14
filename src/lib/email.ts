import "server-only";
import { emailConfigured } from "@/lib/env";

/**
 * L'envoi d'e-mails, réduit au strict nécessaire.
 *
 * L'application n'en envoyait aucun jusqu'ici — seulement des liens WhatsApp
 * qu'un conseiller ouvrait à la main. Le rappel de 15 h est le premier envoi
 * réellement automatique, et il passe par ici.
 *
 * Sans clé configurée, `envoyerEmail` ne jette pas : il renvoie `false`. Le
 * même prudence que pour WhatsApp — on veut voir la file se calculer
 * correctement plusieurs jours avant qu'un message parte tout seul.
 */
export interface Courriel {
  to: string;
  subject: string;
  /** Corps en texte brut ; `html` est dérivé si absent. */
  text: string;
  html?: string;
}

export async function envoyerEmail(courriel: Courriel): Promise<boolean> {
  if (!emailConfigured()) return false;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: courriel.to,
      subject: courriel.subject,
      text: courriel.text,
      html: courriel.html ?? enHtml(courriel.text),
    }),
  });

  return response.ok;
}

/**
 * Un corps texte transformé en HTML lisible : les paragraphes deviennent des
 * paragraphes, rien de plus. Un rappel de rendez-vous se lit en dix secondes
 * — il n'a pas besoin d'une maquette.
 */
function enHtml(texte: string): string {
  const corps = texte
    .split("\n\n")
    .map(
      (p) =>
        `<p style="margin:0 0 12px">${p
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.55;color:#111">${corps}</div>`;
}

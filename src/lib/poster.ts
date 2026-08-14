/**
 * L'affiche à imprimer : QR code en haut, lien en bas, la marque autour.
 *
 * Fonction pure produisant du SVG — le même document sert à l'aperçu écran,
 * au téléchargement SVG et, rastérisé, au PNG. Georgia pour le mot CUISINA,
 * exactement comme public/cuisina-logo.svg : c'est la seule serif qu'on
 * trouve partout, y compris sur la machine de l'imprimeur.
 */

export interface PosterLabels {
  /** Titre principal, ex. « Votre projet cuisine commence ici. » */
  titre: string;
  /** Ligne d'appel sous le titre. */
  sousTitre: string;
  /** Petite capitale au-dessus du lien, ex. « Ou saisissez ce lien ». */
  lienLabel: string;
  /** Baseline de l'affiche, ex. « Cuisina Sousse · Sousse ». */
  pied: string;
  /** Marque de forme, à droite du pied. */
  code: string;
}

export interface PosterOptions extends PosterLabels {
  /** Modules du QR, ligne par ligne. */
  bits: string;
  size: number;
  /** URL affichée en clair sous le code (sans le schéma). */
  lien: string;
}

const ROUGE = "#C1121F";
const NOIR = "#16130F";
const CREME = "#FAF4EA";
const BLANC = "#FFFFFF";
const GRIS = "#8A8178";
const BORDURE = "#E8DFD1";

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "'Inter Tight', 'Helvetica Neue', Arial, sans-serif";
const MONO = "'IBM Plex Mono', 'Courier New', monospace";

const W = 720;
const H = 1080;

/** Zone du code : panneau blanc de 480, code de 380 centré dedans. */
const PANEL = { x: 120, y: 392, side: 480 };
const QR = { x: 170, y: 442, side: 380 };

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Les trois cibles d'angle, redessinées en carrés arrondis. */
function finder(ox: number, oy: number, m: number): string {
  const outer = `<rect x="${round(ox + m / 2)}" y="${round(oy + m / 2)}" width="${round(m * 6)}" height="${round(m * 6)}" rx="${round(m * 1.8)}" fill="none" stroke="${ROUGE}" stroke-width="${round(m)}"/>`;
  const core = `<rect x="${round(ox + m * 2)}" y="${round(oy + m * 2)}" width="${round(m * 3)}" height="${round(m * 3)}" rx="${round(m * 0.95)}" fill="${ROUGE}"/>`;
  return outer + core;
}

function modules(bits: string, size: number): string {
  const m = QR.side / size;
  const r = round(m * 0.3);
  const parts: string[] = [];

  // Les cibles d'angle sont dessinées à part : on saute leurs 7×7 modules.
  const inFinder = (row: number, col: number): boolean =>
    (row < 7 && col < 7) ||
    (row < 7 && col >= size - 7) ||
    (row >= size - 7 && col < 7);

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (bits[row * size + col] !== "1" || inFinder(row, col)) continue;
      const x = round(QR.x + col * m);
      const y = round(QR.y + row * m);
      parts.push(
        `<rect x="${x}" y="${y}" width="${round(m)}" height="${round(m)}" rx="${r}" fill="${ROUGE}"/>`,
      );
    }
  }

  parts.push(finder(QR.x, QR.y, m));
  parts.push(finder(QR.x + (size - 7) * m, QR.y, m));
  parts.push(finder(QR.x, QR.y + (size - 7) * m, m));
  return parts.join("");
}

/** Le sceau au centre du code — la correction d'erreur H l'absorbe. */
function sceau(): string {
  const side = round(QR.side * 0.23);
  const cx = QR.x + QR.side / 2;
  const cy = QR.y + QR.side / 2;
  const hole = side + 18;
  return [
    `<rect x="${round(cx - hole / 2)}" y="${round(cy - hole / 2)}" width="${hole}" height="${hole}" rx="20" fill="${BLANC}"/>`,
    `<rect x="${round(cx - side / 2)}" y="${round(cy - side / 2)}" width="${side}" height="${side}" rx="15" fill="${ROUGE}"/>`,
    `<text x="${round(cx)}" y="${round(cy + 4.5)}" text-anchor="middle" font-family="${SERIF}" font-size="12.5" letter-spacing="0.6" fill="${BLANC}">CUISINA</text>`,
  ].join("");
}

export function posterSvg(options: PosterOptions): string {
  const { bits, size, lien, titre, sousTitre, lienLabel, pied, code } = options;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(titre)} — ${esc(lien)}">
  <rect width="${W}" height="${H}" fill="${CREME}"/>
  <rect x="24" y="24" width="${W - 48}" height="${H - 48}" rx="26" fill="none" stroke="${ROUGE}" stroke-width="1.5" opacity="0.35"/>

  <!-- Marque -->
  <rect x="316" y="72" width="88" height="88" rx="20" fill="${ROUGE}"/>
  <text x="360" y="126" text-anchor="middle" font-family="${SERIF}" font-size="15" letter-spacing="0.8" fill="${BLANC}">CUISINA</text>
  <text x="360" y="218" text-anchor="middle" font-family="${SERIF}" font-size="40" letter-spacing="6" fill="${NOIR}">CUISINA</text>
  <text x="360" y="245" text-anchor="middle" font-family="${SERIF}" font-size="11.5" letter-spacing="3.2" fill="${GRIS}">VOTRE CUISINE AUTREMENT</text>
  <rect x="290" y="268" width="140" height="3" fill="${ROUGE}"/>

  <!-- Accroche -->
  <text x="360" y="330" text-anchor="middle" font-family="${SANS}" font-size="32" font-weight="700" fill="${NOIR}">${esc(titre)}</text>
  <text x="360" y="364" text-anchor="middle" font-family="${SANS}" font-size="17" fill="${GRIS}">${esc(sousTitre)}</text>

  <!-- Code -->
  <rect x="${PANEL.x}" y="${PANEL.y}" width="${PANEL.side}" height="${PANEL.side}" rx="30" fill="${BLANC}" stroke="${BORDURE}" stroke-width="1.5"/>
  ${modules(bits, size)}
  ${sceau()}

  <!-- Lien -->
  <text x="360" y="918" text-anchor="middle" font-family="${SANS}" font-size="12" letter-spacing="2.4" fill="${GRIS}">${esc(lienLabel.toUpperCase())}</text>
  <rect x="96" y="936" width="528" height="56" rx="28" fill="${BLANC}" stroke="${ROUGE}" stroke-width="1.5" stroke-dasharray="7 6" opacity="0.95"/>
  <text x="360" y="972" text-anchor="middle" font-family="${MONO}" font-size="18" fill="${ROUGE}">${esc(lien)}</text>

  <!-- Pied -->
  <text x="360" y="1032" text-anchor="middle" font-family="${SANS}" font-size="13" fill="${GRIS}">${esc(pied)} · ${esc(code)}</text>
</svg>`;
}

/** Data URL utilisable comme src d'une image ou href de téléchargement. */
export function posterDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

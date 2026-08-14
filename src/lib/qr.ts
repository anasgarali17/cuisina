import "server-only";
import QRCode from "qrcode";

/**
 * Une matrice de modules, pas une image : l'affiche est dessinée par
 * `posterSvg` aux couleurs de la maison. Le calcul reste côté serveur —
 * l'encodeur pèse une quarantaine de kilo-octets qui n'ont rien à faire
 * dans le bundle du navigateur.
 */
export interface QrMatrix {
  size: number;
  /** Modules en ligne, ligne par ligne : "1" plein, "0" vide. */
  bits: string;
}

export function qrMatrix(text: string): QrMatrix {
  // Niveau H (30 % de redondance) : c'est ce qui autorise le logo au centre
  // sans rendre le code illisible.
  const qr = QRCode.create(text, { errorCorrectionLevel: "H" });
  const { size, data } = qr.modules;
  let bits = "";
  for (let i = 0; i < data.length; i += 1) bits += data[i] ? "1" : "0";
  return { size, bits };
}

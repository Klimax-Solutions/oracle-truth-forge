/**
 * normalizePhone — source de vérité unique pour les numéros de téléphone.
 *
 * Formate en E.164 international (+33XXXXXXXXX) quel que soit le format d'entrée.
 *
 * Cas couverts :
 *   "+33 6 22 22 11 56"  → "+33622221156"
 *   "+33622221156"       → "+33622221156"
 *   "0622221156"         → "+33622221156"  (national FR)
 *   "06 22 22 11 56"     → "+33622221156"
 *   "33622221156"        → "+33622221156"  (sans +)
 *   "+447911123456"      → "+447911123456" (non-FR, conservé tel quel)
 *   ""                   → ""
 */
export function normalizePhone(raw: string | null | undefined): string {
  if (!raw?.trim()) return "";

  // Enlève espaces, tirets, points, parenthèses — garde + et chiffres
  let s = raw.trim().replace(/[\s\-().]/g, "");

  // 0XXXXXXXXX → +33XXXXXXXXX  (format national FR à 10 chiffres)
  if (/^0\d{9}$/.test(s)) {
    return "+33" + s.slice(1);
  }

  // 33XXXXXXXXX → +33XXXXXXXXX  (code pays sans +)
  if (/^33\d{9}$/.test(s)) {
    return "+" + s;
  }

  // +33XXXXXXXXX ou tout autre format international → retourné tel quel
  // (les non-français ont leur propre format, on ne touche pas)
  return s;
}

/**
 * normalizePhoneForWhatsApp — format pour l'URL wa.me/XXXXXXXXXXX
 * Enlève le + initial requis par wa.me.
 */
export function normalizePhoneForWhatsApp(raw: string | null | undefined): string {
  const n = normalizePhone(raw);
  return n.startsWith("+") ? n.slice(1) : n;
}

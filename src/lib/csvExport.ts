/**
 * Cellule CSV (séparateur « ; ») protégée contre l'injection de formule : un texte commençant par
 * `=`, `+`, `-`, `@` (ou tabulation / retour chariot) est préfixé d'une apostrophe pour qu'Excel
 * ou LibreOffice l'affichent comme du texte au lieu de l'exécuter.
 */
export function csvCell(s: string): string {
  const v = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return `"${v.replace(/"/g, '""')}"`
}

/**
 * Verificações simples de HTML para os modelos renderizados.
 */

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

/**
 * Confere se as marcas abrem e fecham em ordem (acha `</ol>` sobrando, `<div>` sem fechar...).
 * @param {string} html
 * @returns {string[]} problemas encontrados
 */
export function balanceProblems(html) {
  const problems = [];
  const stack = [];
  const clean = html.replace(/<!--[\s\S]*?-->/g, "");
  for (const match of clean.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?(\/?)>/g)) {
    const tag = match[1].toLowerCase();
    const closing = match[0].startsWith("</");
    if (VOID.has(tag) || match[2] === "/") continue;
    if (!closing) {
      stack.push(tag);
      continue;
    }
    const top = stack.pop();
    if (top !== tag) problems.push(`</${tag}> fecha ${top ? `<${top}>` : "nada"}`);
  }
  for (const tag of stack) problems.push(`<${tag}> sem fechar`);
  return problems;
}

/** Textos que nunca devem aparecer numa ficha pronta. */
export function leakedText(html) {
  const text = html.replace(/<[^>]*>/g, " ");
  const found = [];
  for (const pattern of [/MARVEL_MULTIVERSE\./, /\bTYPES\./, /undefined/, /\[object Object\]/, /\bNaN\b/, /\{\{/, /\}\}/]) {
    if (pattern.test(text)) found.push(pattern.source);
  }
  return found;
}

/** Anotações `<a>` dentro de `<a>` (o navegador "conserta" em silêncio e a ficha quebra). */
export function nestedAnchors(html) {
  const problems = [];
  let depth = 0;
  for (const match of html.matchAll(/<(\/?)a\b[^>]*>/gi)) {
    if (match[1]) depth--;
    else if (++depth > 1) problems.push("<a> dentro de <a>");
  }
  return problems;
}

/**
 * O que Origens, Ocupações e Formas concedem à ficha: poderes, traços e tags.
 *
 * Cada concessão é uma linha `{ name, note?, img?, system? }` (ou só o nome). Com `system`, o item é
 * criado a partir desses dados; sem ele, a ficha procura um item do mesmo nome e tipo no mundo e,
 * se não achar, cria um item vazio com o nome.
 */

const localize = (key) => game.i18n.localize(key);

/** Tipos de item que uma concessão pode ser, e o campo de cada um nos dados da Origem/Forma. */
export const GRANT_FIELDS = { power: "powers", trait: "traits", tag: "tags" };

/**
 * Lê "Elemental Blast (Energy)" como `{ name: "Elemental Blast", note: "Energy" }`.
 * @param {string} text
 * @returns {{name: string, note?: string}|null}
 */
export function parseGrantLabel(text) {
  const clean = String(text ?? "").trim();
  if (!clean) return null;
  const match = clean.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  if (match && match[1].trim()) return { name: match[1].trim(), note: match[2].trim() };
  return { name: clean };
}

/** Texto de uma concessão: "Nome" ou "Nome (nota)". */
export function grantLabel(entry) {
  if (typeof entry === "string") return entry;
  if (!entry?.name) return "";
  return entry.note ? `${entry.name} (${entry.note})` : entry.name;
}

/**
 * Elemento citado numa nota ("Energy", "Fogo", "Energy; 10 pontos para quebrar"), ou "".
 * @param {string} note
 * @returns {string} chave do elemento
 */
export function elementFromNote(note) {
  const first = String(note ?? "").split(/[;,]/)[0].trim().toLowerCase();
  if (!first) return "";
  for (const [key, element] of Object.entries(CONFIG.MARVEL_MULTIVERSE.elements)) {
    if (first === key || first === localize(element.name).toLowerCase()) return key;
  }
  return "";
}

/**
 * Dados do item que uma concessão cria.
 *
 * @param {object|string} entry
 * @param {"power"|"trait"|"tag"} type
 * @param {object} [options]
 * @param {string} [options.defaultElement]   Elemento da ficha, para poderes elementais sem elemento
 * @returns {object|null}
 */
export function grantItemData(entry, type, { defaultElement = "" } = {}) {
  const raw = typeof entry === "string" ? { name: entry } : entry;
  if (!raw?.name) return null;

  const wanted = String(raw.name).toLowerCase();
  const world = game.items.find((i) => i.type === type && i.name.toLowerCase() === wanted);
  const embedded = raw.system && Object.keys(raw.system).length;
  const source = embedded ? { name: raw.name, img: raw.img, system: raw.system } : world ? world.toObject() : { name: raw.name };

  const data = foundry.utils.deepClone(source);
  delete data._id;
  delete data.folder;
  delete data.ownership;
  if (data.img === undefined) delete data.img;
  data.type = type;
  data.system ??= {};

  // Nota da concessão ("Connections" + "Criminal"): fica no nome, "Connections (Criminal)".
  if (raw.note) data.name = `${data.name} (${raw.note})`;

  if (type === "power" && !data.system.element) {
    const elemental = data.system.isElemental || data.system.powerSet === "Elemental Control";
    const fromNote = elemental ? elementFromNote(raw.note) : "";
    const element = fromNote || (elemental ? defaultElement : "");
    if (element) data.system.element = element;
  }
  return data;
}

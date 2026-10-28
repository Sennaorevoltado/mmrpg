/**
 * Formato de conteúdo importável/exportável (JSON) — sem dependência do Foundry.
 *
 * O sistema não traz conteúdo de livros. Cada usuário monta o próprio arquivo neste formato
 * (por exemplo, com a própria tradução) e o importa pela janela de importação.
 *
 * {
 *   "format": "mmrpg-content",
 *   "version": 1,
 *   "source": "texto livre",
 *   "items": [
 *     { "type": "power", "name": "…", "img": "…", "folder": "Poderes/Telecinese",
 *       "system": { …campos do item… },
 *       "effects": [ { "name": "…", "transfer": true,
 *                      "changes": [ { "key": "system.…", "type": "upgrade", "value": "1" } ] } ] }
 *   ]
 * }
 */

export const CONTENT_FORMAT = "mmrpg-content";
export const CONTENT_VERSION = 1;
export const ITEM_TYPES = Object.freeze(["power", "trait", "tag", "origin", "occupation", "weapon", "gear"]);

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** Tipos de alteração aceitos nos efeitos de um item. */
export const EFFECT_CHANGE_TYPES = Object.freeze(["add", "multiply", "override", "upgrade", "downgrade"]);

/**
 * Valida e normaliza os efeitos passivos de um item.
 * @param {*} raw
 * @returns {{ effects?: object[], error?: string }}
 */
function normalizeItemEffects(raw) {
  if (!Array.isArray(raw)) return { error: '"effects" precisa ser uma lista.' };
  const effects = [];
  for (const [index, entry] of raw.entries()) {
    const label = `efeito ${index + 1}`;
    if (!isObject(entry)) return { error: `${label}: precisa ser um objeto.` };
    const changesRaw = entry.changes ?? [];
    if (!Array.isArray(changesRaw)) return { error: `${label}: "changes" precisa ser uma lista.` };
    const changes = [];
    for (const change of changesRaw) {
      if (!isObject(change) || typeof change.key !== "string" || !change.key.trim()) {
        return { error: `${label}: cada alteração precisa de "key".` };
      }
      const type = change.type ?? "add";
      if (!EFFECT_CHANGE_TYPES.includes(type)) {
        return { error: `${label}: tipo de alteração inválido "${type}" (use ${EFFECT_CHANGE_TYPES.join(", ")}).` };
      }
      if (change.value === undefined || change.value === null || change.value === "") {
        return { error: `${label}: a alteração de "${change.key}" precisa de "value".` };
      }
      const entry = { key: change.key.trim(), type, value: String(change.value) };
      if (change.priority !== undefined && change.priority !== null && change.priority !== "") {
        const priority = Number(change.priority);
        if (!Number.isInteger(priority)) return { error: `${label}: "priority" de "${change.key}" precisa ser um número inteiro.` };
        entry.priority = priority;
      }
      changes.push(entry);
    }
    effects.push({
      name: typeof entry.name === "string" ? entry.name.trim() : "",
      img: typeof entry.img === "string" && entry.img ? entry.img : null,
      transfer: entry.transfer === undefined ? true : !!entry.transfer,
      disabled: !!entry.disabled,
      changes
    });
  }
  return { effects };
}

/** Chave estável de um item (tipo + nome normalizado). */
export function contentKey(type, name) {
  return `${type}:${String(name).trim().toLowerCase()}`;
}

/**
 * Lê e valida um arquivo de conteúdo.
 *
 * @param {string|object} input
 * @returns {{ items: object[], errors: string[], warnings: string[], source: string }}
 */
export function parseContent(input) {
  const errors = [];
  const warnings = [];
  let data = input;

  if (typeof input === "string") {
    try {
      data = JSON.parse(input);
    } catch (err) {
      return { items: [], errors: [`JSON inválido: ${err.message}`], warnings, source: "" };
    }
  }
  if (!isObject(data)) {
    return { items: [], errors: ["O arquivo precisa conter um objeto JSON."], warnings, source: "" };
  }
  if (data.format !== CONTENT_FORMAT) {
    errors.push(`Formato desconhecido: esperado "${CONTENT_FORMAT}".`);
    return { items: [], errors, warnings, source: "" };
  }
  if (Number(data.version) > CONTENT_VERSION) {
    errors.push(`O arquivo usa a versão ${data.version}; este sistema entende até a ${CONTENT_VERSION}.`);
    return { items: [], errors, warnings, source: "" };
  }
  if (!Array.isArray(data.items)) {
    errors.push('O campo "items" precisa ser uma lista.');
    return { items: [], errors, warnings, source: "" };
  }

  const items = [];
  const seen = new Set();

  data.items.forEach((raw, index) => {
    const where = `Item ${index + 1}`;
    if (!isObject(raw)) {
      errors.push(`${where}: precisa ser um objeto.`);
      return;
    }
    if (!ITEM_TYPES.includes(raw.type)) {
      errors.push(`${where}: tipo inválido "${raw.type}".`);
      return;
    }
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!name) {
      errors.push(`${where}: nome ausente.`);
      return;
    }
    if (raw.system !== undefined && !isObject(raw.system)) {
      errors.push(`${where} (${name}): "system" precisa ser um objeto.`);
      return;
    }
    const system = raw.system ? JSON.parse(JSON.stringify(raw.system)) : {};

    if (system.actions !== undefined && !Array.isArray(system.actions)) {
      errors.push(`${where} (${name}): "system.actions" precisa ser uma lista.`);
      return;
    }
    if ((system.actions ?? []).some((a) => !isObject(a))) {
      errors.push(`${where} (${name}): cada ação precisa ser um objeto.`);
      return;
    }
    if (system.grants !== undefined && !Array.isArray(system.grants)) {
      errors.push(`${where} (${name}): "system.grants" precisa ser uma lista.`);
      return;
    }
    for (const g of system.grants ?? []) {
      if (!isObject(g) || (!g.uuid && !(g.type && g.name))) {
        errors.push(`${where} (${name}): cada concessão precisa de "uuid" ou de "type" e "name".`);
        return;
      }
    }

    let effects;
    if (raw.effects !== undefined) {
      const result = normalizeItemEffects(raw.effects);
      if (result.error) {
        errors.push(`${where} (${name}): ${result.error}`);
        return;
      }
      effects = result.effects;
    }

    normalizeActions(system);

    const key = contentKey(raw.type, name);
    if (seen.has(key)) warnings.push(`${where}: "${name}" aparece repetido; o último vale.`);
    seen.add(key);

    items.push({
      key,
      type: raw.type,
      name,
      img: typeof raw.img === "string" && raw.img ? raw.img : null,
      folder: typeof raw.folder === "string" ? raw.folder.split("/").map((s) => s.trim()).filter(Boolean) : [],
      system,
      ...(effects ? { effects } : {})
    });
  });

  // Em caso de repetição, vale o último.
  const byKey = new Map();
  for (const item of items) byKey.set(item.key, item);

  return { items: [...byKey.values()], errors, warnings, source: typeof data.source === "string" ? data.source : "" };
}

/**
 * Dá ids estáveis às ações e aos efeitos (para que reimportar o mesmo arquivo não quebre macros
 * nem a renovação de efeitos) e começa as ações de usos limitados com todos os usos.
 * @param {object} system
 */
function normalizeActions(system) {
  if (!Array.isArray(system.actions)) return;
  system.actions.forEach((action, i) => {
    action.id = action.id || `a${i + 1}`;
    if (isObject(action.uses) && Number(action.uses.max) > 0 && action.uses.value === undefined) {
      action.uses.value = action.uses.max;
    }
    if (Array.isArray(action.effects)) {
      action.effects.forEach((effect, j) => {
        if (isObject(effect)) effect.id = effect.id || `${action.id}-e${j + 1}`;
      });
    }
  });
}

/**
 * Contagem de itens por tipo.
 * @param {{ type: string }[]} items
 * @returns {Record<string, number>}
 */
export function countByType(items) {
  const counts = {};
  for (const item of items) counts[item.type] = (counts[item.type] ?? 0) + 1;
  return counts;
}

/** Efeito no arquivo de exportação, sem os campos vazios (nome igual ao do item, ícone padrão). */
function exportEffect(effect) {
  return {
    ...(effect.name ? { name: effect.name } : {}),
    ...(effect.img ? { img: effect.img } : {}),
    transfer: effect.transfer,
    disabled: effect.disabled,
    changes: effect.changes
  };
}

/**
 * Monta o objeto de exportação.
 * @param {{ type: string, name: string, img?: string, folder?: string[], system: object }[]} items
 * @param {{ source?: string }} [options]
 */
export function buildContentFile(items, { source = "" } = {}) {
  return {
    format: CONTENT_FORMAT,
    version: CONTENT_VERSION,
    source,
    items: items.map((i) => ({
      type: i.type,
      name: i.name,
      ...(i.img ? { img: i.img } : {}),
      ...(i.folder?.length ? { folder: i.folder.join("/") } : {}),
      system: i.system,
      ...(i.effects?.length ? { effects: i.effects.map(exportEffect) } : {})
    }))
  };
}

/**
 * Resolve concessões escritas por tipo e nome (sem uuid) usando itens já criados.
 *
 * @param {object[]} grants               Lista de concessões do item.
 * @param {(type: string, name: string) => { uuid: string, name: string, type: string }|null} lookup
 * @returns {{ grants: object[], unresolved: string[] }}
 */
export function resolveGrants(grants, lookup) {
  const unresolved = [];
  const resolved = grants.map((g) => {
    const note = typeof g.note === "string" ? g.note.trim() : "";
    if (g.uuid) return { uuid: g.uuid, name: g.name ?? "", type: g.type ?? "", note };
    const found = lookup(g.type, g.name);
    if (!found) {
      unresolved.push(`${g.type}:${g.name}`);
      return { uuid: "", name: g.name, type: g.type, note };
    }
    return { uuid: found.uuid, name: found.name, type: found.type, note };
  });
  return { grants: resolved, unresolved };
}

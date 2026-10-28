/**
 * Importação e exportação de conteúdo do usuário: itens do mundo ou compêndios do mundo.
 */

import { MMRPG } from "../config.mjs";
import { ITEM_TYPES, buildContentFile, contentKey, resolveGrants } from "./content-format.mjs";
import { describePacks, ensurePack, ensurePackFolder, existingPacks } from "./compendia.mjs";
import { changeData, changeTypeOf } from "./compat.mjs";

/** Destinos possíveis da importação. */
export const DESTINATIONS = Object.freeze({ world: "world", compendia: "compendia" });

/**
 * Pasta de itens do mundo a partir de um caminho ("A/B"), criando o que faltar.
 * @param {string[]} path
 * @param {Map<string, Folder>} cache
 * @returns {Promise<string|null>} id da pasta
 */
async function ensureFolder(path, cache) {
  if (!path.length) return null;
  let parent = null;
  let id = null;
  for (let i = 0; i < path.length; i++) {
    const key = path.slice(0, i + 1).join("/");
    let folder = cache.get(key);
    if (!folder) {
      folder =
        game.folders.find(
          (f) => f.type === "Item" && f.name === path[i] && (f.folder?.id ?? null) === (parent?.id ?? null)
        ) ?? (await Folder.create({ name: path[i], type: "Item", folder: parent?.id ?? null }));
      cache.set(key, folder);
    }
    parent = folder;
    id = folder.id;
  }
  return id;
}

/** Destino "itens do mundo". */
function worldTarget() {
  const folderCache = new Map();
  return {
    load(known) {
      for (const existing of game.items) known.set(contentKey(existing.type, existing.name), existing);
    },
    async place(entry) {
      return { folder: await ensureFolder(entry.folder, folderCache), options: {} };
    }
  };
}

/** Destino "compêndios do mundo" (um por tipo). */
function compendiaTarget(usedTypes) {
  const folderCache = new Map();
  return {
    async load(known) {
      for (const { type, pack } of existingPacks()) {
        await pack.getIndex();
        for (const entry of pack.index) known.set(contentKey(type, entry.name), entry);
      }
    },
    async place(entry) {
      const pack = await ensurePack(entry.type);
      usedTypes.add(entry.type);
      const folder = await ensurePackFolder(pack, entry.folder, folderCache);
      return { folder, options: { pack: pack.collection } };
    }
  };
}

/** Ícone padrão dos efeitos importados (não precisa voltar na exportação). */
const DEFAULT_EFFECT_ICON = "icons/svg/aura.svg";

/** Dados de um Active Effect do arquivo de conteúdo (efeito passivo do item). */
function effectData(effect, entry) {
  return {
    name: effect.name || entry.name,
    img: effect.img || entry.img || DEFAULT_EFFECT_ICON,
    transfer: effect.transfer,
    disabled: effect.disabled,
    changes: effect.changes.map(changeData),
    flags: { [MMRPG.id]: { imported: true } }
  };
}

/** Substitui os efeitos importados de um item (os criados à mão ficam). */
async function replaceImportedEffects(doc, entry) {
  const old = doc.effects.filter((e) => e.getFlag?.(MMRPG.id, "imported")).map((e) => e.id);
  if (old.length) await doc.deleteEmbeddedDocuments("ActiveEffect", old);
  if (entry.effects.length) await doc.createEmbeddedDocuments("ActiveEffect", entry.effects.map((e) => effectData(e, entry)));
}

/** Documento a partir de um item de índice de compêndio (ou do próprio documento). */
async function toDocument(existing) {
  if (typeof existing.update === "function") return existing;
  return fromUuid(existing.uuid);
}

/**
 * Importa itens já validados (saída de parseContent).
 *
 * @param {object[]} items
 * @param {object} [options]
 * @param {"skip"|"update"|"duplicate"} [options.onDuplicate="skip"]
 * @param {"world"|"compendia"} [options.destination="world"]  Itens do mundo ou compêndios do mundo.
 * @returns {Promise<{ created: number, updated: number, skipped: number, failed: string[], unresolved: string[], packs: string[] }>}
 */
export async function importItems(items, { onDuplicate = "skip", destination = DESTINATIONS.world } = {}) {
  const report = { created: 0, updated: 0, skipped: 0, failed: [], unresolved: [], packs: [] };
  const usedTypes = new Set();
  const target = destination === DESTINATIONS.compendia ? compendiaTarget(usedTypes) : worldTarget();

  /** key → Item (criado ou já existente) */
  const known = new Map();
  await target.load(known);

  const grantsToResolve = [];

  for (const entry of items) {
    try {
      const existing = known.get(entry.key);
      if (existing && onDuplicate === "skip") {
        report.skipped++;
        continue;
      }

      const { folder, options } = await target.place(entry);
      const data = {
        name: entry.name,
        type: entry.type,
        folder,
        system: entry.system,
        flags: { [MMRPG.id]: { imported: true } }
      };
      if (entry.img) data.img = entry.img;
      if (entry.effects) data.effects = entry.effects.map((e) => effectData(e, entry));

      let doc;
      if (existing && onDuplicate === "update") {
        // Substituição completa dos campos enviados.
        doc = await toDocument(existing);
        await doc.update({ name: data.name, img: data.img ?? doc.img, folder, system: entry.system });
        if (entry.effects) await replaceImportedEffects(doc, entry);
        report.updated++;
      } else {
        doc = await Item.create(data, options);
        report.created++;
      }
      known.set(entry.key, doc);
      if (MMRPG.grantingItemTypes.includes(entry.type) && (entry.system.grants ?? []).length) {
        grantsToResolve.push({ doc, grants: entry.system.grants });
      }
    } catch (err) {
      console.error(`${MMRPG.id} | falha ao importar "${entry.name}"`, err);
      report.failed.push(`${entry.name}: ${err.message}`);
    }
  }

  // Segunda passada: concessões por tipo e nome precisam dos itens já existentes.
  const lookup = (type, name) => {
    const doc = known.get(contentKey(type, name));
    return doc ? { uuid: doc.uuid, name: doc.name, type: doc.type ?? type } : null;
  };
  for (const { doc, grants } of grantsToResolve) {
    try {
      const { grants: resolved, unresolved } = resolveGrants(grants, lookup);
      report.unresolved.push(...unresolved.map((u) => `${doc.name} → ${u}`));
      await doc.update({ "system.grants": resolved });
    } catch (err) {
      console.error(`${MMRPG.id} | falha ao ligar as concessões de "${doc.name}"`, err);
      report.failed.push(`${doc.name}: ${err.message}`);
    }
  }

  report.packs = describePacks([...usedTypes]);
  return report;
}

/** Linha de exportação de um item (concessões saem por tipo e nome, para funcionar em outros mundos). */
function toEntry(item) {
  const system = item.system.toObject();
  if (Array.isArray(system.grants)) {
    system.grants = system.grants.map((g) => ({ type: g.type, name: g.name, ...(g.note ? { note: g.note } : {}) }));
  }
  const path = [];
  let folder = item.folder;
  while (folder) {
    path.unshift(folder.name);
    folder = folder.folder;
  }
  const effects = item.effects.map((e) => ({
    name: e.name === item.name ? "" : e.name,
    img: e.img && e.img !== item.img && e.img !== DEFAULT_EFFECT_ICON ? e.img : null,
    transfer: !!e.transfer,
    disabled: !!e.disabled,
    changes: (e.changes ?? []).map((c) => ({
      key: c.key,
      type: changeTypeOf(c),
      value: String(c.value),
      ...(c.priority !== null && c.priority !== undefined ? { priority: c.priority } : {})
    }))
  }));
  return { type: item.type, name: item.name, img: item.img, folder: path, system, effects };
}

/**
 * Itens do mundo prontos para exportar.
 * @param {string[]} [types]  Tipos incluídos (padrão: todos).
 * @returns {object}          Arquivo no formato de conteúdo.
 */
export function exportItems(types = ITEM_TYPES, { source = "" } = {}) {
  const entries = game.items.filter((i) => types.includes(i.type)).map(toEntry);
  return buildContentFile(entries, { source });
}

/**
 * Itens dos compêndios do sistema prontos para exportar.
 * @param {string[]} [types]  Tipos incluídos (padrão: todos).
 * @returns {Promise<object>} Arquivo no formato de conteúdo.
 */
export async function exportPackItems(types = ITEM_TYPES, { source = "" } = {}) {
  const entries = [];
  for (const { type, pack } of existingPacks(types)) {
    const documents = await pack.getDocuments();
    for (const item of documents) {
      if (item.type === type) entries.push(toEntry(item));
    }
  }
  return buildContentFile(entries, { source });
}

/**
 * Importação e exportação de conteúdo do usuário (itens do mundo).
 */

import { MMRPG } from "../config.mjs";
import { ITEM_TYPES, buildContentFile, contentKey, resolveGrants } from "./content-format.mjs";

/**
 * Pasta de itens a partir de um caminho ("A/B"), criando o que faltar.
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

/**
 * Importa itens já validados (saída de parseContent).
 *
 * @param {object[]} items
 * @param {object} [options]
 * @param {"skip"|"update"|"duplicate"} [options.onDuplicate="skip"]
 * @returns {Promise<{ created: number, updated: number, skipped: number, failed: string[], unresolved: string[] }>}
 */
export async function importItems(items, { onDuplicate = "skip" } = {}) {
  const report = { created: 0, updated: 0, skipped: 0, failed: [], unresolved: [] };
  const folderCache = new Map();
  /** key → Item (criado ou já existente) */
  const known = new Map();
  for (const existing of game.items) known.set(contentKey(existing.type, existing.name), existing);

  const grantsToResolve = [];

  for (const entry of items) {
    try {
      const existing = known.get(entry.key);
      const folder = await ensureFolder(entry.folder, folderCache);
      const data = {
        name: entry.name,
        type: entry.type,
        folder,
        system: entry.system,
        flags: { [MMRPG.id]: { imported: true } }
      };
      if (entry.img) data.img = entry.img;

      if (existing && onDuplicate === "skip") {
        report.skipped++;
        continue;
      }
      let doc;
      if (existing && onDuplicate === "update") {
        // Substituição completa dos campos enviados.
        doc = await existing.update({ name: data.name, img: data.img ?? existing.img, folder, system: entry.system });
        doc = existing;
        report.updated++;
      } else {
        doc = await Item.create(data);
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
    return doc ? { uuid: doc.uuid, name: doc.name, type: doc.type } : null;
  };
  for (const { doc, grants } of grantsToResolve) {
    const { grants: resolved, unresolved } = resolveGrants(grants, lookup);
    report.unresolved.push(...unresolved.map((u) => `${doc.name} → ${u}`));
    await doc.update({ "system.grants": resolved });
  }

  return report;
}

/**
 * Itens do mundo prontos para exportar.
 * @param {string[]} [types]  Tipos incluídos (padrão: todos).
 * @returns {object}          Arquivo no formato de conteúdo.
 */
export function exportItems(types = ITEM_TYPES, { source = "" } = {}) {
  const entries = game.items
    .filter((i) => types.includes(i.type))
    .map((item) => {
      const system = item.system.toObject();
      // Concessões saem por tipo e nome, para funcionar em outros mundos.
      if (Array.isArray(system.grants)) {
        system.grants = system.grants.map((g) => ({ type: g.type, name: g.name }));
      }
      const path = [];
      let folder = item.folder;
      while (folder) {
        path.unshift(folder.name);
        folder = folder.folder;
      }
      return { type: item.type, name: item.name, img: item.img, folder: path, system };
    });
  return buildContentFile(entries, { source });
}

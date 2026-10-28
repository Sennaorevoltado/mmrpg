/**
 * Compêndios do mundo, um por tipo de item (poderes, traços, origens, tags...).
 *
 * Os compêndios são criados no MUNDO do usuário, a partir do arquivo de conteúdo dele. Nada disso
 * viaja com o sistema: o sistema continua sem conteúdo de livros.
 */

import { ITEM_TYPES } from "./content-format.mjs";

/** Prefixo do nome interno dos compêndios criados pelo sistema. */
export const PACK_PREFIX = "mmrpg-";

/** Nome interno do compêndio de um tipo (ex.: mmrpg-power). */
export const packNameFor = (type) => `${PACK_PREFIX}${type}`;

/** Identificador completo do compêndio de um tipo (ex.: world.mmrpg-power). */
export const packIdFor = (type) => `world.${packNameFor(type)}`;

/** Rótulo (traduzido) do compêndio de um tipo. */
export const packLabelFor = (type) => game.i18n.localize(`MMRPG.Pack.${type}`);

/** Compêndio já existente de um tipo, ou null. */
export function findPack(type) {
  return game.packs.get(packIdFor(type)) ?? null;
}

/** Compêndios do sistema que já existem neste mundo, na ordem dos tipos. */
export function existingPacks(types = ITEM_TYPES) {
  return types.map((type) => ({ type, pack: findPack(type) })).filter((entry) => entry.pack);
}

/**
 * Compêndio de um tipo; cria se ainda não existir.
 * @param {string} type
 * @returns {Promise<CompendiumCollection>}
 */
export async function ensurePack(type) {
  let pack = findPack(type);
  if (!pack) {
    const CompendiumCollection = foundry.documents?.collections?.CompendiumCollection ?? globalThis.CompendiumCollection;
    const created = await CompendiumCollection.createCompendium({
      type: "Item",
      label: packLabelFor(type),
      name: packNameFor(type)
    });
    pack = findPack(type) ?? created;
  }
  if (!pack) throw new Error(`não foi possível criar o compêndio ${packIdFor(type)}`);
  if (pack.locked) {
    throw new Error(game.i18n.format("MMRPG.Importer.packLocked", { pack: pack.title ?? pack.collection }));
  }
  return pack;
}

/** Id da pasta-mãe, seja ela um documento ou um id. */
const parentId = (folder) => (typeof folder?.folder === "string" ? folder.folder : (folder?.folder?.id ?? null));

/**
 * Pasta dentro de um compêndio a partir de um caminho ("A/B"), criando o que faltar.
 * @param {CompendiumCollection} pack
 * @param {string[]} path
 * @param {Map<string, Folder>} cache
 * @returns {Promise<string|null>} id da pasta
 */
export async function ensurePackFolder(pack, path, cache) {
  if (!path.length) return null;
  let parent = null;
  let id = null;
  for (let i = 0; i < path.length; i++) {
    const key = `${pack.collection}|${path.slice(0, i + 1).join("/")}`;
    let folder = cache.get(key);
    if (!folder) {
      folder =
        pack.folders?.find((f) => f.name === path[i] && parentId(f) === (parent?.id ?? null)) ??
        (await Folder.create({ name: path[i], type: "Item", folder: parent?.id ?? null }, { pack: pack.collection }));
      cache.set(key, folder);
    }
    parent = folder;
    id = folder.id;
  }
  return id;
}

/** Texto curto para o relatório: nomes dos compêndios usados. */
export function describePacks(types) {
  return types.map((type) => packLabelFor(type));
}

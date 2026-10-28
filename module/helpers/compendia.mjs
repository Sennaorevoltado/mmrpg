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

/** Nome de pasta para comparar: sem espaços sobrando nem diferença de maiúsculas. */
export const folderKey = (name) => String(name ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase();

/** Lista os documentos de uma coleção do Foundry (ou de qualquer iterável). */
const listOf = (collection) => (collection ? (collection.contents ?? [...collection]) : []);

/**
 * Resolve um caminho de pastas ("A/B"), reaproveitando as que já existem e criando só o que falta.
 * O cache guarda a promessa de cada pasta: duas chamadas para o mesmo caminho nunca criam a pasta duas vezes.
 *
 * @param {string[]} path
 * @param {object} options
 * @param {Map<string, Promise<Folder>>} options.cache  Compartilhado durante toda a importação.
 * @param {string} options.scope                        Separa os caches (ex.: coleção do compêndio).
 * @param {() => Folder[]} options.existing             Pastas que já existem naquele lugar.
 * @param {(data: object) => Promise<Folder>} options.create
 * @returns {Promise<string|null>} id da última pasta do caminho
 */
export async function ensureFolderPath(path, { cache, scope, existing, create }) {
  let parent = null;
  for (let i = 0; i < path.length; i++) {
    const name = String(path[i]).trim();
    if (!name) continue;
    const key = `${scope}|${path.slice(0, i + 1).map(folderKey).join("/")}`;
    const parentFolderId = parent?.id ?? null;
    let pending = cache.get(key);
    if (!pending) {
      pending = (async () => {
        const found = existing().find((f) => folderKey(f.name) === folderKey(name) && parentId(f) === parentFolderId);
        return found ?? (await create({ name, type: "Item", folder: parentFolderId }));
      })();
      // Se a criação falhar, a próxima tentativa começa do zero em vez de repetir o erro guardado.
      pending.catch(() => cache.delete(key));
      cache.set(key, pending);
    }
    parent = await pending;
  }
  return parent?.id ?? null;
}

/**
 * Pasta dentro de um compêndio a partir de um caminho ("A/B"), criando o que faltar.
 * @param {CompendiumCollection} pack
 * @param {string[]} path
 * @param {Map<string, Promise<Folder>>} cache
 * @returns {Promise<string|null>} id da pasta
 */
export function ensurePackFolder(pack, path, cache) {
  return ensureFolderPath(path, {
    cache,
    scope: pack.collection,
    existing: () => listOf(pack.folders),
    create: (data) => Folder.create(data, { pack: pack.collection })
  });
}

/**
 * Pasta de itens do mundo a partir de um caminho ("A/B"), criando o que faltar.
 * @param {string[]} path
 * @param {Map<string, Promise<Folder>>} cache
 * @returns {Promise<string|null>} id da pasta
 */
export function ensureWorldFolder(path, cache) {
  return ensureFolderPath(path, {
    cache,
    scope: "world",
    existing: () => listOf(game.folders).filter((f) => f.type === "Item"),
    create: (data) => Folder.create(data)
  });
}

/** Texto curto para o relatório: nomes dos compêndios usados. */
export function describePacks(types) {
  return types.map((type) => packLabelFor(type));
}

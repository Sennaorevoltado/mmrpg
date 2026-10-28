/**
 * Importação de conteúdo.
 *
 * O sistema não traz texto de livro. Quem tem o conteúdo (poderes, traços, tags, origens...) recebe um
 * arquivo `.json` do próprio grupo e o importa com o botão "Importar conteúdo" da aba Itens.
 * O arquivo é só uma lista de itens no mesmo formato que o sistema grava; nada é executado.
 */
import { confirmDialog, rootOf } from "./compat.mjs";

export const CONTENT_FORMAT = "mmrpg-content";

/** Tipos de item que o sistema entende. */
export const ITEM_TYPES = ["power", "trait", "tag", "origin", "occupation", "weapon", "item"];

/** Quantos itens vão por vez ao banco de dados do Foundry. */
const BATCH_SIZE = 100;

const localize = (key) => game.i18n.localize(key);
const format = (key, data) => game.i18n.format(key, data);

/**
 * Lê e confere o texto de um arquivo de conteúdo.
 *
 * @param {string} text
 * @returns {{items: Array<object>, skipped: number}}
 * @throws {Error} com a chave de texto em `error.i18n` quando o arquivo não serve
 */
export function parseContent(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    const error = new Error(err.message);
    error.i18n = "MARVEL_MULTIVERSE.Import.BadFile";
    throw error;
  }

  if (!data || data.format !== CONTENT_FORMAT || !Array.isArray(data.items)) {
    const error = new Error("formato");
    error.i18n = "MARVEL_MULTIVERSE.Import.NotContent";
    throw error;
  }

  const items = [];
  let skipped = 0;
  for (const entry of data.items) {
    const valid =
      entry &&
      typeof entry.name === "string" &&
      entry.name.trim() &&
      ITEM_TYPES.includes(entry.type) &&
      (entry.system === undefined || (typeof entry.system === "object" && entry.system !== null));
    if (!valid) {
      skipped++;
      continue;
    }
    items.push({
      type: entry.type,
      name: entry.name.trim(),
      folder: typeof entry.folder === "string" ? entry.folder : "",
      img: typeof entry.img === "string" ? entry.img : undefined,
      system: entry.system ?? {},
    });
  }

  if (!items.length) {
    const error = new Error("vazio");
    error.i18n = "MARVEL_MULTIVERSE.Import.Empty";
    throw error;
  }
  return { items, skipped };
}

/**
 * Caminho de pastas de um item: raiz, pasta do tipo e as subpastas do próprio arquivo.
 * @param {{type: string, folder: string}} entry
 * @param {string} root         Nome da pasta raiz
 * @param {(type: string) => string} typeName
 * @returns {string[]}
 */
export function folderPath(entry, root, typeName) {
  const own = String(entry.folder ?? "")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  return [root, typeName(entry.type), ...own];
}

/** Id da pasta-mãe de uma pasta, em qualquer versão (`folder` é o documento ou o id). */
const parentIdOf = (folder) => folder.folder?.id ?? (typeof folder.folder === "string" ? folder.folder : null) ?? null;

/**
 * Importa os itens para o mundo, criando as pastas que faltarem e pulando o que já existe.
 *
 * @param {Array<object>} items   Itens já conferidos por `parseContent`
 * @returns {Promise<{created: number, skipped: number}>}
 */
export async function importItems(items) {
  const root = localize("MARVEL_MULTIVERSE.Import.Root");
  const typeName = (type) => localize(`MARVEL_MULTIVERSE.Import.Folder.${type}`);

  // Pastas: uma consulta por caminho distinto, em ordem, da raiz para dentro.
  const folderIds = new Map();
  const ensureFolder = async (path) => {
    const key = path.join("/");
    if (folderIds.has(key)) return folderIds.get(key);
    const parentId = path.length > 1 ? await ensureFolder(path.slice(0, -1)) : null;
    const name = path[path.length - 1];
    let folder = game.folders.find((f) => f.type === "Item" && f.name === name && parentIdOf(f) === parentId);
    folder ??= await Folder.create({ name, type: "Item", folder: parentId });
    folderIds.set(key, folder.id);
    return folder.id;
  };

  const existing = new Set(game.items.map((i) => `${i.type}\u0000${i.name}\u0000${i.folder?.id ?? ""}`));
  const toCreate = [];
  let skipped = 0;

  for (const entry of items) {
    const folderId = await ensureFolder(folderPath(entry, root, typeName));
    const key = `${entry.type}\u0000${entry.name}\u0000${folderId}`;
    if (existing.has(key)) {
      skipped++;
      continue;
    }
    existing.add(key);
    const data = { name: entry.name, type: entry.type, folder: folderId, system: entry.system };
    if (entry.img) data.img = entry.img;
    toCreate.push(data);
  }

  let created = 0;
  for (let start = 0; start < toCreate.length; start += BATCH_SIZE) {
    const batch = toCreate.slice(start, start + BATCH_SIZE);
    const docs = await Item.createDocuments(batch);
    created += docs.length;
  }
  return { created, skipped };
}

/**
 * Abre o seletor de arquivo, confere o conteúdo, pede confirmação e importa.
 * @param {object} [options]
 * @param {File} [options.file]   Arquivo já escolhido (pula o seletor)
 * @returns {Promise<{created: number, skipped: number}|null>}
 */
export async function importContent({ file = null } = {}) {
  if (!game.user.isGM) {
    ui.notifications.warn(localize("MARVEL_MULTIVERSE.Import.OnlyGM"));
    return null;
  }

  file ??= await pickFile();
  if (!file) return null;

  let parsed;
  try {
    parsed = parseContent(await file.text());
  } catch (err) {
    const key = err.i18n ?? "MARVEL_MULTIVERSE.Import.BadFile";
    ui.notifications.error(format(key, { error: err.message }));
    return null;
  }

  const escape = (text) => Handlebars.escapeExpression(String(text));
  const ok = await confirmDialog({
    title: localize("MARVEL_MULTIVERSE.Import.Title"),
    content: format("MARVEL_MULTIVERSE.Import.Confirm", { count: parsed.items.length, file: escape(file.name) }),
  });
  if (!ok) return null;

  ui.notifications.info(localize("MARVEL_MULTIVERSE.Import.Running"));
  try {
    const result = await importItems(parsed.items);
    result.skipped += parsed.skipped;
    ui.notifications.info(format("MARVEL_MULTIVERSE.Import.Done", result));
    return result;
  } catch (err) {
    console.error("mmrpg | falha ao importar o conteúdo", err);
    ui.notifications.error(format("MARVEL_MULTIVERSE.Import.Failed", { error: err.message }));
    return null;
  }
}

/** Abre o seletor de arquivo do navegador. Resolve com o arquivo, ou null se a pessoa cancelar. */
function pickFile() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.addEventListener("change", () => resolve(input.files?.[0] ?? null), { once: true });
    input.addEventListener("cancel", () => resolve(null), { once: true });
    input.click();
  });
}

/**
 * Põe o botão "Importar conteúdo" no cabeçalho da aba Itens (só para o Narrador).
 * @param {Application} app
 * @param {HTMLElement|object} html
 */
export function addImportButton(app, html) {
  if (!game.user?.isGM) return;
  const root = rootOf(html);
  if (!root?.querySelector || root.querySelector(".mmrpg-import")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.classList.add("mmrpg-import");
  button.innerHTML = `<i class="fa-solid fa-file-import"></i> ${Handlebars.escapeExpression(localize("MARVEL_MULTIVERSE.Import.Button"))}`;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    importContent();
  });

  const target =
    root.querySelector(".header-actions") ?? root.querySelector(".directory-header .action-buttons") ?? root.querySelector("header");
  if (target) target.append(button);
  else root.prepend(button);
}

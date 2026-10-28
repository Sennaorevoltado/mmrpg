/**
 * Compatibilidade entre as versões 13 e 14 do Foundry.
 *
 * As fichas deste sistema usam a API antiga de janelas (ApplicationV1: ActorSheet e ItemSheet),
 * que o Foundry mantém na v13 e na v14, mas marca como obsoleta. Este arquivo concentra tudo o
 * que muda de uma versão para outra, para que o resto do código não precise saber a versão.
 */

/** Geração do Foundry em execução (13, 14...). Sem `game.release`, assume 14. */
export function foundryGeneration() {
  const generation = Number(globalThis.game?.release?.generation);
  return Number.isFinite(generation) && generation > 0 ? generation : 14;
}

/** Classes de ficha da API antiga (ApplicationV1), onde quer que a versão em uso as ponha. */
export function legacySheets() {
  return {
    ActorSheet: foundry.appv1?.sheets?.ActorSheet ?? globalThis.ActorSheet,
    ItemSheet: foundry.appv1?.sheets?.ItemSheet ?? globalThis.ItemSheet,
  };
}

/** Renderiza um template Handlebars. */
export function renderTemplate(path, data) {
  const fn = foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;
  return fn(path, data);
}

/** Pré-carrega templates Handlebars. */
export function loadTemplates(paths) {
  const fn = foundry.applications?.handlebars?.loadTemplates ?? globalThis.loadTemplates;
  return fn(paths);
}

/**
 * O Foundry entrega o HTML de uma janela antiga como jQuery ou como elemento, dependendo da
 * versão. O sistema trabalha só com elementos do DOM.
 *
 * @param {HTMLElement|{0: HTMLElement}} html
 * @returns {HTMLElement}
 */
export function rootOf(html) {
  if (html instanceof HTMLElement) return html;
  return html?.[0] ?? html;
}

/** Registra um Handlebars helper apenas se o núcleo ainda não o tiver. */
export function registerHelperIfMissing(name, fn) {
  if (typeof Handlebars === "undefined") return;
  if (Handlebars.helpers?.[name]) return;
  Handlebars.registerHelper(name, fn);
}

/**
 * Registra uma ficha de documento de forma compatível com a v13 e a v14.
 *
 * @param {"Actor"|"Item"} documentName
 * @param {string} scope
 * @param {Function} sheetClass
 * @param {object} options
 */
export function registerDocumentSheet(documentName, scope, sheetClass, options) {
  const collections = foundry.documents.collections;
  const collection = documentName === "Actor" ? collections.Actors : collections.Items;
  const DocumentSheetConfig = foundry.applications.apps?.DocumentSheetConfig;
  const documentClass = documentName === "Actor" ? globalThis.Actor : globalThis.Item;

  const hasConfig = typeof DocumentSheetConfig?.registerSheet === "function";
  const hasCollection = typeof collection?.registerSheet === "function";
  const viaConfig = () => DocumentSheetConfig.registerSheet(documentClass, scope, sheetClass, options);
  const viaCollection = () => collection.registerSheet(scope, sheetClass, options);

  // Cada versão prefere um caminho; se ele não existir, tenta o outro.
  if (foundryGeneration() < 14 && hasConfig) return viaConfig();
  if (hasCollection) return viaCollection();
  if (hasConfig) return viaConfig();
  throw new Error("mmrpg | não achei como registrar fichas nesta versão do Foundry.");
}

/**
 * Tira as fichas padrão do núcleo. Tenta a antiga e a nova, sem falhar se alguma não existir.
 */
export function unregisterCoreSheets(documentName) {
  const collections = foundry.documents.collections;
  const collection = documentName === "Actor" ? collections.Actors : collections.Items;
  const DocumentSheetConfig = foundry.applications.apps?.DocumentSheetConfig;
  const documentClass = documentName === "Actor" ? globalThis.Actor : globalThis.Item;
  const legacy = documentName === "Actor" ? foundry.appv1?.sheets?.ActorSheet : foundry.appv1?.sheets?.ItemSheet;
  const modern = documentName === "Actor"
    ? foundry.applications.sheets?.ActorSheetV2
    : foundry.applications.sheets?.ItemSheetV2;

  for (const sheetClass of [legacy, modern]) {
    if (!sheetClass) continue;
    try {
      if (foundryGeneration() < 14 && typeof DocumentSheetConfig?.unregisterSheet === "function") {
        DocumentSheetConfig.unregisterSheet(documentClass, "core", sheetClass);
      } else {
        collection.unregisterSheet("core", sheetClass);
      }
    } catch (err) {
      console.debug(`mmrpg | não foi possível retirar a ficha padrão (${sheetClass.name}):`, err);
    }
  }
}

/**
 * Pergunta "sim ou não" ao usuário. A v13 e a v14 trazem o DialogV2; antes dele existia só o Dialog.
 *
 * @param {object} options
 * @param {string} options.title
 * @param {string} options.content   HTML já escapado
 * @returns {Promise<boolean>}
 */
export async function confirmDialog({ title, content }) {
  const DialogV2 = foundry.applications?.api?.DialogV2;
  const body = `<p>${content}</p>`;
  if (typeof DialogV2?.confirm === "function") {
    return Boolean(await DialogV2.confirm({ window: { title }, content: body, rejectClose: false, modal: true }));
  }
  return Boolean(await globalThis.Dialog.confirm({ title, content: body }));
}

/** Modos numéricos do Foundry equivalentes aos tipos de alteração de um Active Effect. */
const CHANGE_MODES = { multiply: 1, add: 2, downgrade: 3, upgrade: 4, override: 5 };

/**
 * Dados de uma alteração de Active Effect com o tipo (v14) e o modo numérico (v13) juntos.
 * O Foundry ignora o campo que a sua versão não usa.
 *
 * @param {{key: string, type?: string, mode?: number, value: *, priority?: number|null}} change
 * @returns {{key: string, type: string, mode: number, value: string, priority: number|null}}
 */
export function changeData(change) {
  const type = changeTypeOf(change);
  const priority = change.priority === null || change.priority === undefined || change.priority === "" ? null : Number(change.priority);
  return {
    key: change.key,
    type,
    mode: CHANGE_MODES[type],
    value: String(change.value),
    priority: Number.isFinite(priority) ? Math.trunc(priority) : null,
  };
}

/** Tipo de alteração (add, multiply...) de uma alteração do Foundry, em qualquer versão. */
export function changeTypeOf(change) {
  if (typeof change.type === "string" && change.type in CHANGE_MODES) return change.type;
  const found = Object.entries(CHANGE_MODES).find(([, mode]) => mode === Number(change.mode));
  return found ? found[0] : "add";
}

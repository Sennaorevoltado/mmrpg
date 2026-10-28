/**
 * Compatibilidade entre as versões 13 e 14 do Foundry.
 *
 * O sistema foi escrito para a v14. Este arquivo concentra as diferenças de API que o
 * suporte (experimental) à v13 exige, para que o resto do código não precise saber a versão.
 *
 * Diferença tratada aqui: o registro de fichas. Na v13 usa-se DocumentSheetConfig e a ficha
 * padrão do núcleo é a antiga (AppV1); na v14 usa-se a coleção e a ficha padrão é a ApplicationV2.
 */

/** Geração do Foundry em execução (13, 14...). Sem `game.release`, assume 14. */
export function foundryGeneration() {
  const generation = Number(globalThis.game?.release?.generation);
  return Number.isFinite(generation) && generation > 0 ? generation : 14;
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

  if (foundryGeneration() < 14 && typeof DocumentSheetConfig?.registerSheet === "function") {
    DocumentSheetConfig.registerSheet(documentClass, scope, sheetClass, options);
    return;
  }
  collection.registerSheet(scope, sheetClass, options);
}

/**
 * Tira as fichas padrão do núcleo. Na v13 a ficha padrão é a antiga (AppV1);
 * na v14 é a ActorSheetV2/ItemSheetV2. Tenta as duas, sem falhar se alguma não existir.
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

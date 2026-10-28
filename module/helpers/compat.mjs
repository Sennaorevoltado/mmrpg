/**
 * Compatibilidade entre as versões 13 e 14 do Foundry.
 *
 * O sistema foi escrito para a v14. Este arquivo concentra as diferenças de API que o
 * suporte (experimental) à v13 exige, para que o resto do código não precise saber a versão.
 *
 * Diferenças tratadas aqui:
 *  - Modo de mensagem do chat: v13 usa "rollMode" (publicroll, gmroll, blindroll, selfroll);
 *    v14 usa "messageMode" (public, gm, blind, self, ic). Internamente o sistema usa os nomes da v14.
 *  - Registro de fichas: v13 usa DocumentSheetConfig e a ficha padrão do núcleo é a antiga (AppV1).
 */

/** Geração do Foundry em execução (13, 14...). Sem `game.release`, assume 14. */
export function foundryGeneration() {
  const generation = Number(globalThis.game?.release?.generation);
  return Number.isFinite(generation) && generation > 0 ? generation : 14;
}

/** True quando a API de modo de mensagem é a da v14 (messageMode). */
export function usesMessageModes() {
  return foundryGeneration() >= 14;
}

/** Nomes da v14 -> nomes da v13. */
const TO_ROLL_MODE = {
  public: "publicroll",
  gm: "gmroll",
  blind: "blindroll",
  self: "selfroll"
};

/** Nomes da v13 -> nomes da v14. */
const FROM_ROLL_MODE = Object.fromEntries(Object.entries(TO_ROLL_MODE).map(([k, v]) => [v, k]));

/** Rótulos usados quando o núcleo não oferece a lista (apenas reserva). */
const FALLBACK_LABELS = {
  public: "CHAT.RollPublic",
  gm: "CHAT.RollPrivate",
  blind: "CHAT.RollBlind",
  self: "CHAT.RollSelf"
};

/** Converte qualquer nome de modo (v13 ou v14) para o nome interno (v14). */
export function normalizeMessageMode(mode) {
  if (!mode) return "public";
  if (mode in TO_ROLL_MODE) return mode;
  return FROM_ROLL_MODE[mode] ?? "public";
}

/** Modo de mensagem escolhido nas configurações do usuário, em nomes internos. */
export function userMessageMode() {
  const key = usesMessageModes() ? "messageMode" : "rollMode";
  try {
    if (game.settings.settings.has(`core.${key}`)) {
      const mode = normalizeMessageMode(game.settings.get("core", key));
      return mode === "ic" ? "public" : mode;
    }
  } catch (err) {
    /* usa o padrão */
  }
  return "public";
}

/**
 * Lista de modos disponíveis: [{ value, label }], com value em nomes internos.
 * Na v14 lê CONFIG.ChatMessage.modes; na v13 lê CONFIG.Dice.rollModes.
 */
export function messageModeList() {
  const localize = (label) => game.i18n.localize(label);
  const result = [];

  if (usesMessageModes()) {
    const modes = CONFIG.ChatMessage?.modes;
    if (modes && Object.keys(modes).length) {
      for (const [key, value] of Object.entries(modes)) {
        if (key === "ic") continue;
        result.push({ value: key, label: localize(typeof value === "string" ? value : (value?.label ?? key)) });
      }
      return result;
    }
  } else {
    const modes = CONFIG.Dice?.rollModes;
    if (modes && Object.keys(modes).length) {
      for (const [key, value] of Object.entries(modes)) {
        const internal = FROM_ROLL_MODE[key];
        if (!internal) continue;
        result.push({ value: internal, label: localize(typeof value === "string" ? value : (value?.label ?? key)) });
      }
      if (result.length) return result;
    }
  }

  return Object.entries(FALLBACK_LABELS).map(([value, label]) => ({ value, label: localize(label) }));
}

/** Aplica o modo (nomes internos) aos dados de uma mensagem, à maneira da v13. */
function applyRollModeV13(data, mode) {
  const rollMode = TO_ROLL_MODE[mode] ?? "publicroll";
  if (typeof ChatMessage.applyRollMode === "function") {
    ChatMessage.applyRollMode(data, rollMode);
    return data;
  }
  // Reserva: reproduz o que o núcleo faz.
  const gmIds = () => ChatMessage.getWhisperRecipients("GM").map((u) => u.id);
  if (rollMode === "publicroll") {
    data.whisper = [];
    data.blind = false;
  } else if (rollMode === "gmroll") {
    data.whisper = gmIds();
    data.blind = false;
  } else if (rollMode === "blindroll") {
    data.whisper = gmIds();
    data.blind = true;
  } else if (rollMode === "selfroll") {
    data.whisper = [game.user.id];
    data.blind = false;
  }
  return data;
}

/**
 * Cria uma mensagem de chat respeitando o modo de visibilidade escolhido.
 *
 * @param {object} data       Dados da mensagem.
 * @param {string} [mode]     Modo, em nomes internos (public, gm, blind, self). Padrão: o do usuário.
 */
export async function createChatMessage(data, mode) {
  const chosen = normalizeMessageMode(mode ?? userMessageMode());
  if (usesMessageModes()) return ChatMessage.create(data, { messageMode: chosen });
  return ChatMessage.create(applyRollModeV13({ ...data }, chosen));
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

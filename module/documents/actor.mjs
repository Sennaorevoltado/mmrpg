/**
 * Documento Actor do sistema.
 */

import { MMRPG } from "../config.mjs";
import { damagePool, healPool, toInt } from "../rules/index.mjs";
import { changeData } from "../helpers/compat.mjs";

export default class MMRPGActor extends Actor {
  /* -------------------------------------------- */
  /*  Criação                                     */
  /* -------------------------------------------- */

  /** @inheritdoc */
  async _preCreate(data, options, user) {
    if ((await super._preCreate(data, options, user)) === false) return false;

    const token = {
      displayName: CONST.TOKEN_DISPLAY_MODES.OWNER,
      displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER,
      bar1: { attribute: "health" },
      bar2: { attribute: "focus" }
    };
    if (this.type === "character") {
      token.actorLink = true;
      token.disposition = CONST.TOKEN_DISPOSITIONS.FRIENDLY;
      token.sight = { enabled: true };
    } else {
      token.disposition = CONST.TOKEN_DISPOSITIONS.HOSTILE;
    }
    this.updateSource({ prototypeToken: foundry.utils.mergeObject(token, data.prototypeToken ?? {}, { inplace: false }) });
  }

  /**
   * Quando uma Origem ou Ocupação entra na ficha, cria também os itens que ela concede.
   * @inheritdoc
   */
  async _onCreateDescendantDocuments(parent, collection, documents, data, options, userId) {
    await super._onCreateDescendantDocuments(parent, collection, documents, data, options, userId);
    if (userId !== game.user.id || collection !== "items" || options?.mmrpgSkipGrants) return;
    for (const item of documents) {
      if (MMRPG.grantingItemTypes.includes(item.type)) await this.grantItems(item);
    }
  }

  /**
   * Cria na ficha os itens concedidos por uma Origem/Ocupação (ignora os que já existem pelo nome e tipo).
   * @param {Item} source
   * @returns {Promise<Item[]>}
   */
  async grantItems(source) {
    const grants = source.system.grants ?? [];
    const toCreate = [];
    for (const grant of grants) {
      if (!grant.uuid) continue;
      const doc = await fromUuid(grant.uuid);
      if (!doc || !MMRPG.grantableItemTypes.includes(doc.type)) continue;
      const note = (grant.note ?? "").trim();
      const finalName = note ? `${doc.name}: ${note}` : doc.name;
      const exists = this.items.some((i) => i.type === doc.type && i.name === finalName);
      if (exists) continue;
      const obj = doc.toObject();
      delete obj._id;
      obj.name = finalName;
      foundry.utils.setProperty(obj, "flags.mmrpg.grantedBy", source.id);
      toCreate.push(obj);
    }
    if (!toCreate.length) return [];
    return this.createEmbeddedDocuments("Item", toCreate, { mmrpgSkipGrants: true });
  }

  /* -------------------------------------------- */
  /*  Consultas                                   */
  /* -------------------------------------------- */

  /** Itens do ator por tipo. */
  itemsOfType(type) {
    return this.items.filter((i) => i.type === type);
  }

  /** Primeiro token ativo deste ator na cena atual. */
  get activeToken() {
    return this.getActiveTokens(true)[0] ?? null;
  }

  /* -------------------------------------------- */
  /*  Recursos                                    */
  /* -------------------------------------------- */

  /**
   * Recursos disponíveis para pagar um custo?
   * @param {{ focus?: number, karma?: number, health?: number }} cost
   * @returns {string|null} Nome do recurso insuficiente, ou null se está tudo certo.
   */
  missingResource(cost) {
    for (const key of ["focus", "karma", "health"]) {
      const needed = toInt(cost?.[key]);
      if (needed > 0 && toInt(this.system[key].value) < needed) return key;
    }
    return null;
  }

  /**
   * Desconta um custo dos recursos.
   * @param {{ focus?: number, karma?: number, health?: number }} cost
   */
  async spend(cost) {
    const update = {};
    for (const key of ["focus", "karma", "health"]) {
      const needed = toInt(cost?.[key]);
      if (needed > 0) update[`system.${key}.value`] = toInt(this.system[key].value) - needed;
    }
    if (Object.keys(update).length) await this.update(update);
  }

  /**
   * Aplica dano.
   * @param {number} amount
   * @param {"health"|"focus"} [resource="health"]
   * @returns {Promise<{ resource: string, before: number, after: number }>}
   */
  async applyDamage(amount, resource = "health") {
    const key = resource === "focus" ? "focus" : "health";
    const pool = this.system[key];
    const before = toInt(pool.value);
    const after = damagePool(pool, amount);
    await this.update({ [`system.${key}.value`]: after });
    return { resource: key, before, after };
  }

  /**
   * Aplica cura (sem passar do máximo; o Karma só sobe até o máximo, se houver).
   * @param {number} amount
   * @param {"health"|"focus"|"karma"} [resource="health"]
   * @returns {Promise<{ resource: string, before: number, after: number }>}
   */
  async applyHealing(amount, resource = "health") {
    const key = ["focus", "karma"].includes(resource) ? resource : "health";
    const pool = this.system[key];
    const before = toInt(pool.value);
    const after = healPool(pool, amount);
    await this.update({ [`system.${key}.value`]: after });
    return { resource: key, before, after };
  }

  /* -------------------------------------------- */
  /*  Efeitos                                     */
  /* -------------------------------------------- */

  /**
   * Aplica ao ator o efeito definido numa ação: uma condição e/ou modificações de Active Effect.
   * A expiração em rodadas é controlada pelo próprio sistema (ver helpers/combat.mjs).
   *
   * @param {object} def                       Dados do efeito (ver data/action.mjs).
   * @param {object} [context]
   * @param {string} [context.origin]          UUID da origem.
   * @param {string} [context.label]           Nome padrão.
   * @returns {Promise<ActiveEffect|null>}
   */
  async applyActionEffect(def, { origin = null, label = "" } = {}) {
    const combat = game.combat;
    const flags = { mmrpg: { effectId: def.id } };
    if (def.rounds > 0 && combat?.started) {
      flags.mmrpg.expires = { combat: combat.id, round: combat.round + toInt(def.rounds) };
    }

    const changes = (def.changes ?? [])
      .filter((c) => c.key)
      .map((c) => changeData(c));

    // Já existe um efeito igual vindo desta ação? Renova em vez de duplicar.
    const existing = this.effects.find((e) => e.getFlag("mmrpg", "effectId") === def.id && e.origin === origin);
    if (existing) await existing.delete();

    let data;
    if (def.status) {
      const status = CONFIG.statusEffects.find((s) => s.id === def.status);
      data = {
        name: game.i18n.localize(status?.name ?? `MMRPG.Status.${def.status}`),
        img: status?.img ?? "icons/svg/aura.svg",
        statuses: [def.status]
      };
    } else if (changes.length) {
      data = { name: def.name || label || game.i18n.localize("MMRPG.Effect.generic"), img: "icons/svg/aura.svg" };
    } else {
      return null;
    }

    data = {
      ...data,
      origin,
      changes,
      flags,
      description: def.note || "",
      duration: def.rounds > 0 ? { rounds: toInt(def.rounds) } : {}
    };
    const [created] = await this.createEmbeddedDocuments("ActiveEffect", [data]);
    return created ?? null;
  }
}


/**
 * Documento Actor do sistema.
 */

import { MMRPG } from "../config.mjs";
import { damagePool, healPool, toInt, carryPoolValue, formChanges } from "../rules/index.mjs";
import { changeData, createChatMessage } from "../helpers/compat.mjs";

/** Escapa texto para HTML (nomes de personagens e formas vão para o chat). */
const escapeHtml = (text) =>
  String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

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
   * Dados dos itens concedidos por uma origem, ocupação ou forma que ainda não estão na ficha
   * (ignora os que já existem pelo nome e tipo).
   * @param {Item} source
   * @returns {Promise<object[]>}
   */
  async #newGrantData(source) {
    const grants = source.system.grants ?? [];
    const toCreate = [];
    for (const grant of grants) {
      if (!grant.uuid) continue;
      const doc = await fromUuid(grant.uuid);
      if (!doc || !MMRPG.grantableItemTypes.includes(doc.type)) continue;
      const note = (grant.note ?? "").trim();
      const finalName = note ? `${doc.name}: ${note}` : doc.name;
      const exists =
        this.items.some((i) => i.type === doc.type && i.name === finalName) ||
        toCreate.some((o) => o.type === doc.type && o.name === finalName);
      if (exists) continue;
      const obj = doc.toObject();
      delete obj._id;
      obj.name = finalName;
      foundry.utils.setProperty(obj, "flags.mmrpg.grantedBy", source.id);
      toCreate.push(obj);
    }
    return toCreate;
  }

  /**
   * Cria na ficha os itens concedidos por uma Origem/Ocupação (ignora os que já existem pelo nome e tipo).
   * @param {Item} source
   * @returns {Promise<Item[]>}
   */
  async grantItems(source) {
    const toCreate = await this.#newGrantData(source);
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
  /*  Formas                                      */
  /* -------------------------------------------- */

  /** Fila que impede duas trocas de forma ao mesmo tempo no mesmo personagem. */
  #formQueue = Promise.resolve();

  /** Formas (armaduras, transformações, formas alternativas) da ficha. */
  get forms() {
    return this.items.filter((i) => i.type === "form");
  }

  /** Formas ativas, da mais antiga para a mais recente. */
  get activeForms() {
    return this.forms.filter((f) => f.system.active).sort((a, b) => a.system.activatedAt - b.system.activatedAt);
  }

  /**
   * Liga ou desliga uma forma.
   *
   * Ativar: desliga a forma ativa da mesma categoria, cria o efeito com as alterações da forma,
   * cria os itens concedidos e, se a forma pedir, troca as imagens. O dano sofrido acompanha o corpo
   * quando Saúde ou Foco máximos mudam. Desativar desfaz tudo.
   *
   * @param {Item|string} form                 A forma, o id ou o nome dela.
   * @param {boolean} active
   * @param {object} [options]
   * @param {boolean} [options.announce=true]  Posta a troca no chat (se a configuração permitir).
   * @returns {Promise<boolean>}               Verdadeiro se algo mudou.
   */
  setFormActive(form, active, options = {}) {
    const run = this.#formQueue.then(() => this.#applyForm(form, !!active, options));
    this.#formQueue = run.catch(() => {});
    return run;
  }

  /** Desliga e liga de novo uma forma ativa (para refletir mudanças feitas nela). */
  refreshForm(form) {
    const run = this.#formQueue.then(async () => {
      const item = this.#findForm(form);
      if (!item?.system.active) return false;
      const stamp = item.system.activatedAt;
      await this.#applyForm(item, false, { announce: false });
      await this.#applyForm(item, true, { announce: false, activatedAt: stamp });
      return true;
    });
    this.#formQueue = run.catch(() => {});
    return run;
  }

  #findForm(form) {
    const item = typeof form === "string" ? (this.items.get(form) ?? this.forms.find((f) => f.name === form)) : form;
    return item && item.type === "form" && item.parent === this ? item : null;
  }

  async #applyForm(form, active, { announce = true, activatedAt = null } = {}) {
    const item = this.#findForm(form);
    if (!item || item.system.active === active) return false;

    // Só uma forma de cada categoria por vez.
    if (active) {
      for (const other of this.forms) {
        if (other.id !== item.id && other.system.active && other.system.kind === item.system.kind) {
          await this.#applyForm(other, false, { announce: false });
        }
      }
    }

    const before = { health: { ...this.#poolOf("health") }, focus: { ...this.#poolOf("focus") } };
    const rankBefore = toInt(this.system.rank);

    await this.#removeFormEffect(item);
    const removed = await this.#removeFormGrants(item);
    await item.update({ "system.active": active, "system.activatedAt": active ? (activatedAt ?? Date.now()) : 0 });

    let granted = [];
    if (active) {
      await this.#createFormEffect(item);
      granted = await this.#createFormGrants(item);
    } else {
      // Uma forma que continua ativa pode depender de algo que acabou de sair.
      for (const other of this.activeForms) await this.#createFormGrants(other);
    }

    await this.#carryPools(item, before);
    await this.#syncFormImages();

    if (announce) await this.#announceForm(item, active, { rankBefore, granted: active ? granted : removed });
    return true;
  }

  #poolOf(key) {
    return { value: toInt(this.system[key].value), max: toInt(this.system[key].max) };
  }

  /** Ajusta Saúde e Foco atuais depois que os máximos mudaram. */
  async #carryPools(form, before) {
    const update = {};
    for (const key of ["health", "focus"]) {
      const after = this.#poolOf(key);
      const value = carryPoolValue(before[key].value, before[key].max, after.max, form.system.carryDamage);
      if (value !== after.value) update[`system.${key}.value`] = value;
    }
    if (Object.keys(update).length) await this.update(update);
  }

  /** O efeito do ator com as alterações da forma. */
  async #createFormEffect(form) {
    const changes = formChanges(form.system).map((c) => changeData(c));
    if (!changes.length) return null;
    const [effect] = await this.createEmbeddedDocuments("ActiveEffect", [
      { name: form.name, img: form.img, origin: form.uuid, changes, flags: { [MMRPG.id]: { formId: form.id } } }
    ]);
    return effect ?? null;
  }

  async #removeFormEffect(form) {
    const ids = this.effects.filter((e) => e.getFlag(MMRPG.id, "formId") === form.id).map((e) => e.id);
    if (ids.length) await this.deleteEmbeddedDocuments("ActiveEffect", ids);
  }

  /** Cria os itens concedidos pela forma. Devolve os nomes. */
  async #createFormGrants(form) {
    const toCreate = await this.#newGrantData(form);
    if (!toCreate.length) return [];
    const created = await this.createEmbeddedDocuments("Item", toCreate, { mmrpgSkipGrants: true });
    return created.map((i) => i.name);
  }

  /** Remove os itens concedidos pela forma. Devolve os nomes. */
  async #removeFormGrants(form) {
    const items = this.items.filter((i) => i.getFlag(MMRPG.id, "grantedBy") === form.id);
    if (items.length) await this.deleteEmbeddedDocuments("Item", items.map((i) => i.id));
    return items.map((i) => i.name);
  }

  /**
   * Imagem da ficha e do token: vale a da forma ativa mais recente que tiver uma; sem nenhuma,
   * volta ao original (guardado na primeira troca).
   */
  async #syncFormImages() {
    const active = this.activeForms;
    const portrait = active.filter((f) => f.system.portrait).at(-1)?.system.portrait ?? "";
    const token = active.filter((f) => f.system.token).at(-1)?.system.token ?? "";
    let base = this.getFlag(MMRPG.id, "formBase");
    if (!portrait && !token && !base) return;

    try {
      if (!base) {
        base = { img: this.img ?? "", token: this.prototypeToken?.texture?.src ?? "" };
        await this.setFlag(MMRPG.id, "formBase", base);
      }
      const wantImg = portrait || base.img;
      const wantToken = token || base.token;
      const update = {};
      if (wantImg && wantImg !== this.img) update.img = wantImg;
      if (wantToken && wantToken !== this.prototypeToken?.texture?.src) update["prototypeToken.texture.src"] = wantToken;
      if (Object.keys(update).length) await this.update(update);
      if (wantToken) {
        for (const tokenDoc of this.getActiveTokens(false, true)) {
          if (tokenDoc.texture?.src !== wantToken) await tokenDoc.update({ "texture.src": wantToken });
        }
      }
      if (!portrait && !token) await this.unsetFlag(MMRPG.id, "formBase");
    } catch (err) {
      console.warn(`${MMRPG.id} | não foi possível trocar as imagens da forma`, err);
    }
  }

  /** Mensagem no chat com a troca de forma. */
  async #announceForm(form, active, { rankBefore, granted }) {
    if (!game.settings.get(MMRPG.id, "announceForms")) return;
    const kind = game.i18n.localize(MMRPG.formKinds[form.system.kind]);
    const key = active ? "MMRPG.Form.announceOn" : "MMRPG.Form.announceOff";
    const lines = [
      `<p>${game.i18n.format(key, { actor: `<strong>${escapeHtml(this.name)}</strong>`, form: `<em>${escapeHtml(form.name)}</em>`, kind })}</p>`
    ];
    const rankAfter = toInt(this.system.rank);
    if (rankAfter !== rankBefore) {
      lines.push(`<p>${game.i18n.format("MMRPG.Form.announceRank", { from: rankBefore, to: rankAfter })}</p>`);
    }
    if (granted.length) {
      const label = game.i18n.localize(active ? "MMRPG.Form.announceGrants" : "MMRPG.Form.announceRemoved");
      lines.push(`<p>${label} ${granted.map(escapeHtml).join(", ")}</p>`);
    }
    await createChatMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="mmrpg-form-card">${lines.join("")}</div>`,
      flags: { [MMRPG.id]: { form: form.id } }
    });
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


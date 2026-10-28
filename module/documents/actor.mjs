import { changeData } from "../helpers/compat.mjs";
import { carryPoolValue, formChanges, toInt } from "../helpers/forms.mjs";
import { GRANT_FIELDS, grantItemData } from "../helpers/grants.mjs";

const SCOPE = "mmrpg";
const localize = (key) => game.i18n.localize(key);
const esc = (text) => Handlebars.escapeExpression(String(text ?? ""));

/**
 * Ator do sistema: dados de rolagem, iniciativa, a rolagem d616 de atributo e as formas.
 * @extends {Actor}
 */
export class MarvelMultiverseActor extends Actor {
  /** Uma troca de forma por vez por personagem (as trocas esperam na fila). */
  #formQueue = Promise.resolve();

  /**
   * Dados usados nas fórmulas de rolagem.
   *
   * Os atributos ficam também na raiz, para fórmulas como `@mle.value + 4`.
   * @override
   */
  getRollData() {
    const data = {};

    if (this.system.abilities) {
      for (const [k, v] of Object.entries(this.system.abilities)) {
        data[k] = foundry.utils.deepClone(v);
      }
    }

    data.rank = this.system.attributes?.rank?.value;

    return { ...super.getRollData(), ...data };
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async rollInitiative(options = {}) {
    return super.rollInitiative(options);
  }

  /**
   * Rolagem de iniciativa, ainda sem resultado.
   * @param {object} [options]  Opções da rolagem
   * @returns {MarvelMultiverseRoll}
   */
  getInitiativeRoll(options = {}) {
    if (this._cachedInitiativeRoll) return this._cachedInitiativeRoll.clone();
    return new CONFIG.Dice.MarvelMultiverseRoll("{1d6,1dm,1d6}", this.getRollData(), options);
  }

  /* -------------------------------------------- */

  /**
   * Rola d616 + o valor de um atributo e manda para o chat.
   *
   * @param {string} abilityKey                 mle, agl, res, vig, ego ou log
   * @param {object} [options]
   * @param {"ability"|"noncom"} [options.kind]  Teste de atributo (padrão) ou fora de combate
   * @param {Item} [options.item]               Poder, arma ou item que originou a rolagem
   * @param {string} [options.damageType]       health ou focus, para o botão de dano
   * @param {string} [options.formula]          Dados da rolagem (padrão: {1d6,1dm,1d6})
   * @returns {Promise<MarvelMultiverseRoll|null>}
   */
  async rollAbility(abilityKey, { kind = "ability", item = null, damageType = "", formula = "{1d6,1dm,1d6}" } = {}) {
    const config = CONFIG.MARVEL_MULTIVERSE;
    if (!(abilityKey in config.abilities)) {
      ui.notifications.warn(game.i18n.localize("MARVEL_MULTIVERSE.Warn.noAbility"));
      return null;
    }

    const field = kind === "noncom" ? "noncom" : "value";
    const roll = new CONFIG.Dice.MarvelMultiverseRoll(
      `${formula || "{1d6,1dm,1d6}"}+@abilities.${abilityKey}.${field}`,
      this.getRollData()
    );

    const esc = (text) => Handlebars.escapeExpression(String(text ?? ""));
    const parts = [esc(game.i18n.localize(config.abilities[abilityKey]))];
    if (kind === "noncom") parts.push(esc(game.i18n.localize("MARVEL_MULTIVERSE.NonCombat")));
    if (item) parts.push(`${esc(game.i18n.localize(`TYPES.Item.${item.type}`))}: ${esc(item.name)}`);
    if (damageType in config.damageTypes) {
      parts.push(`${esc(game.i18n.localize("MARVEL_MULTIVERSE.DamageType"))}: ${esc(game.i18n.localize(config.damageTypes[damageType]))}`);
    }

    const rollMode = game.settings.get("core", "rollMode");
    await roll.toMessage(
      {
        speaker: ChatMessage.getSpeaker({ actor: this }),
        flavor: parts.join(" &middot; "),
      },
      {
        rollMode,
        flags: { ability: abilityKey, kind, damageType, itemId: item?.id ?? null },
      }
    );
    return roll;
  }

  /* -------------------------------------------- */
  /*  Formas                                      */
  /* -------------------------------------------- */

  /** Todas as formas do personagem (armaduras, formas alternativas e transformações). */
  get forms() {
    return this.items.filter((i) => i.type === "form");
  }

  /** As formas ligadas agora, da mais antiga para a mais recente. */
  get activeForms() {
    return this.forms.filter((f) => f.system.active).sort((a, b) => a.system.activatedAt - b.system.activatedAt);
  }

  /**
   * Liga ou desliga uma forma. Só uma forma de cada categoria fica ativa por vez: ligar uma desliga
   * a outra da mesma categoria. Ao ligar, cria o efeito com as alterações da forma e os itens que
   * ela concede; ao desligar, tira tudo isso.
   *
   * @param {Item|string} form                    A forma, o id ou o nome
   * @param {boolean} active
   * @param {object} [options]
   * @param {boolean} [options.announce=true]     Avisar no chat (se a configuração permitir)
   * @returns {Promise<boolean>}                  Verdadeiro se algo mudou
   */
  setFormActive(form, active, options = {}) {
    const run = this.#formQueue.then(() => this.#applyForm(form, !!active, options));
    this.#formQueue = run.catch(() => {});
    return run;
  }

  /** Desliga e liga de novo uma forma ativa (para refletir o que mudou na ficha dela). */
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

    const before = { health: this.#poolOf("health"), focus: this.#poolOf("focus") };
    const rankBefore = toInt(this.system.attributes?.rank?.value);

    await this.#removeFormEffect(item);
    const removed = await this.#removeFormGrants(item);
    await item.update({ "system.active": active, "system.activatedAt": active ? (activatedAt ?? Date.now()) : 0 }, { mmrpgSkipRefresh: true });

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
    return { value: toInt(this.system[key]?.value), max: toInt(this.system[key]?.max) };
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

  /** O efeito do ator com as alterações da forma (um só, ligado à forma por flag). */
  async #createFormEffect(form) {
    const changes = formChanges(form.system).map(changeData);
    if (!changes.length) return null;
    const [effect] = await this.createEmbeddedDocuments("ActiveEffect", [
      { name: form.name, img: form.img, origin: form.uuid, changes, flags: { [SCOPE]: { formId: form.id } } },
    ]);
    return effect ?? null;
  }

  async #removeFormEffect(form) {
    const ids = this.effects.filter((e) => e.getFlag(SCOPE, "formId") === form.id).map((e) => e.id);
    if (ids.length) await this.deleteEmbeddedDocuments("ActiveEffect", ids);
  }

  /** Dados dos itens que a forma ainda precisa criar (o que o personagem já tem fica como está). */
  #newGrantData(form) {
    const have = new Set(this.items.map((i) => `${i.type}:${i.name.toLowerCase()}`));
    const out = [];
    for (const [type, field] of Object.entries(GRANT_FIELDS)) {
      for (const entry of form.system[field] ?? []) {
        const data = grantItemData(entry, type, { defaultElement: this.system.defaultElement });
        if (!data) continue;
        const key = `${type}:${data.name.toLowerCase()}`;
        if (have.has(key) && !data.system.multiple) continue;
        have.add(key);
        foundry.utils.setProperty(data, `flags.${SCOPE}.grantedBy`, form.id);
        out.push(data);
      }
    }
    return out;
  }

  /** Cria os itens concedidos pela forma. Devolve os nomes. */
  async #createFormGrants(form) {
    const toCreate = this.#newGrantData(form);
    if (!toCreate.length) return [];
    const created = await this.createEmbeddedDocuments("Item", toCreate);
    return created.map((i) => i.name);
  }

  /** Remove os itens concedidos pela forma. Devolve os nomes. */
  async #removeFormGrants(form) {
    const items = this.items.filter((i) => i.getFlag(SCOPE, "grantedBy") === form.id);
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
    let base = this.getFlag(SCOPE, "formBase");
    if (!portrait && !token && !base) return;

    try {
      if (!base) {
        base = { img: this.img ?? "", token: this.prototypeToken?.texture?.src ?? "" };
        await this.setFlag(SCOPE, "formBase", base);
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
      if (!portrait && !token) await this.unsetFlag(SCOPE, "formBase");
    } catch (err) {
      console.warn(`${SCOPE} | não foi possível trocar as imagens da forma`, err);
    }
  }

  /** Mensagem no chat com a troca de forma. */
  async #announceForm(form, active, { rankBefore, granted }) {
    let enabled = true;
    try {
      enabled = game.settings.get(SCOPE, "announceForms") !== false;
    } catch (err) {
      // Configuração ainda não registrada: avisa como padrão.
    }
    if (!enabled) return;

    const kind = localize(`MARVEL_MULTIVERSE.Form.Kind.${form.system.kind}`);
    const key = active ? "MARVEL_MULTIVERSE.Form.AnnounceOn" : "MARVEL_MULTIVERSE.Form.AnnounceOff";
    const lines = [
      `<p>${game.i18n.format(key, { actor: `<strong>${esc(this.name)}</strong>`, form: `<em>${esc(form.name)}</em>`, kind: esc(kind) })}</p>`,
    ];
    const rankAfter = toInt(this.system.attributes?.rank?.value);
    if (rankAfter !== rankBefore) {
      lines.push(`<p>${game.i18n.format("MARVEL_MULTIVERSE.Form.AnnounceRank", { from: rankBefore, to: rankAfter })}</p>`);
    }
    if (granted.length) {
      const label = localize(active ? "MARVEL_MULTIVERSE.Form.AnnounceGrants" : "MARVEL_MULTIVERSE.Form.AnnounceRemoved");
      lines.push(`<p>${esc(label)} ${granted.map(esc).join(", ")}</p>`);
    }
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="mm-form-card">${lines.join("")}</div>`,
      flags: { [SCOPE]: { form: form.id } },
    });
  }
}

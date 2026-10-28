/**
 * Manobra de equipe: o custo em Focus é cobrado de cada integrante e um cartão vai para o chat.
 * O texto da regra de cada manobra não é distribuído com o sistema.
 */

import { MMRPG } from "../config.mjs";
import { toInt } from "../rules/index.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const loc = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

let instance = null;

export default class TeamManeuverApp extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: "mmrpg-team-maneuver",
    classes: ["mmrpg", "mmrpg-team"],
    tag: "form",
    position: { width: 460, height: "auto" },
    window: { title: "MMRPG.TeamManeuver.title", icon: "fa-solid fa-people-group" },
    form: { handler: TeamManeuverApp.#onChange, submitOnChange: true, closeOnSubmit: false },
    actions: { use: TeamManeuverApp.#onUse }
  };

  /** @override */
  static PARTS = {
    body: { template: `${MMRPG.path}/templates/apps/team-maneuver.hbs` }
  };

  #type = MMRPG.teamManeuvers.types[0];
  #level = 1;
  #origin = null;

  /** Abre a janela, partindo do ator que a chamou. */
  static open(actor) {
    instance ??= new TeamManeuverApp();
    instance.#origin = actor ?? null;
    if (actor?.system?.teamManeuver) {
      instance.#type = actor.system.teamManeuver.type || instance.#type;
      instance.#level = actor.system.teamManeuver.level || 1;
    }
    instance.render({ force: true });
    return instance;
  }

  /** @override */
  _onClose(options) {
    super._onClose?.(options);
    instance = null;
  }

  /** Integrantes: tokens selecionados; se não houver, o ator de origem. */
  #members() {
    const actors = new Map();
    for (const token of canvas?.tokens?.controlled ?? []) {
      if (token.actor?.system?.focus) actors.set(token.actor.uuid, token.actor);
    }
    if (!actors.size && this.#origin) actors.set(this.#origin.uuid, this.#origin);
    return [...actors.values()];
  }

  get #cost() {
    return MMRPG.teamManeuvers.levels.find((l) => l.level === this.#level)?.focusCost ?? 0;
  }

  /** @override */
  async _prepareContext() {
    const cost = this.#cost;
    return {
      type: this.#type,
      level: this.#level,
      cost,
      typeOptions: MMRPG.teamManeuvers.types.map((value) => ({ value, label: loc(`MMRPG.TeamManeuver.${value}.name`) })),
      levelOptions: MMRPG.teamManeuvers.levels.map((l) => ({
        value: l.level,
        label: loc("MMRPG.TeamManeuver.levelLabel", { level: l.level, cost: l.focusCost, min: l.rankAverage[0], max: l.rankAverage[1] })
      })),
      members: this.#members().map((a) => ({
        name: a.name,
        img: a.img,
        focus: a.system.focus.value,
        enough: toInt(a.system.focus.value) >= cost
      }))
    };
  }

  static #onChange(event, form, formData) {
    const data = foundry.utils.expandObject(formData.object);
    if (data.type) this.#type = data.type;
    if (data.level) this.#level = toInt(data.level);
    this.render();
  }

  static async #onUse() {
    const members = this.#members();
    const cost = this.#cost;
    if (!members.length) {
      ui.notifications.warn(loc("MMRPG.Warn.selectToken"));
      return;
    }
    const lacking = members.filter((a) => toInt(a.system.focus.value) < cost);
    if (lacking.length) {
      ui.notifications.warn(loc("MMRPG.TeamManeuver.lacking", { names: lacking.map((a) => a.name).join(", ") }));
      return;
    }
    const blocked = members.filter((a) => !a.isOwner);
    if (blocked.length) {
      ui.notifications.warn(loc("MMRPG.TeamManeuver.notOwner", { names: blocked.map((a) => a.name).join(", ") }));
      return;
    }
    for (const actor of members) await actor.spend({ focus: cost });

    const level = MMRPG.teamManeuvers.levels.find((l) => l.level === this.#level);
    const content = await foundry.applications.handlebars.renderTemplate(`${MMRPG.path}/templates/chat/team-card.hbs`, {
      name: loc(`MMRPG.TeamManeuver.${this.#type}.name`),
      level: this.#level,
      cost,
      rankMin: level.rankAverage[0],
      rankMax: level.rankAverage[1],
      members: members.map((a) => ({ name: a.name, img: a.img }))
    });
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.#origin ?? members[0] }), content });
    this.render();
  }
}

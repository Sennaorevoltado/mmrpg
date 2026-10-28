/**
 * Janela do Narrador para definir, por Rank, os pontos de atributo e o teto de cada atributo.
 */

import { MMRPG } from "../config.mjs";
import { DEFAULT_BUDGET, normalizeBudgetTable, parseBudgetForm } from "../rules/index.mjs";
import { getBudgetTable } from "../helpers/budget.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const loc = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

let instance = null;

export default class BudgetConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: "mmrpg-budget",
    classes: ["mmrpg", "mmrpg-budget"],
    tag: "form",
    position: { width: 440, height: "auto" },
    window: { title: "MMRPG.Budget.title", icon: "fa-solid fa-table-list", resizable: false },
    form: { handler: BudgetConfig.#onSubmit, closeOnSubmit: true },
    actions: { resetBudget: BudgetConfig.#onReset }
  };

  /** @override */
  static PARTS = {
    body: { template: `${MMRPG.path}/templates/apps/budget-config.hbs` }
  };

  /** Abre a janela (uma só; só o Narrador). */
  static open() {
    if (!game.user.isGM) {
      ui.notifications.warn(loc("MMRPG.Budget.gmOnly"));
      return null;
    }
    instance ??= new BudgetConfig();
    instance.render({ force: true });
    return instance;
  }

  /** @override */
  _onClose(options) {
    super._onClose?.(options);
    instance = null;
  }

  /** @override */
  async _prepareContext() {
    const table = getBudgetTable();
    return {
      rows: MMRPG.ranks.map((rank) => ({
        rank,
        points: table[rank].points ?? "",
        cap: table[rank].cap ?? ""
      }))
    };
  }

  static async #onSubmit(event, form, formData) {
    await game.settings.set(MMRPG.id, "budget", parseBudgetForm(formData.object));
  }

  static async #onReset() {
    await game.settings.set(MMRPG.id, "budget", normalizeBudgetTable(DEFAULT_BUDGET));
    return this.render();
  }
}

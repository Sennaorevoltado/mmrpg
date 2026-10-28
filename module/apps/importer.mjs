/**
 * Janela de importação e exportação de conteúdo (apenas GM).
 */

import { MMRPG } from "../config.mjs";
import { ITEM_TYPES, countByType, parseContent } from "../helpers/content-format.mjs";
import { DESTINATIONS, exportItems, exportPackItems, importItems } from "../helpers/importer.mjs";
import { existingPacks } from "../helpers/compendia.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const loc = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

let instance = null;

export default class ContentImporter extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: "mmrpg-importer",
    classes: ["mmrpg", "mmrpg-importer"],
    tag: "div",
    position: { width: 560, height: "auto" },
    window: { title: "MMRPG.Importer.title", icon: "fa-solid fa-file-import", resizable: true },
    actions: {
      runImport: ContentImporter.#onImport,
      runExport: ContentImporter.#onExport
    }
  };

  /** @override */
  static PARTS = {
    body: { template: `${MMRPG.path}/templates/apps/importer.hbs` }
  };

  /** Resultado da leitura do arquivo escolhido. */
  #parsed = null;
  #fileName = "";
  #report = null;

  /** Abre a janela (uma só). */
  static open() {
    if (!game.user.isGM) {
      ui.notifications.warn(loc("MMRPG.Warn.gmOnly"));
      return null;
    }
    instance ??= new ContentImporter();
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
    const counts = this.#parsed ? countByType(this.#parsed.items) : {};
    return {
      fileName: this.#fileName,
      parsed: this.#parsed,
      counts: Object.entries(counts).map(([type, count]) => ({ label: loc(`TYPES.Item.${type}`), count })),
      hasItems: !!this.#parsed?.items.length,
      report: this.#report,
      reportPacks: this.#report?.packs?.join(", ") ?? "",
      exportTypes: ITEM_TYPES.map((type) => ({ type, label: loc(`TYPES.Item.${type}`) })),
      destinationOptions: [
        { value: DESTINATIONS.compendia, label: loc("MMRPG.Importer.destPacks") },
        { value: DESTINATIONS.world, label: loc("MMRPG.Importer.destWorld") }
      ],
      exportFromOptions: [
        { value: DESTINATIONS.world, label: loc("MMRPG.Importer.fromWorld") },
        { value: DESTINATIONS.compendia, label: loc("MMRPG.Importer.fromPacks") }
      ],
      duplicateOptions: [
        { value: "skip", label: loc("MMRPG.Importer.dupSkip") },
        { value: "update", label: loc("MMRPG.Importer.dupUpdate") },
        { value: "duplicate", label: loc("MMRPG.Importer.dupCreate") }
      ]
    };
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    const input = this.element.querySelector("input[type=file]");
    input?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      this.#report = null;
      if (!file) {
        this.#parsed = null;
        this.#fileName = "";
      } else {
        this.#fileName = file.name;
        this.#parsed = parseContent(await file.text());
      }
      this.render();
    });
  }

  static async #onImport() {
    if (!this.#parsed?.items.length) return;
    const onDuplicate = this.element.querySelector("[name=onDuplicate]")?.value ?? "skip";
    const destination = this.element.querySelector("[name=destination]")?.value ?? DESTINATIONS.world;
    this.#report = await importItems(this.#parsed.items, { onDuplicate, destination });
    ui.notifications.info(
      loc("MMRPG.Importer.done", { created: this.#report.created, updated: this.#report.updated, skipped: this.#report.skipped })
    );
    this.render();
  }

  static async #onExport() {
    const types = [...this.element.querySelectorAll("[name=exportType]:checked")].map((el) => el.value);
    if (!types.length) {
      ui.notifications.warn(loc("MMRPG.Importer.pickTypes"));
      return;
    }
    const from = this.element.querySelector("[name=exportFrom]")?.value ?? DESTINATIONS.world;
    if (from === DESTINATIONS.compendia && !existingPacks(types).length) {
      ui.notifications.warn(loc("MMRPG.Importer.noPacks"));
      return;
    }
    const data =
      from === DESTINATIONS.compendia
        ? await exportPackItems(types, { source: game.world.title })
        : exportItems(types, { source: game.world.title });
    foundry.utils.saveDataToFile(JSON.stringify(data, null, 2), "application/json", "mmrpg-conteudo.json");
  }
}

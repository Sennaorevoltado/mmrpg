/**
 * Gera páginas HTML estáticas das fichas, com os modelos e o CSS reais do sistema, sobre um Foundry
 * simulado. Serve para olhar o resultado num navegador sem abrir o Foundry.
 *
 *   node tests/support/preview.mjs <pasta-de-saída> [--hostile]
 *
 * --hostile liga um CSS que imita (de forma exagerada) o CSS geral do Foundry.
 */
import fs from "node:fs";
import path from "node:path";
import { loadSystem } from "./load-system.mjs";
import { renderTemplate, ROOT, ChatMessage } from "./foundry-stub.mjs";

const out = path.resolve(process.argv[2] ?? "preview");
const hostile = process.argv.includes("--hostile");
fs.mkdirSync(out, { recursive: true });

const sys = await loadSystem();
const { MarvelMultiverseCharacterSheet, MarvelMultiverseNPCSheet, MarvelMultiverseItemSheet } = sys.sheets;

const avatar = (bg, fg) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="${bg}"/><circle cx="150" cy="115" r="58" fill="${fg}"/><rect x="60" y="190" width="180" height="110" rx="30" fill="${fg}"/></svg>`
  );

const power = (name, set, system = {}) => ({ name, type: "power", system: { powerSet: set, ...system } });

const hero = new CONFIG.Actor.documentClass({
  name: "Aranha de Teste",
  type: "character",
  img: avatar("#4a4a62", "#b9b9d0"),
  system: {
    attributes: { rank: { value: 3 } },
    abilities: { mle: { value: 4 }, agl: { value: 5 }, res: { value: 2 }, vig: { value: 3 }, ego: { value: 1 }, log: { value: 2 } },
    health: { value: 38, max: 50 },
    focus: { value: 12, max: 20 },
    karma: { value: 3, max: 3 },
    realname: "Fulano de Tal",
    gender: "Livre",
    height: "1,75 m",
    weight: "70 kg",
    eyes: "Castanhos",
    hair: "Pretos",
    teams: "Os Testadores",
    base: "Brooklyn",
    history: "<p>Uma história de teste, com duas linhas para mostrar o campo de texto.</p>",
    personality: "<p>Bem-humorado.</p>",
    teamManeuver: { maneuverType: "offensive", level: 2 },
    defaultElement: "electricity",
    movement: { flight: { active: true } },
  },
  items: [
    power("Ataque Surpresa", "Basic", { ability: "mle", cost: "1", damageType: "health", description: "<p>Descrição.</p>" }),
    power("Esquiva", "Basic", { ability: "agl" }),
    power("Descarga", "Elemental Control", { ability: "ego", cost: "2", isElemental: true, element: "electricity", damageType: "focus" }),
    power("Escudo de Energia", "Elemental Control", { cost: "3" }),
    power("Teia Resistente", "Spider-Powers", { ability: "agl", cost: "1" }),
    { name: "Reflexos Rápidos", type: "trait", system: { description: "<p>Sempre o primeiro.</p>" } },
    { name: "Durão", type: "trait" },
    { name: "Urbano", type: "tag" },
    { name: "Herói de Rua", type: "tag" },
    { name: "Escudo Improvisado", type: "weapon", system: { ability: "mle" } },
    { name: "Corda", type: "item", system: { quantity: 2 } },
    { name: "Comunicador", type: "item" },
    { name: "Mutação", type: "origin" },
    { name: "Estudante", type: "occupation" },
    {
      name: "Armadura Mark III",
      type: "form",
      system: {
        kind: "suit",
        active: true,
        activatedAt: 1,
        rank: { mode: "set", value: 5 },
        restrictions: "Precisa de energia no reator",
        changes: [
          { key: "system.health.max", type: "add", value: "20" },
          { key: "system.abilities.res.value", type: "upgrade", value: "6" },
        ],
        powers: [{ name: "Flight 2" }, { name: "Elemental Blast", note: "Energy" }, { name: "Sturdy 1" }],
        traits: [{ name: "Tech Reliance" }],
        tags: [{ name: "Extreme Appearance", note: "Flashy" }],
        description: "<p>A armadura de combate do herói.</p>",
      },
    },
    { name: "Armadura Hulkbuster", type: "form", system: { kind: "suit", rank: { mode: "set", value: 6 }, borrowed: true } },
    { name: "Forma Bestial", type: "form", system: { kind: "alternate", rank: { mode: "add", value: 1 } } },
    { name: "Simbionte", type: "form", system: { kind: "transformation", rank: { mode: "add", value: 2 } } },
  ],
});

const npc = new CONFIG.Actor.documentClass({
  name: "Brutamontes",
  type: "npc",
  img: avatar("#5a3030", "#d0b9b9"),
  system: {
    attributes: { rank: { value: 4 } },
    abilities: { mle: { value: 6 }, agl: { value: 1 }, res: { value: 5 }, vig: { value: 2 }, ego: { value: 1 }, log: { value: 0 } },
    health: { value: 80, max: 90 },
    focus: { value: 10, max: 10 },
    healthDamageReduction: 1,
  },
  items: [power("Investida", "Super-Strength", { ability: "mle", cost: "2" }), { name: "Pele Dura", type: "trait" }, { name: "Vilão", type: "tag" }],
});

const css = fs
  .readFileSync(path.join(ROOT, "css/mmrpg.css"), "utf8")
  .replace(/url\(["']?\.\.\/fonts/g, `url("file://${ROOT}/fonts`);
const fontFaces = [
  ["Roboto", 400, "normal", "roboto/Roboto-Regular.woff2"],
  ["Roboto", 700, "normal", "roboto/Roboto-Bold.woff2"],
  ["Roboto", 400, "italic", "roboto/Roboto-Italic.woff2"],
  ["Roboto Condensed", 400, "normal", "roboto-condensed/RobotoCondensed-Regular.woff2"],
  ["Roboto Condensed", 700, "normal", "roboto-condensed/RobotoCondensed-Bold.woff2"],
  ["Roboto Slab", 400, "normal", "roboto-slab/RobotoSlab-Regular.ttf"],
  ["Roboto Slab", 700, "normal", "roboto-slab/RobotoSlab-Bold.ttf"],
]
  .map(([family, weight, style, file]) => `@font-face{font-family:"${family}";font-weight:${weight};font-style:${style};src:url("file://${ROOT}/fonts/${file}")}`)
  .join("\n");
const core = hostile ? fs.readFileSync(new URL("./preview-core.css", import.meta.url), "utf8") : "";

/** Na prévia os caminhos `systems/mmrpg/...` apontam para a pasta do projeto. */
const withLocalPaths = (html) =>
  html
    .replaceAll('src="systems/mmrpg/', `src="file://${ROOT}/`)
    // O <file-picker> é do Foundry (campo de texto com botão de procurar): aqui vira um campo simples.
    .replace(/<file-picker[^>]*name="([^"]+)"[^>]*value="([^"]*)"[^>]*><\/file-picker>/g, '<input type="text" name="$1" value="$2"/>');

/** Ícones do Font Awesome (que o Foundry traz) trocados por símbolos simples. */
const iconCss = `.fas::before{font-style:normal;font-family:Arial,sans-serif;font-weight:bold}
.fa-toggle-on::before{content:"\\25CF"}.fa-toggle-off::before{content:"\\25CB"}.fa-plus::before{content:"+"}.fa-edit::before{content:"\\270E"}.fa-trash::before{content:"\\2715"}.fa-times::before{content:"\\2715"}.fa-check::before{content:"\\2713"}`;

/** Envolve o formulário da ficha na "janela" do Foundry. */
function windowHtml({ title, classes, width, height, body, tab }) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
${fontFaces}
${iconCss}
${core}
${hostile ? "" : "body{margin:0;background:#2b2b30}.tab{display:none}.tab.active{display:block}.flexrow{display:flex;flex-direction:row;flex-wrap:wrap}.flexcol{display:flex;flex-direction:column}.window-app{margin:8px;display:flex;flex-direction:column;width:" + width + "px;height:" + height + "px}.window-content{flex:1;overflow-y:auto}"}
.window-app { width: ${width}px; height: ${height}px; }
${css}
</style></head><body>
<div class="app window-app ${classes}"><header class="window-header"><h4 class="window-title">${title}</h4></header><section class="window-content">${body}</section></div>
<script>
const tab = ${JSON.stringify(tab ?? null)};
if (tab) {
  document.querySelectorAll(".tab").forEach((el) => el.classList.toggle("active", el.dataset.tab === tab));
  document.querySelectorAll("nav .item").forEach((el) => el.classList.toggle("active", el.dataset.tab === tab));
}
</script></body></html>`;
}

async function sheetPage(name, SheetClass, doc, { tab, title } = {}) {
  const sheet = new SheetClass(doc);
  const body = withLocalPaths(await renderTemplate(sheet.template, sheet.getData()));
  const opts = sheet.options;
  const initial = tab ?? opts.tabs?.[0]?.initial;
  fs.writeFileSync(
    path.join(out, `${name}.html`),
    windowHtml({
      title: title ?? doc.name,
      classes: opts.classes.join(" "),
      width: opts.width,
      height: opts.height,
      body,
      tab: initial,
    })
  );
}

await sheetPage("personagem-poderes", MarvelMultiverseCharacterSheet, hero, { tab: "abilities" });
await sheetPage("personagem-biografia", MarvelMultiverseCharacterSheet, hero, { tab: "biography" });
await sheetPage("personagem-equipamento", MarvelMultiverseCharacterSheet, hero, { tab: "gear" });
await sheetPage("personagem-efeitos", MarvelMultiverseCharacterSheet, hero, { tab: "effects" });
await sheetPage("personagem-formas", MarvelMultiverseCharacterSheet, hero, { tab: "forms" });
await sheetPage("npc", MarvelMultiverseNPCSheet, npc);

const items = {
  "item-poder": new CONFIG.Item.documentClass({ name: "Descarga", type: "power", img: "icons/svg/item-bag.svg", system: hero.items.find((i) => i.name === "Descarga").system.toObject() }),
  "item-arma": new CONFIG.Item.documentClass({ name: "Escudo Improvisado", type: "weapon", system: { ability: "mle", category: "Escudo", attackKind: "close", description: "<p>Serve de escudo.</p>" } }),
  "item-trait": new CONFIG.Item.documentClass({ name: "Reflexos Rápidos", type: "trait", system: { description: "<p>Sempre o primeiro.</p>", restriction: "Nenhuma" } }),
  "item-origem": new CONFIG.Item.documentClass({
    name: "Mutação",
    type: "origin",
    system: { examples: "Exemplos", minimumRank: 1, traits: [{ name: "Durão" }], tags: [{ name: "Urbano" }], powers: [{ name: "Teia" }, "Salto"] },
  }),
};
for (const [name, item] of Object.entries(items)) await sheetPage(name, MarvelMultiverseItemSheet, item, { title: item.name });

// Ficha da forma (a armadura ligada que está na ficha do herói), uma página por aba.
const suit = hero.items.find((i) => i.name === "Armadura Mark III");
for (const tab of ["attributes", "changes", "grants"]) {
  await sheetPage(`item-forma-${tab}`, MarvelMultiverseItemSheet, suit, { tab, title: suit.name });
}
const looseSuit = new CONFIG.Item.documentClass({ name: "Armadura Solta", type: "form", system: { kind: "alternate" } });
await sheetPage("item-forma-solta", MarvelMultiverseItemSheet, looseSuit, { tab: "attributes", title: looseSuit.name });

// Cartão de rolagem no chat.
const roll = await renderTemplate("systems/mmrpg/templates/dice/roll.hbs", {
  formula: "{1d6,1dm,1d6}+@abilities.mle.value",
  total: 14,
  tooltip: await renderTemplate("systems/mmrpg/templates/chat/roll-breakdown.hbs", {
    parts: [
      { rolls: [{ result: 4, classes: "d6" }] },
      { rolls: [{ result: "m", classes: "marvel-roll die d6 fantastic" }] },
      { rolls: [{ result: 3, classes: "d6" }] },
    ],
  }),
});
fs.writeFileSync(
  path.join(out, "chat.html"),
  `<!doctype html><html><head><meta charset="utf-8"><style>${fontFaces}${iconCss}${core}body{margin:0;background:#2b2b30;width:320px;padding:8px}.chat{background:#ddd;padding:8px}${css}</style></head><body><div class="chat">${roll}</div></body></html>`
);

// Aviso de forma no chat.
const caster = new CONFIG.Actor.documentClass({
  name: "Aranha de Teste",
  type: "character",
  system: { attributes: { rank: { value: 3 } }, health: { value: 38, max: 50 } },
  items: [{ name: "Armadura Mark III", type: "form", system: { kind: "suit", rank: { mode: "set", value: 5 }, powers: [{ name: "Flight 2" }, { name: "Sturdy 1" }] } }],
});
ChatMessage.created.length = 0;
await caster.setFormActive(caster.forms[0], true);
const card = ChatMessage.created.at(-1).content;
fs.writeFileSync(
  path.join(out, "chat-forma.html"),
  `<!doctype html><html><head><meta charset="utf-8"><style>${fontFaces}${iconCss}${core}body{margin:0;background:#2b2b30;width:320px;padding:8px}.chat{background:#ddd;padding:8px}${css}</style></head><body><div class="chat">${card}</div></body></html>`
);

console.log(`Prévia gerada em ${out}`);

/**
 * Configuração do sistema (CONFIG.MMRPG).
 *
 * Este arquivo só contém estrutura e constantes numéricas (chaves, listas, tabelas).
 * Nenhum texto de regras dos livros é distribuído aqui: rótulos vêm dos arquivos lang/*.json
 * e o conteúdo (poderes, traços, tags…) é criado ou importado pelo próprio usuário.
 */

import { ABILITY_KEYS, ATTACK_ABILITY_KEYS } from "./rules/abilities.mjs";
import { MOVEMENT_MODES } from "./rules/movement.mjs";

export const MMRPG = {};

/** Identificador do sistema. */
MMRPG.id = "mmrpg";

/** Caminho base do sistema (usado em templates e assets). */
MMRPG.path = `systems/${MMRPG.id}`;

/** Nome do canal de socket do sistema. */
MMRPG.socket = `system.${MMRPG.id}`;

/* -------------------------------------------- */
/*  Atributos                                   */
/* -------------------------------------------- */

/**
 * Os seis atributos.
 * @type {Record<string, { label: string, abbr: string, attack: boolean }>}
 */
MMRPG.abilities = Object.fromEntries(
  ABILITY_KEYS.map((key) => [
    key,
    {
      label: `MMRPG.Ability.${key}.long`,
      abbr: `MMRPG.Ability.${key}.abbr`,
      attack: ATTACK_ABILITY_KEYS.includes(key)
    }
  ])
);

/** Atributos de ataque/dano (para menus). */
MMRPG.attackAbilities = Object.fromEntries(
  ATTACK_ABILITY_KEYS.map((key) => [key, MMRPG.abilities[key].label])
);

/** Todos os atributos (para menus). */
MMRPG.abilityChoices = Object.fromEntries(ABILITY_KEYS.map((key) => [key, MMRPG.abilities[key].label]));

/** Limites. */
/** Limites sugeridos (a ficha não impede valores fora deles). */
MMRPG.limits = { rankMin: 1, rankMax: 6 };

/* -------------------------------------------- */
/*  Rolagens                                    */
/* -------------------------------------------- */

MMRPG.edgeModes = {
  normal: "MMRPG.Edge.normal",
  edge: "MMRPG.Edge.edge",
  trouble: "MMRPG.Edge.trouble"
};

/* -------------------------------------------- */
/*  Poderes                                     */
/* -------------------------------------------- */

/**
 * Conjuntos de poderes, na ordem em que a ficha os exibe.
 * "basic" vem primeiro; os demais seguem em ordem alfabética (do nome em inglês).
 * Conjuntos personalizados (qualquer outra chave) aparecem depois, em ordem alfabética.
 */
MMRPG.powerSets = [
  "basic",
  "elementalControl",
  "healing",
  "illusion",
  "luck",
  "magic",
  "martialArts",
  "meleeWeapons",
  "narrative",
  "omniversalTravel",
  "phasing",
  "plasticity",
  "powerControl",
  "rangedWeapons",
  "resize",
  "shieldBearer",
  "sixthSense",
  "spiderPowers",
  "superSpeed",
  "superStrength",
  "tactics",
  "telekinesis",
  "telepathy",
  "teleportation",
  "translation",
  "weatherControl"
];

MMRPG.powerSetLabels = Object.fromEntries(MMRPG.powerSets.map((key) => [key, `MMRPG.PowerSet.${key}`]));

/* -------------------------------------------- */
/*  Ações                                       */
/* -------------------------------------------- */

MMRPG.activationTypes = {
  attack: "MMRPG.Activation.attack",
  action: "MMRPG.Activation.action",
  reaction: "MMRPG.Activation.reaction",
  free: "MMRPG.Activation.free",
  passive: "MMRPG.Activation.passive",
  other: "MMRPG.Activation.other"
};

MMRPG.rollModes = {
  none: "MMRPG.ActionRoll.none",
  attack: "MMRPG.ActionRoll.attack",
  check: "MMRPG.ActionRoll.check"
};

MMRPG.attackKinds = {
  close: "MMRPG.AttackKind.close",
  ranged: "MMRPG.AttackKind.ranged",
  area: "MMRPG.AttackKind.area"
};

MMRPG.damageResources = {
  health: "MMRPG.Resource.health",
  focus: "MMRPG.Resource.focus"
};

MMRPG.healingResources = {
  health: "MMRPG.Resource.health",
  focus: "MMRPG.Resource.focus",
  karma: "MMRPG.Resource.karma"
};

MMRPG.healingModes = {
  marvel: "MMRPG.HealingMode.marvel",
  flat: "MMRPG.HealingMode.flat"
};

MMRPG.effectTriggers = {
  hit: "MMRPG.EffectWhen.hit",
  miss: "MMRPG.EffectWhen.miss",
  success: "MMRPG.EffectWhen.success",
  failure: "MMRPG.EffectWhen.failure",
  fantastic: "MMRPG.EffectWhen.fantastic",
  always: "MMRPG.EffectWhen.always"
};

MMRPG.effectTargets = {
  targets: "MMRPG.EffectTarget.targets",
  self: "MMRPG.EffectTarget.self"
};

MMRPG.targetTypes = {
  targets: "MMRPG.TargetType.targets",
  self: "MMRPG.TargetType.self",
  area: "MMRPG.TargetType.area"
};

/** Tipos de alteração de Active Effect oferecidos no editor de ações. */
MMRPG.changeTypes = {
  add: "MMRPG.ChangeType.add",
  multiply: "MMRPG.ChangeType.multiply",
  override: "MMRPG.ChangeType.override",
  upgrade: "MMRPG.ChangeType.upgrade",
  downgrade: "MMRPG.ChangeType.downgrade"
};

MMRPG.areaShapes = {
  circle: "MMRPG.Area.circle",
  cone: "MMRPG.Area.cone",
  ray: "MMRPG.Area.ray",
  rect: "MMRPG.Area.rect"
};

/* -------------------------------------------- */
/*  Elementos e condições                       */
/* -------------------------------------------- */

/**
 * Elementos. `status` é a condição associada ao resultado Fantástico de um ataque elemental
 * (o texto da regra fica no arquivo de idioma, não aqui).
 */
MMRPG.elements = {
  air: { label: "MMRPG.Element.air", status: "prone" },
  earth: { label: "MMRPG.Element.earth", status: "slowed" },
  electricity: { label: "MMRPG.Element.electricity", status: "stunned" },
  energy: { label: "MMRPG.Element.energy", status: "blinded" },
  fire: { label: "MMRPG.Element.fire", status: "burning" },
  force: { label: "MMRPG.Element.force", status: null },
  hellfire: { label: "MMRPG.Element.hellfire", status: null },
  ice: { label: "MMRPG.Element.ice", status: "paralyzed" },
  iron: { label: "MMRPG.Element.iron", status: "pinned" },
  sound: { label: "MMRPG.Element.sound", status: "deafened" },
  water: { label: "MMRPG.Element.water", status: "surprised" },
  toxin: { label: "MMRPG.Element.toxin", status: "poisoned" },
  chemical: { label: "MMRPG.Element.chemical", status: "corroding" },
  swarm: { label: "MMRPG.Element.swarm", status: "frightened" }
};

/** Condições registradas como efeitos de status do Foundry. */
MMRPG.statuses = [
  { id: "prone", img: "icons/svg/falling.svg" },
  { id: "slowed", img: "icons/svg/anchor.svg" },
  { id: "stunned", img: "icons/svg/daze.svg" },
  { id: "blinded", img: "icons/svg/blind.svg" },
  { id: "burning", img: "icons/svg/fire.svg" },
  { id: "paralyzed", img: "icons/svg/paralysis.svg" },
  { id: "pinned", img: "icons/svg/net.svg" },
  { id: "deafened", img: "icons/svg/deaf.svg" },
  { id: "surprised", img: "icons/svg/eye.svg" },
  { id: "poisoned", img: "icons/svg/poison.svg" },
  { id: "corroding", img: "icons/svg/acid.svg" },
  { id: "frightened", img: "icons/svg/terror.svg" },
  { id: "dead", img: "icons/svg/skull.svg" }
];

/** Opções de condição para menus (chave → rótulo). */
MMRPG.statusChoices = Object.fromEntries(MMRPG.statuses.map((s) => [s.id, `MMRPG.Status.${s.id}`]));

/* -------------------------------------------- */
/*  Movimento                                   */
/* -------------------------------------------- */

/**
 * Tipos de movimento. `mode` é o modo padrão de cálculo e `active` indica se aparece na ficha.
 */
MMRPG.movementTypes = {
  run: { label: "MMRPG.Movement.run", mode: "fixed", base: 5, active: true },
  climb: { label: "MMRPG.Movement.climb", mode: "half", base: 0, active: true },
  swim: { label: "MMRPG.Movement.swim", mode: "half", base: 0, active: true },
  jump: { label: "MMRPG.Movement.jump", mode: "half", base: 0, active: true },
  flight: { label: "MMRPG.Movement.flight", mode: "fixed", base: 0, active: false },
  glide: { label: "MMRPG.Movement.glide", mode: "fixed", base: 0, active: false },
  swingline: { label: "MMRPG.Movement.swingline", mode: "fixed", base: 0, active: false },
  levitation: { label: "MMRPG.Movement.levitation", mode: "fixed", base: 0, active: false }
};

MMRPG.movementModes = Object.fromEntries(MOVEMENT_MODES.map((m) => [m, `MMRPG.MovementMode.${m}`]));

/* -------------------------------------------- */
/*  Tamanho                                     */
/* -------------------------------------------- */

/**
 * Tamanhos, do menor ao maior. Aqui há apenas o rótulo: o sistema não aplica nenhum bônus
 * numérico automático por tamanho (defesa, alcance, corrida…). Esses efeitos variam conforme o
 * livro e ficam por conta do jogador, via os campos de bônus da ficha ou Active Effects.
 */
MMRPG.sizes = {
  microscopic: { label: "MMRPG.Size.microscopic" },
  miniature: { label: "MMRPG.Size.miniature" },
  tiny: { label: "MMRPG.Size.tiny" },
  little: { label: "MMRPG.Size.little" },
  small: { label: "MMRPG.Size.small" },
  average: { label: "MMRPG.Size.average" },
  big: { label: "MMRPG.Size.big" },
  huge: { label: "MMRPG.Size.huge" },
  gigantic: { label: "MMRPG.Size.gigantic" },
  titanic: { label: "MMRPG.Size.titanic" },
  gargantuan: { label: "MMRPG.Size.gargantuan" }
};

MMRPG.sizeChoices = Object.fromEntries(Object.entries(MMRPG.sizes).map(([k, v]) => [k, v.label]));

/* -------------------------------------------- */
/*  Equipe                                      */
/* -------------------------------------------- */

/** Manobras de equipe: custo em Focus por nível e média de Rank recomendada. */
MMRPG.teamManeuvers = {
  types: ["offensive", "defensive", "rally"],
  levels: [
    { level: 1, focusCost: 5, rankAverage: [1, 2] },
    { level: 2, focusCost: 10, rankAverage: [3, 4] },
    { level: 3, focusCost: 15, rankAverage: [5, 6] }
  ]
};

MMRPG.teamManeuverChoices = Object.fromEntries(
  MMRPG.teamManeuvers.types.map((t) => [t, `MMRPG.TeamManeuver.${t}.name`])
);

/* -------------------------------------------- */
/*  Itens                                       */
/* -------------------------------------------- */

MMRPG.weaponKinds = {
  close: "MMRPG.WeaponKind.close",
  ranged: "MMRPG.WeaponKind.ranged",
  thrown: "MMRPG.WeaponKind.thrown",
  other: "MMRPG.WeaponKind.other"
};

/** Tipos de item que carregam ações executáveis. */
MMRPG.actionItemTypes = ["power", "weapon", "gear"];

/** Tipos de item que concedem outros itens ao serem adicionados a um personagem. */
MMRPG.grantingItemTypes = ["origin", "occupation"];

/** Tipos de item que podem ser concedidos. */
MMRPG.grantableItemTypes = ["tag", "trait", "power"];

/** Ícones padrão por tipo de item. */
MMRPG.itemIcons = {
  power: "icons/svg/lightning.svg",
  trait: "icons/svg/upgrade.svg",
  tag: "icons/svg/book.svg",
  origin: "icons/svg/mystery-man.svg",
  occupation: "icons/svg/tower.svg",
  weapon: "icons/svg/sword.svg",
  gear: "icons/svg/item-bag.svg"
};

/* -------------------------------------------- */
/*  Interface                                   */
/* -------------------------------------------- */

MMRPG.ascii = String.raw`
 __  __ __  __ ____  ____   ____
|  \/  |  \/  |  _ \|  _ \ / ___|
| |\/| | |\/| | |_) | |_) | |  _
| |  | | |  | |  _ <|  __/| |_| |
|_|  |_|_|  |_|_| \_\_|    \____|
`;

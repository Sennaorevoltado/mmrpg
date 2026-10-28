/**
 * Tabelas de configuração do sistema.
 *
 * Aqui ficam só chaves, números e referências a textos de idioma. Nenhum texto de livro:
 * os nomes que o jogador vê vêm de lang/pt-BR.json e lang/en.json.
 */
export const MARVEL_MULTIVERSE = {};

/**
 * Os seis atributos.
 * @type {Object}
 */
MARVEL_MULTIVERSE.abilities = {
  mle: "MARVEL_MULTIVERSE.Ability.Mel.long",
  agl: "MARVEL_MULTIVERSE.Ability.Agl.long",
  res: "MARVEL_MULTIVERSE.Ability.Res.long",
  vig: "MARVEL_MULTIVERSE.Ability.Vig.long",
  ego: "MARVEL_MULTIVERSE.Ability.Ego.long",
  log: "MARVEL_MULTIVERSE.Ability.Log.long",
};

/** Atributos que servem para atacar e causar dano (os demais só testam). */
MARVEL_MULTIVERSE.damageAbilities = ["mle", "agl", "ego", "log"];

/** Tipos de recurso que o dano pode atingir. */
MARVEL_MULTIVERSE.damageTypes = {
  health: "MARVEL_MULTIVERSE.Resource.health",
  focus: "MARVEL_MULTIVERSE.Resource.focus",
};

MARVEL_MULTIVERSE.attackKinds = {
  ranged: "MARVEL_MULTIVERSE.AttackKind.ranged",
  close: "MARVEL_MULTIVERSE.AttackKind.close",
};

MARVEL_MULTIVERSE.edgeModes = {
  edge: "MARVEL_MULTIVERSE.edgeMode.edge",
  normal: "MARVEL_MULTIVERSE.edgeMode.normal",
  trouble: "MARVEL_MULTIVERSE.edgeMode.trouble",
};

MARVEL_MULTIVERSE.MARVEL_RESULTS = {
  1: { label: "MARVEL_MULTIVERSE.MarvelResult.M", image: "systems/mmrpg/icons/marvel-1.svg" },
  2: { label: "MARVEL_MULTIVERSE.MarvelResult.2", image: "systems/mmrpg/icons/marvel-2.svg" },
  3: { label: "MARVEL_MULTIVERSE.MarvelResult.3", image: "systems/mmrpg/icons/marvel-3.svg" },
  4: { label: "MARVEL_MULTIVERSE.MarvelResult.4", image: "systems/mmrpg/icons/marvel-4.svg" },
  5: { label: "MARVEL_MULTIVERSE.MarvelResult.5", image: "systems/mmrpg/icons/marvel-5.svg" },
  6: { label: "MARVEL_MULTIVERSE.MarvelResult.6", image: "systems/mmrpg/icons/marvel-6.svg" },
};

MARVEL_MULTIVERSE.sizes = {
  microscopic: { label: "MARVEL_MULTIVERSE.Size.Microscopic" },
  miniature: { label: "MARVEL_MULTIVERSE.Size.Miniature" },
  tiny: { label: "MARVEL_MULTIVERSE.Size.Tiny" },
  little: { label: "MARVEL_MULTIVERSE.Size.Little" },
  small: { label: "MARVEL_MULTIVERSE.Size.Small" },
  average: { label: "MARVEL_MULTIVERSE.Size.Average" },
  big: { label: "MARVEL_MULTIVERSE.Size.Big" },
  huge: { label: "MARVEL_MULTIVERSE.Size.Huge" },
  gigantic: { label: "MARVEL_MULTIVERSE.Size.Gigantic" },
  titanic: { label: "MARVEL_MULTIVERSE.Size.Titanic" },
  gargantuan: { label: "MARVEL_MULTIVERSE.Size.Gargantuan" },
};

/**
 * Conjuntos de poderes, na ordem em que a ficha os mostra.
 *
 * `label` é o valor que fica gravado no poder (`system.powerSet`) e é o nome em inglês: assim o
 * conteúdo escrito em qualquer idioma se encaixa. `name` é o texto que o jogador vê.
 */
MARVEL_MULTIVERSE.powersets = {
  basic: { label: "Basic", name: "MARVEL_MULTIVERSE.PowerSet.basic" },
  elementalControl: { label: "Elemental Control", name: "MARVEL_MULTIVERSE.PowerSet.elementalControl" },
  healing: { label: "Healing", name: "MARVEL_MULTIVERSE.PowerSet.healing" },
  illusion: { label: "Illusion", name: "MARVEL_MULTIVERSE.PowerSet.illusion" },
  luck: { label: "Luck", name: "MARVEL_MULTIVERSE.PowerSet.luck" },
  magic: { label: "Magic", name: "MARVEL_MULTIVERSE.PowerSet.magic" },
  martialArts: { label: "Martial Arts", name: "MARVEL_MULTIVERSE.PowerSet.martialArts" },
  meleeWeapons: { label: "Melee Weapons", name: "MARVEL_MULTIVERSE.PowerSet.meleeWeapons" },
  narrative: { label: "Narrative", name: "MARVEL_MULTIVERSE.PowerSet.narrative" },
  omniversalTravel: { label: "Omniversal Travel", name: "MARVEL_MULTIVERSE.PowerSet.omniversalTravel" },
  phasing: { label: "Phasing", name: "MARVEL_MULTIVERSE.PowerSet.phasing" },
  plasticity: { label: "Plasticity", name: "MARVEL_MULTIVERSE.PowerSet.plasticity" },
  powerControl: { label: "Power Control", name: "MARVEL_MULTIVERSE.PowerSet.powerControl" },
  rangedWeapons: { label: "Ranged Weapons", name: "MARVEL_MULTIVERSE.PowerSet.rangedWeapons" },
  resize: { label: "Resize", name: "MARVEL_MULTIVERSE.PowerSet.resize" },
  shieldBearer: { label: "Shield Bearer", name: "MARVEL_MULTIVERSE.PowerSet.shieldBearer" },
  sixthSense: { label: "Sixth Sense", name: "MARVEL_MULTIVERSE.PowerSet.sixthSense" },
  spiderPowers: { label: "Spider-Powers", name: "MARVEL_MULTIVERSE.PowerSet.spiderPowers" },
  superSpeed: { label: "Super-Speed", name: "MARVEL_MULTIVERSE.PowerSet.superSpeed" },
  superStrength: { label: "Super-Strength", name: "MARVEL_MULTIVERSE.PowerSet.superStrength" },
  tactics: { label: "Tactics", name: "MARVEL_MULTIVERSE.PowerSet.tactics" },
  telekinesis: { label: "Telekinesis", name: "MARVEL_MULTIVERSE.PowerSet.telekinesis" },
  telepathy: { label: "Telepathy", name: "MARVEL_MULTIVERSE.PowerSet.telepathy" },
  teleportation: { label: "Teleportation", name: "MARVEL_MULTIVERSE.PowerSet.teleportation" },
  translation: { label: "Translation", name: "MARVEL_MULTIVERSE.PowerSet.translation" },
  weatherControl: { label: "Weather Control", name: "MARVEL_MULTIVERSE.PowerSet.weatherControl" },
};

/** Valor gravado (nome em inglês) -> chave do conjunto. */
MARVEL_MULTIVERSE.reverseSetList = Object.fromEntries(
  Object.keys(MARVEL_MULTIVERSE.powersets).map((k) => [MARVEL_MULTIVERSE.powersets[k].label, k])
);

MARVEL_MULTIVERSE.movementTypes = {
  run: { label: "MARVEL_MULTIVERSE.Movement.Run", active: true },
  climb: { label: "MARVEL_MULTIVERSE.Movement.Climb", active: true },
  swim: { label: "MARVEL_MULTIVERSE.Movement.Swim", active: true },
  jump: { label: "MARVEL_MULTIVERSE.Movement.Jump", active: true },
  flight: { label: "MARVEL_MULTIVERSE.Movement.Flight", active: false },
  glide: { label: "MARVEL_MULTIVERSE.Movement.Glide", active: false },
  swingline: { label: "MARVEL_MULTIVERSE.Movement.Swingline", active: false },
  levitation: { label: "MARVEL_MULTIVERSE.Movement.Levitation", active: false },
};

/** Elementos. A chave é o que fica gravado no poder; `name` é o que o jogador vê. */
MARVEL_MULTIVERSE.elements = {
  air: { name: "MARVEL_MULTIVERSE.Element.air" },
  earth: { name: "MARVEL_MULTIVERSE.Element.earth" },
  electricity: { name: "MARVEL_MULTIVERSE.Element.electricity" },
  energy: { name: "MARVEL_MULTIVERSE.Element.energy" },
  fire: { name: "MARVEL_MULTIVERSE.Element.fire" },
  force: { name: "MARVEL_MULTIVERSE.Element.force" },
  hellfire: { name: "MARVEL_MULTIVERSE.Element.hellfire" },
  ice: { name: "MARVEL_MULTIVERSE.Element.ice" },
  iron: { name: "MARVEL_MULTIVERSE.Element.iron" },
  sound: { name: "MARVEL_MULTIVERSE.Element.sound" },
  water: { name: "MARVEL_MULTIVERSE.Element.water" },
  toxin: { name: "MARVEL_MULTIVERSE.Element.toxin" },
  chemical: { name: "MARVEL_MULTIVERSE.Element.chemical" },
  swarm: { name: "MARVEL_MULTIVERSE.Element.swarm" },
};

/**
 * Manobras de equipe: tipo e nível. O custo e o efeito de cada uma estão no livro.
 */
MARVEL_MULTIVERSE.teamManeuvers = [
  { type: "offensive", name: "MARVEL_MULTIVERSE.TeamManeuver.offensive" },
  { type: "defensive", name: "MARVEL_MULTIVERSE.TeamManeuver.defensive" },
  { type: "rally", name: "MARVEL_MULTIVERSE.TeamManeuver.rally" },
];

/**
 * Efeitos de cada tamanho (Defesa, alcance, movimento, multiplicador de dano, token).
 * São criados na ficha como Efeitos Ativos quando o jogador escolhe o tamanho.
 */
MARVEL_MULTIVERSE.sizeEffects = {
  microscopic: {
    name: "MARVEL_MULTIVERSE.SizeEffect.microscopic",
    disabled: false,
    changes: [
      {
        key: "system.size",
        mode: 5,
        value: "microscopic",
      },
      {
        key: "system.abilities.mle.defense",
        mode: 2,
        value: 5,
      },
      {
        key: "system.abilities.agl.defense",
        mode: 2,
        value: 5,
      },
    ],
    description: "",
    transfer: true,
    statuses: [],
    flags: {},
  },
  miniature: {
    name: "MARVEL_MULTIVERSE.SizeEffect.miniature",
    disabled: false,
    changes: [
      {
        key: "system.size",
        mode: 5,
        value: "miniature",
      },
      {
        key: "system.abilities.mle.defense",
        mode: 2,
        value: 4,
      },
      {
        key: "system.abilities.agl.defense",
        mode: 2,
        value: 4,
      },
    ],
    description: "",
    transfer: true,
    statuses: [],
    flags: {},
  },
  tiny: {
    name: "MARVEL_MULTIVERSE.SizeEffect.tiny",
    disabled: false,
    changes: [
      {
        key: "system.size",
        mode: 5,
        value: "tiny",
      },
      {
        key: "system.abilities.mle.defense",
        mode: 2,
        value: 3,
      },
      {
        key: "system.abilities.agl.defense",
        mode: 2,
        value: 3,
      },
    ],
    description: "",
    transfer: true,
    statuses: [],
    flags: {},
  },
  little: {
    name: "MARVEL_MULTIVERSE.SizeEffect.little",
    disabled: false,
    changes: [
      {
        key: "system.size",
        mode: 5,
        value: "little",
      },
      {
        key: "system.abilities.mle.defense",
        mode: 2,
        value: 2,
      },
      {
        key: "system.abilities.agl.defense",
        mode: 2,
        value: 2,
      },
      {
        key: "prototypeToken.width",
        mode: 1,
        value: 0.25,
      },
      {
        key: "prototypeToken.height",
        mode: 1,
        value: 0.25,
      },
    ],
    description: "",
    transfer: true,
    statuses: [],
    flags: {},
  },
  small: {
    name: "MARVEL_MULTIVERSE.SizeEffect.small",
    disabled: false,
    changes: [
      {
        key: "system.size",
        mode: 5,
        value: "small",
      },
      {
        key: "system.abilities.mle.defense",
        mode: 2,
        value: 1,
      },
      {
        key: "system.abilities.agl.defense",
        mode: 2,
        value: 1,
      },
      {
        key: "system.movement.run.value",
        mode: 2,
        value: -1,
      },
    ],
    description: "",
    transfer: true,
    statuses: [],
    flags: {},
  },
  average: {
    name: "MARVEL_MULTIVERSE.SizeEffect.average",
    disabled: false,
    changes: [
      {
        key: "system.size",
        mode: 5,
        value: "average",
      },
    ],
    description: "",
    transfer: true,
    statuses: [],
    flags: {},
  },
  big: {
    name: "MARVEL_MULTIVERSE.SizeEffect.big",
    disabled: false,
    changes: [
      {
        key: "system.size",
        mode: 5,
        value: "big",
      },
      {
        key: "system.abilities.mle.defense",
        mode: 2,
        value: -1,
      },
      {
        key: "system.abilities.agl.defense",
        mode: 2,
        value: -1,
      },
      {
        key: "system.reach",
        mode: 5,
        value: 2,
      },
      {
        key: "system.movement.run.value",
        mode: 2,
        value: 1,
      },
    ],
    description: "",
    transfer: true,
    statuses: [],
    flags: {},
  },
  huge: {
    name: "MARVEL_MULTIVERSE.SizeEffect.huge",
    disabled: false,
    changes: [
      {
        key: "system.size",
        mode: 5,
        value: "huge",
      },
      {
        key: "system.abilities.mle.defense",
        mode: 2,
        value: -2,
      },
      {
        key: "system.abilities.agl.defense",
        mode: 2,
        value: -2,
      },
      {
        key: "system.reach",
        mode: 5,
        value: 5,
      },
      {
        key: "system.movement.run.value",
        mode: 1,
        value: 5,
      },
      {
        key: "system.abilities.mle.damageMultiplier",
        mode: 2,
        value: 2,
      },
      {
        key: "prototypeToken.width",
        mode: 1,
        value: 5,
      },
      {
        key: "prototypeToken.height",
        mode: 1,
        value: 5,
      },
    ],
    description: "",
    transfer: true,
    statuses: [],
    flags: {},
  },
  gigantic: {
    name: "MARVEL_MULTIVERSE.SizeEffect.gigantic",
    disabled: false,
    changes: [
      {
        key: "system.size",
        mode: 5,
        value: "gigantic",
      },
      {
        key: "system.abilities.mle.defense",
        mode: 2,
        value: -3,
      },
      {
        key: "system.abilities.agl.defense",
        mode: 2,
        value: -3,
      },
      {
        key: "system.reach",
        mode: 5,
        value: 20,
      },
      {
        key: "system.movement.run.value",
        mode: 1,
        value: 20,
      },
      {
        key: "system.abilities.mle.damageMultiplier",
        mode: 2,
        value: 4,
      },
      {
        key: "prototypeToken.width",
        mode: 1,
        value: 20,
      },
      {
        key: "prototypeToken.height",
        mode: 1,
        value: 20,
      },
    ],
    description: "",
    transfer: true,
    statuses: [],
    flags: {},
  },
  titanic: {
    name: "MARVEL_MULTIVERSE.SizeEffect.titanic",
    disabled: false,
    changes: [
      {
        key: "system.size",
        mode: 5,
        value: "titanic",
      },
      {
        key: "system.abilities.mle.defense",
        mode: 2,
        value: -4,
      },
      {
        key: "system.abilities.agl.defense",
        mode: 2,
        value: -4,
      },
      {
        key: "system.reach",
        mode: 5,
        value: 80,
      },
      {
        key: "system.movement.run.value",
        mode: 1,
        value: 80,
      },
      {
        key: "system.abilities.mle.damageMultiplier",
        mode: 2,
        value: 6,
      },
      {
        key: "prototypeToken.width",
        mode: 1,
        value: 80,
      },
      {
        key: "prototypeToken.height",
        mode: 1,
        value: 80,
      },
    ],
    description: "",
    transfer: true,
    statuses: [],
    flags: {},
  },
  gargantuan: {
    name: "MARVEL_MULTIVERSE.SizeEffect.gargantuan",
    disabled: false,
    changes: [
      {
        key: "system.size",
        mode: 5,
        value: "gargantuan",
      },
      {
        key: "system.abilities.mle.defense",
        mode: 2,
        value: -5,
      },
      {
        key: "system.abilities.agl.defense",
        mode: 2,
        value: -5,
      },
      {
        key: "system.reach",
        mode: 5,
        value: 320,
      },
      {
        key: "system.movement.run.value",
        mode: 1,
        value: 320,
      },
      {
        key: "system.abilities.mle.damageMultiplier",
        mode: 2,
        value: 8,
      },
      {
        key: "prototypeToken.width",
        mode: 1,
        value: 320,
      },
      {
        key: "prototypeToken.height",
        mode: 1,
        value: 320,
      },
    ],
    description: "",
    transfer: true,
    statuses: [],
    flags: {},
  },
};

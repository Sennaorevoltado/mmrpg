import ActorBase from "./actor-base.mjs";

/** NPC: a ficha nasce no modo livre e não mostra o botão de modo. */
export default class NpcData extends ActorBase {
  static FREE_BY_DEFAULT = true;
}

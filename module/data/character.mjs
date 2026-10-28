import ActorBase from "./actor-base.mjs";

/** Personagem de jogador: a ficha nasce no modo criação. */
export default class CharacterData extends ActorBase {
  static FREE_BY_DEFAULT = false;
}

/**
 * Base de todos os itens do sistema.
 */

export default class ItemBase extends foundry.abstract.TypeDataModel {
  /** @inheritdoc */
  static defineSchema() {
    const f = foundry.data.fields;
    return {
      /** Texto do item, escrito ou importado pelo usuário. */
      description: new f.HTMLField({ required: true, blank: true, initial: "" }),
      /** Origem do conteúdo (livro, página, homebrew…). Texto livre. */
      source: new f.StringField({ required: true, blank: true, initial: "" }),
      /** Identificador estável para importações e atualizações (opcional). */
      identifier: new f.StringField({ required: true, blank: true, initial: "" })
    };
  }

  /** Itens que carregam ações têm esta propriedade; os demais devolvem lista vazia. */
  get actionList() {
    return [];
  }
}

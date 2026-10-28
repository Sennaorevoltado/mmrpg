import MarvelMultiverseItemBase from "./item-base.mjs";
import { FORM_CHANGE_TYPES } from "../helpers/forms.mjs";

/**
 * Forma: armadura, forma alternativa ou transformação.
 *
 * O item mora na ficha e é ligado e desligado pelo personagem. Os efeitos e as concessões só valem
 * enquanto `active` for verdadeiro (veja `Actor#setFormActive`).
 */
export default class MarvelMultiverseForm extends MarvelMultiverseItemBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = super.defineSchema();

    /** suit (armadura), alternate (forma alternativa) ou transformation (transformação). */
    schema.kind = new fields.StringField({ required: true, blank: false, initial: "suit" });
    /** Ativa agora? Quem controla é o ator; cópias novas sempre começam desligadas. */
    schema.active = new fields.BooleanField({ required: true, initial: false });
    /** Momento da ativação (decide qual imagem vale quando há mais de uma forma ativa). */
    schema.activatedAt = new fields.NumberField({ required: true, nullable: false, integer: true, initial: 0, min: 0 });
    /** Emprestada: concede os itens, mas não altera Rank nem valores da ficha. */
    schema.borrowed = new fields.BooleanField({ required: true, initial: false });
    schema.restrictions = new fields.StringField({ required: true, blank: true, initial: "" });

    schema.rank = new fields.SchemaField({
      mode: new fields.StringField({ required: true, blank: false, initial: "none" }),
      value: new fields.NumberField({ required: true, nullable: false, integer: true, initial: 0 }),
    });
    /** O dano sofrido acompanha o corpo quando Saúde ou Foco máximos mudam. */
    schema.carryDamage = new fields.BooleanField({ required: true, initial: true });

    /** Imagem da ficha e do token enquanto a forma estiver ativa (vazio: não troca). */
    schema.portrait = new fields.StringField({ required: true, blank: true, initial: "" });
    schema.token = new fields.StringField({ required: true, blank: true, initial: "" });

    /** Alterações da ficha enquanto ativa (mesmo formato das alterações de um Active Effect). */
    schema.changes = new fields.ArrayField(
      new fields.SchemaField({
        key: new fields.StringField({ required: true, blank: true, initial: "" }),
        type: new fields.StringField({ required: true, blank: false, initial: FORM_CHANGE_TYPES[0] }),
        value: new fields.StringField({ required: true, blank: true, initial: "" }),
        priority: new fields.NumberField({ required: true, nullable: true, integer: true, initial: null }),
      })
    );

    /** O que a forma concede enquanto ativa (mesmo formato de Origem e Ocupação). */
    schema.powers = new fields.ArrayField(new fields.ObjectField());
    schema.traits = new fields.ArrayField(new fields.ObjectField());
    schema.tags = new fields.ArrayField(new fields.ObjectField());

    return schema;
  }
}

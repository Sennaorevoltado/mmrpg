import ItemBase from "./item-base.mjs";
import { grantsField } from "./grants.mjs";
import { FORM_KINDS, FORM_RANK_MODES, FORM_CHANGE_TYPES } from "../rules/forms.mjs";

/**
 * Forma: armadura, transformação ou forma alternativa.
 *
 * O item mora na ficha e é ligado/desligado pelo personagem. Os efeitos e as concessões só valem
 * enquanto `active` for verdadeiro (ver Actor#setFormActive).
 */
export default class FormData extends ItemBase {
  /** @inheritdoc */
  static defineSchema() {
    const f = foundry.data.fields;
    return {
      ...super.defineSchema(),
      /** Categoria; só uma forma de cada categoria fica ativa por vez. */
      kind: new f.StringField({ required: true, blank: false, choices: [...FORM_KINDS], initial: "suit" }),
      /** Ativa agora? Controlada pelo ator; cópias novas sempre começam desativadas. */
      active: new f.BooleanField({ required: true, initial: false }),
      /** Momento da ativação (ordena as imagens quando há mais de uma forma ativa). */
      activatedAt: new f.NumberField({ required: true, nullable: false, integer: true, initial: 0, min: 0 }),
      /** Emprestada: concede os itens, mas não altera Rank nem valores da ficha. */
      borrowed: new f.BooleanField({ required: true, initial: false }),
      rank: new f.SchemaField({
        mode: new f.StringField({ required: true, blank: false, choices: [...FORM_RANK_MODES], initial: "none" }),
        value: new f.NumberField({ required: true, nullable: false, integer: true, initial: 0 })
      }),
      /** O dano sofrido acompanha o corpo quando Saúde ou Foco máximos mudam. */
      carryDamage: new f.BooleanField({ required: true, initial: true }),
      /** Imagem da ficha e do token enquanto a forma estiver ativa (vazio = não troca). */
      portrait: new f.StringField({ required: true, blank: true, initial: "" }),
      token: new f.StringField({ required: true, blank: true, initial: "" }),
      /** Alterações da ficha enquanto ativa (mesmo formato das alterações de Active Effect). */
      changes: new f.ArrayField(
        new f.SchemaField({
          key: new f.StringField({ required: true, blank: true, initial: "" }),
          type: new f.StringField({ required: true, blank: false, choices: [...FORM_CHANGE_TYPES], initial: "add" }),
          value: new f.StringField({ required: true, blank: true, initial: "" }),
          priority: new f.NumberField({ required: true, nullable: true, integer: true, initial: null })
        })
      ),
      /** Itens concedidos enquanto ativa (poderes, traços, tags). */
      grants: grantsField()
    };
  }
}

/**
 * Campo compartilhado por Origens e Ocupações: itens concedidos ao serem adicionados a um personagem.
 */

/** @returns {foundry.data.fields.ArrayField} */
export function grantsField() {
  const f = foundry.data.fields;
  return new f.ArrayField(
    new f.SchemaField({
      uuid: new f.StringField({ required: true, blank: true, initial: "" }),
      name: new f.StringField({ required: true, blank: true, initial: "" }),
      type: new f.StringField({ required: true, blank: true, initial: "" }),
      /** Observação que vira parte do nome do item criado (ex.: "Criminal" em "Connections: Criminal"). */
      note: new f.StringField({ required: true, blank: true, initial: "" })
    })
  );
}

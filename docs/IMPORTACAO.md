# Importar e exportar conteúdo

O sistema **não inclui conteúdo dos livros**. Quem joga monta o próprio arquivo e o importa. O arquivo é um JSON simples; este guia descreve o formato. O arquivo [`examples/exemplo-conteudo.json`](../examples/exemplo-conteudo.json) é um exemplo completo com itens inventados.

> Se você traduziu ou transcreveu o conteúdo dos livros para uso pessoal, mantenha o arquivo só para você: não o publique junto com o sistema nem em repositório público.

## Como importar

1. Entre como GM.
2. Abra **Configurações → Configurar opções do sistema → Importar conteúdo**, ou use o botão **Importar conteúdo** no topo da aba *Itens*.
3. Escolha o `.json`. A janela mostra quantos itens de cada tipo foram lidos e lista erros e avisos.
4. Escolha o que fazer se já existir um item com o mesmo tipo e nome: **ignorar**, **atualizar o existente** ou **criar cópia**.
5. Clique em importar. Os itens vão para a aba *Itens* do mundo, nas pastas indicadas no arquivo.

Erros do arquivo inteiro (JSON quebrado, formato ou versão errados) impedem a importação. Erros de um item (tipo inválido, nome ausente, ação que não é objeto…) aparecem em vermelho e **só aquele item é pulado**; os válidos continuam disponíveis. Concessões que apontam para itens inexistentes aparecem no relatório (o item é criado, a concessão fica sem ligação).

Para **exportar**: na mesma janela, marque os tipos e clique em exportar. O arquivo sai no mesmo formato, com as concessões por tipo e nome (funcionam em outros mundos).

## Estrutura do arquivo

```json
{
  "format": "mmrpg-content",
  "version": 1,
  "source": "texto livre (opcional)",
  "items": [
    {
      "type": "power",
      "name": "Nome do item",
      "img": "caminho/da/imagem.webp",
      "folder": "Poderes/Telecinese",
      "system": { }
    }
  ]
}
```

| Campo | Obrigatório | Observações |
|---|---|---|
| `format` | sim | sempre `"mmrpg-content"` |
| `version` | não | `1`. Versões maiores que a suportada são recusadas |
| `items[].type` | sim | `power`, `trait`, `tag`, `origin`, `occupation`, `weapon` ou `gear` |
| `items[].name` | sim | dois itens com o mesmo tipo e nome (sem diferenciar maiúsculas) são o mesmo item; vale o último do arquivo |
| `items[].img` | não | imagem do item |
| `items[].folder` | não | caminho de pastas separado por `/`; as pastas que faltarem são criadas |
| `items[].system` | não | campos do item (abaixo). O que faltar assume o valor padrão |

## Campos de `system` por tipo

Todos os tipos têm: `description` (HTML), `source` (texto livre, por exemplo livro e página) e `identifier` (texto livre).

| Tipo | Campos próprios |
|---|---|
| `power` | `powerSet`, `prerequisites`, `duration`, `range`, `level`, `actions` |
| `trait` | `restriction`, `multiple` |
| `tag` | `restriction`, `rarity`, `multiple` |
| `origin` | `examples`, `suggestedOccupation`, `limitation`, `minimumRank`, `grants` |
| `occupation` | `examples`, `grants` |
| `weapon` | `kind`, `category`, `range`, `reach`, `recommendedRank`, `quantity`, `equipped`, `actions` |
| `gear` | `category`, `price`, `quantity`, `equipped`, `actions` |

`powerSet` aceita as chaves do sistema (`basic`, `elementalControl`, `healing`, `illusion`, `luck`, `magic`, `martialArts`, `meleeWeapons`, `narrative`, `omniversalTravel`, `phasing`, `plasticity`, `powerControl`, `rangedWeapons`, `resize`, `shieldBearer`, `sixthSense`, `spiderPowers`, `superSpeed`, `superStrength`, `tactics`, `telekinesis`, `telepathy`, `teleportation`, `translation`, `weatherControl`) **ou qualquer outro texto** (vira um grupo próprio na ficha).

`weapon.kind` é `close` ou `ranged`.

### Concessões (`grants`) de origens e ocupações

Lista de itens que entram na ficha junto com a origem ou ocupação. Escreva por tipo e nome; a ligação é feita depois que todos os itens do arquivo existem:

```json
"grants": [
  { "type": "trait", "name": "Nome do traço" },
  { "type": "power", "name": "Nome do poder" }
]
```

Tipos aceitos: `trait`, `tag`, `power`. Um item que já existe na ficha (mesmo tipo e nome) não é criado de novo.

## Ações (`actions`)

Poderes, armas e equipamentos têm uma lista de ações. Todos os campos são opcionais; o que faltar assume o padrão.

```json
{
  "id": "ataque",
  "name": "Disparar",
  "activation": "attack",
  "description": "<p>Texto da ação.</p>",
  "target": { "type": "targets", "count": 1, "range": "texto livre", "distance": 0 },
  "area":   { "shape": "cone", "size": 20 },
  "roll":   { "mode": "attack", "ability": "agl", "kind": "ranged",
              "targetDefense": "agl", "difficulty": 0, "bonus": 0, "edge": "normal" },
  "damage": { "enabled": true, "ability": "", "multiplierBonus": 0, "flat": 0,
              "resource": "health", "element": "", "fantasticFactor": 2 },
  "healing": { "enabled": false, "mode": "marvel", "resource": "health",
               "target": "targets", "ability": "", "multiplierBonus": 0, "flat": 0 },
  "effects": [
    { "id": "lento", "name": "", "when": "hit", "target": "targets",
      "status": "slowed", "rounds": 2, "note": "",
      "changes": [ { "key": "system.abilities.mle.attackBonus", "type": "add", "value": "1" } ] }
  ],
  "cost": { "focus": 0, "karma": 0, "health": 0 },
  "uses": { "value": 3, "max": 3 }
}
```

| Campo | Valores |
|---|---|
| `id` | texto único dentro do item. Se faltar, o importador usa `a1`, `a2`… (estável entre importações, o que mantém macros funcionando) |
| `activation` | `attack`, `action`, `reaction`, `free`, `passive`, `other` |
| `target.type` | `targets` (alvos marcados), `self`, `area` |
| `target.count` | máximo de alvos (0 = sem limite) |
| `target.distance` | alcance em unidades da cena; ao exceder, só avisa (0 = não verifica) |
| `area.shape` | `circle`, `cone`, `ray`, `rect`; `area.size` em unidades da cena |
| `roll.mode` | `none`, `attack` (contra a defesa do alvo), `check` (contra `difficulty`) |
| `roll.ability` | `mle`, `agl`, `res`, `vig`, `ego`, `log`. Ataques usam os atributos de ataque (`mle`, `agl`, `ego`, `log`); testes aceitam qualquer um |
| `roll.kind` | `close`, `ranged`, `area` |
| `roll.targetDefense` | atributo cuja defesa o ataque enfrenta |
| `roll.edge` | `normal`, `edge`, `trouble` |
| `damage.ability` | vazio = o atributo da rolagem |
| `damage.resource` | `health` ou `focus` |
| `damage.element` | vazio, `air`, `earth`, `electricity`, `energy`, `fire`, `force`, `hellfire`, `ice`, `iron`, `sound`, `water`, `toxin`, `chemical`, `swarm` |
| `healing.mode` | `marvel` (usa o dado Marvel) ou `flat` (valor fixo em `flat`) |
| `healing.resource` | `health`, `focus`, `karma` |
| `healing.target` | `targets` ou `self` |
| `effects[].when` | `hit`, `miss`, `success`, `failure`, `fantastic`, `always` |
| `effects[].target` | `targets` ou `self` |
| `effects[].status` | vazio, `prone`, `slowed`, `stunned`, `blinded`, `burning`, `paralyzed`, `pinned`, `deafened`, `surprised`, `poisoned`, `corroding`, `frightened`, `dead` |
| `effects[].rounds` | duração em rodadas (0 = até remover à mão); só expira sozinho em combate |
| `effects[].changes[].key` | caminho do campo do ator (veja a tabela do README) |
| `effects[].changes[].type` | `add`, `multiply`, `override`, `upgrade`, `downgrade` |
| `uses` | `max` 0 = ilimitado. Se você informar só `max`, o importador começa com todos os usos |

Valores fora das listas acima fazem o Foundry recusar o item. A janela de importação não valida os campos de `system` a fundo; o relatório final lista os itens que falharam e o motivo.

## Dicas para montar o arquivo

- Comece com poucos itens e teste a importação antes de transcrever tudo.
- O texto do item (`description`) aceita HTML simples (`<p>`, `<strong>`, `<ul>`, `<li>`).
- Um poder que faz mais de uma coisa vira várias ações (por exemplo, "Disparar" e "Carregar"), cada uma com a sua rolagem e o seu custo.
- Bônus passivos (que valem o tempo todo) não cabem no JSON: crie-os na aba *Efeitos* da ficha do item, como efeito transferido ao ator. O arquivo importa as ações e os dados do item, não os efeitos do próprio item.
- Um script seu em Python ou Node que leia uma planilha e gere o JSON costuma ser mais seguro do que editar o JSON à mão.

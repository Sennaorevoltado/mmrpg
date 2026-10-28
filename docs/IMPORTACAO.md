# Importar e exportar conteúdo

O sistema **não inclui conteúdo dos livros**. Quem joga monta o próprio arquivo e o importa. O arquivo é um JSON simples; este guia descreve o formato. O arquivo [`examples/exemplo-conteudo.json`](../examples/exemplo-conteudo.json) é um exemplo completo com itens inventados.

> Se você traduziu ou transcreveu o conteúdo dos livros para uso pessoal, mantenha o arquivo só para você: não o publique junto com o sistema nem em repositório público.

## Como importar

1. Entre como GM.
2. Abra **Configurações → Configurar opções do sistema → Importar conteúdo**, ou use o botão **Importar conteúdo** no topo da aba *Itens* ou da aba *Compêndios*.
3. Escolha o `.json`. A janela mostra quantos itens de cada tipo foram lidos e lista erros e avisos.
4. Escolha o que fazer se já existir um item com o mesmo tipo e nome: **ignorar**, **atualizar o existente** ou **criar cópia**.
5. Escolha o **destino**: *Compêndios do mundo (um por tipo)* ou *Itens do mundo*. Veja a seção abaixo.
6. Clique em importar. Os itens vão para o destino escolhido, nas pastas indicadas no arquivo.

Erros do arquivo inteiro (JSON quebrado, formato ou versão errados) impedem a importação. Erros de um item (tipo inválido, nome ausente, ação que não é objeto…) aparecem em vermelho e **só aquele item é pulado**; os válidos continuam disponíveis. Concessões que apontam para itens inexistentes aparecem no relatório (o item é criado, a concessão fica sem ligação).

Para **exportar**: na mesma janela, escolha de onde exportar (itens do mundo ou compêndios do mundo), marque os tipos e clique em exportar. O arquivo sai no mesmo formato, com as concessões por tipo e nome (funcionam em outros mundos).

## Compêndios do mundo

Com o destino *Compêndios do mundo*, o importador cria **um compêndio por tipo**, só dos tipos que o arquivo tem, e coloca cada item no compêndio certo:

| Tipo | Compêndio | Nome interno |
|---|---|---|
| `power` | Poderes | `world.mmrpg-power` |
| `trait` | Traços | `world.mmrpg-trait` |
| `origin` | Origens | `world.mmrpg-origin` |
| `tag` | Tags | `world.mmrpg-tag` |
| `occupation` | Ocupações | `world.mmrpg-occupation` |
| `weapon` | Armas | `world.mmrpg-weapon` |
| `gear` | Equipamentos | `world.mmrpg-gear` |

- O campo `folder` do arquivo vira **pastas dentro do compêndio** (por exemplo, o conjunto de poderes). Dá para aninhar com `"Pasta/Subpasta"`.
- As **concessões** de Origens e Ocupações funcionam entre compêndios: uma Origem do compêndio de Origens concede itens dos compêndios de Traços e Poderes. Ao arrastar a Origem para uma ficha, os itens concedidos são criados nela.
- Importar de novo respeita a opção *ignorar / atualizar / criar cópia*, comparando tipo e nome.
- Compêndios são criados no **mundo** e ficam no mundo. Para usar em outro mundo, exporte e importe lá.
- Se um compêndio estiver bloqueado, o relatório avisa. Destrave-o (botão direito no compêndio) e importe de novo.
- Este recurso nunca vai dentro do sistema: o sistema continua sem conteúdo de livros.

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
| `items[].type` | sim | `power`, `trait`, `tag`, `origin`, `occupation`, `weapon`, `gear` ou `form` |
| `items[].name` | sim | dois itens com o mesmo tipo e nome (sem diferenciar maiúsculas) são o mesmo item; vale o último do arquivo |
| `items[].img` | não | imagem do item |
| `items[].folder` | não | caminho de pastas separado por `/`; as pastas que faltarem são criadas |
| `items[].system` | não | campos do item (abaixo). O que faltar assume o valor padrão |
| `items[].effects` | não | efeitos passivos do item (seção "Efeitos passivos"). Sem este campo, os efeitos já existentes não são tocados |

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
| `form` | `kind`, `borrowed`, `rank`, `carryDamage`, `portrait`, `token`, `changes`, `grants` (veja "Formas") |

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

Para concessões **qualificadas** (por exemplo, "Conexões: Criminal" ou "Fraqueza: Prata"), use o campo opcional `note`:

```json
"grants": [
  { "type": "trait", "name": "Connections", "note": "Criminal" },
  { "type": "trait", "name": "Connections", "note": "Polícia" }
]
```

Cada concessão com `note` cria na ficha uma cópia do item com o nome `Nome: observação` (ex.: `Connections: Criminal`). Duas observações diferentes geram dois itens; receber a mesma origem de novo não duplica. A exportação mantém o `note`.

## Efeitos passivos (`effects`)

Para bônus que valem enquanto o item estiver na ficha (por exemplo, um poder que aumenta a defesa), o item pode trazer Active Effects. Eles são criados como efeitos do item, transferidos para o personagem.

```json
"effects": [
  {
    "name": "Pele Resistente",
    "changes": [
      { "key": "system.health.reduction", "type": "upgrade", "value": 2 }
    ]
  }
]
```

| Campo | Observações |
|---|---|
| `name` | opcional; se faltar, usa o nome do item |
| `img` | opcional; se faltar, usa a imagem do item ou um ícone padrão |
| `transfer` | padrão `true` (o efeito vai para o personagem que possui o item) |
| `disabled` | padrão `false` |
| `changes[].key` | campo do personagem, por exemplo `system.abilities.mle.attackBonus` |
| `changes[].type` | `add` (padrão), `multiply`, `override`, `upgrade` ou `downgrade`. `upgrade` fica com o maior valor: serve para poderes numerados que não se acumulam |
| `changes[].value` | valor da alteração |
| `changes[].priority` | opcional (número inteiro): ordem de aplicação, do menor para o maior. Sem ele vale o padrão do Foundry (multiply 10, add 20, downgrade 30, upgrade 40, override 50). Serve para um efeito de `override` vencer outro |

Chaves úteis: `system.abilities.<hab>.(attackBonus|defenseBonus|damageBonus|noncomBonus|multiplierBonus)` (`mle`, `agl`, `res`, `vig`, `ego`, `log`), `system.health.reduction`, `system.focus.reduction` e `system.movement.<tipo>.bonus`.

Reimportar com "atualizar" troca apenas os efeitos que a importação criou; efeitos feitos à mão no item ficam. A exportação devolve os efeitos no mesmo formato.

## Formas (`form`): armaduras, transformações e formas alternativas

Uma forma é um item que mora na ficha e se liga e desliga na aba **Formas**. Enquanto está ativa, ela:

- aplica as **alterações** (`changes`) e o **Rank** à ficha, por um efeito que o próprio personagem cria e remove;
- cria na ficha os itens **concedidos** (`grants`: poderes, traços e tags) e os remove ao desativar;
- troca a imagem da ficha (`portrait`) e do token (`token`), se preenchidas;
- faz o **dano acompanhar o corpo** (`carryDamage`, padrão ligado): se a forma muda a Saúde ou o Foco máximos, o dano que o personagem já levou continua o mesmo.

Só uma forma de cada categoria (`kind`) fica ativa por vez; categorias diferentes convivem (por exemplo, uma armadura e uma transformação).

```json
{
  "type": "form",
  "name": "Armadura Exemplo",
  "folder": "Formas/Armaduras",
  "system": {
    "kind": "suit",
    "borrowed": false,
    "rank": { "mode": "set", "value": 4 },
    "carryDamage": true,
    "changes": [
      { "key": "system.abilities.mle.value", "type": "upgrade", "value": "8" },
      { "key": "system.health.max", "type": "add", "value": "20" }
    ],
    "grants": [
      { "type": "power", "name": "Flight 2" },
      { "type": "trait", "name": "Tech Reliance" }
    ]
  }
}
```

| Campo | Observações |
|---|---|
| `kind` | `suit` (armadura), `transformation` (transformação) ou `alternate` (forma alternativa) |
| `borrowed` | `true` = emprestada: concede os itens, mas **não** altera Rank nem valores da ficha (quem veste usa o próprio Rank) |
| `rank.mode` | `none` (não altera), `set` (o Rank passa a valer **pelo menos** `value`) ou `add` (soma `value`). O `set` vale antes dos `add`, em qualquer ordem de ativação |
| `rank.value` | número inteiro |
| `changes[]` | mesmo formato das alterações de efeito: `key` (campo do personagem), `type` (`add`, `multiply`, `override`, `upgrade`, `downgrade`), `value` e `priority` opcional. As chaves são as mesmas dos efeitos passivos |
| `grants[]` | igual ao de origens e ocupações (`type`, `name`, `note` opcional). Se o personagem já tem um item com o mesmo nome e tipo, ele não é duplicado e continua com o personagem ao desativar a forma |
| `portrait`, `token` | caminhos de imagem; vazios = não troca |
| `carryDamage` | padrão `true` |

Uma forma importada **nunca chega ativa**, mesmo que o arquivo diga `"active": true`. O validador (`npm run check:content`) confere as chaves de `changes` como faz com os efeitos passivos.

Observações:

- **Rank efetivo.** O campo de Rank da ficha continua sendo o Rank base; o Rank com as formas ativas aparece ao lado e é o que vale para multiplicador de dano, deslocamento por Rank e fórmulas.
- **Pontos de atributo e Karma ganhos** com um Rank novo não são distribuídos sozinhos: ponha-os em `changes` (por exemplo, `system.abilities.mle.value` com `add`) ou ajuste à mão.
- **Editar uma forma ativa** reaplica o efeito, as concessões e as imagens sozinho.
- **Apagar uma forma ativa** desliga-a antes (concessões, efeito e imagens saem da ficha).
- A configuração do mundo *Anunciar trocas de forma no chat* controla a mensagem postada ao ativar ou desativar.
- Para macros: `game.mmrpg.setForm(ator, "Nome da forma ou id", true)`.

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
              "resource": "health", "element": "", "fantasticFactor": 2, "scale": 1,
              "when": "hit", "perFocus": 0 },
  "healing": { "enabled": false, "mode": "marvel", "resource": "health",
               "target": "targets", "ability": "", "multiplierBonus": 0, "flat": 0, "perFocus": 0 },
  "effects": [
    { "id": "lento", "name": "", "when": "hit", "target": "targets",
      "status": "slowed", "rounds": 2, "note": "",
      "changes": [ { "key": "system.abilities.mle.attackBonus", "type": "add", "value": "1" } ] }
  ],
  "cost": { "focus": 0, "karma": 0, "health": 0, "scalable": false },
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
| `roll.mode` | `none`, `attack` (contra a defesa do alvo), `check` (contra `difficulty`; com `difficulty` 0 o cartão mostra só o resultado, sem acerto/erro) |
| `roll.ability` | `mle`, `agl`, `res`, `vig`, `ego`, `log`. Ataques usam os atributos de ataque (`mle`, `agl`, `ego`, `log`); testes aceitam qualquer um |
| `roll.kind` | `close`, `ranged`, `area` |
| `roll.targetDefense` | atributo cuja defesa o ataque enfrenta |
| `roll.edge` | `normal`, `edge`, `trouble` |
| `damage.ability` | vazio = o atributo da rolagem |
| `damage.resource` | `health` ou `focus` |
| `damage.scale` | fração do dano em qualquer acerto: `1` (padrão) = inteiro, `0.5` = metade. O Fantástico multiplica por cima (metade × 2 = dano inteiro) |
| `damage.element` | vazio, `air`, `earth`, `electricity`, `energy`, `fire`, `force`, `hellfire`, `ice`, `iron`, `sound`, `water`, `toxin`, `chemical`, `swarm` |
| `damage.when` | `hit` (padrão, qualquer acerto) ou `fantastic` (dano só no Sucesso Fantástico) |
| `damage.reductionFrom` | vazio (a Redução do recurso atingido), `health` ou `focus`. Ex.: dano ao Foco que usa a Redução de Dano à Saúde do alvo |
| `damage.ignoreReduction` | `true` quando o dano ignora a Redução de Dano do alvo |
| `damage.perFocus` | dano fixo somado por ponto de Foco gasto (`0.5` = +1 a cada 2 pontos). Vale com `cost.scalable` |
| `healing.perFocus` | cura fixa somada por ponto de Foco gasto (`1` = 1 de cura por Foco). Vale com `cost.scalable` |
| `cost.scalable` | `true` quando o `cost.focus` é só o mínimo ("5 ou mais de Foco"): ao usar a ação, abre a pergunta de quanto Foco gastar (Shift gasta o mínimo) |
| `healing.mode` | `marvel` (usa o dado Marvel) ou `flat` (valor fixo em `flat`; se `healing.ability` estiver preenchido, soma também a pontuação desse atributo) |
| `healing.resource` | `health`, `focus`, `karma` |
| `healing.target` | `targets` ou `self` |
| `effects[].when` | `hit`, `miss`, `success`, `failure`, `fantastic`, `always` |
| `effects[].target` | `targets` ou `self` |
| `effects[].status` | vazio, `prone`, `slowed`, `stunned`, `blinded`, `burning`, `paralyzed`, `pinned`, `deafened`, `surprised`, `poisoned`, `corroding`, `frightened`, `bleeding`, `grabbed`, `demoralized`, `unconscious`, `shattered`, `dead` |
| `effects[].rounds` | duração em rodadas (0 = até remover à mão); só expira sozinho em combate |
| `effects[].changes[].key` | caminho do campo do ator (veja a tabela do README) |
| `effects[].changes[].type` | `add`, `multiply`, `override`, `upgrade`, `downgrade` |
| `uses` | `max` 0 = ilimitado. Se você informar só `max`, o importador começa com todos os usos |

Valores fora das listas acima fazem o Foundry recusar o item. A janela de importação não valida os campos de `system` a fundo; o relatório final lista os itens que falharam e o motivo.

## Dicas para montar o arquivo

- Comece com poucos itens e teste a importação antes de transcrever tudo.
- O texto do item (`description`) aceita HTML simples (`<p>`, `<strong>`, `<ul>`, `<li>`).
- Um poder que faz mais de uma coisa vira várias ações (por exemplo, "Disparar" e "Carregar"), cada uma com a sua rolagem e o seu custo.
- Bônus passivos (que valem o tempo todo) vão em `effects` no próprio item (veja "Efeitos passivos"); bônus que só valem depois de usar o poder vão em `effects` da ação.
- Um script seu em Python ou Node que leia uma planilha e gere o JSON costuma ser mais seguro do que editar o JSON à mão.

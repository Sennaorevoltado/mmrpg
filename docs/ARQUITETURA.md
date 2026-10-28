# Arquitetura

Princípio central (o mesmo do *Gaia: Prelúdio*): **separar as regras do restante do código** e **definir os documentos antes da interface**. Isso permite testar as regras sem o Foundry e trocar a interface sem tocar nelas.

```
module/
  rules/        regras puras do jogo, sem Foundry (testadas com node:test)
  data/         modelos de dados (TypeDataModel / DataModel) de atores, itens e ações
  documents/    classes Actor, Item e Combatant (comportamento sobre os dados)
  dice/         dado Marvel e rolagem d616 (ligam as regras puras aos dados do Foundry)
  actions/      motor de ações: do clique ao cartão de chat e à aplicação do resultado
  apps/         janelas (ApplicationV2): fichas, editor de ação, importador, manobra de equipe
  helpers/      handlebars, configurações, status, combate, macros, socket, importação, compêndios, compatibilidade v13/v14
  config.mjs    CONFIG.MMRPG: listas e chaves (nenhum texto de livro)
  mmrpg.mjs     ponto de entrada: registra tudo nos hooks init/ready
templates/      Handlebars (fichas, itens, cartões de chat, diálogos)
lang/           pt-BR.json e en.json (todos os textos da interface)
tests/          regras puras, formato de importação e integração no Foundry simulado
scripts/        validate.mjs (checagens estáticas) e package.mjs (zip)
```

## 1. Regras puras (`module/rules`)

Funções que recebem e devolvem objetos simples. Nada de `game`, `foundry` ou documentos.

| Arquivo | Conteúdo |
|---|---|
| `d616.mjs` | valor contado de cada face, Fantástico, Ultimate, soma, Edge/Trouble (`applyReroll`, `autoRerollIndex`, `combineEdgeModes`), `buildFormula` |
| `abilities.mjs` | chaves dos atributos, defesa, bônus fora de combate, multiplicador, iniciativa |
| `damage.mjs` | dano, redução, aplicação em reservas (`damagePool`, `healPool`) |
| `movement.mjs` | deslocamento por tipo e modo de cálculo |
| `forms.mjs` | formas: alterações que uma forma aplica (`formChanges`, com o Rank "pelo menos" antes das somas) e o valor das reservas depois que o máximo muda (`carryPoolValue`) |
| `resolve.mjs` | `resolveAction`: dados da ação + rolagem + atacante + alvos → resultado por alvo (acerto, margem, dano, cura, efeitos) |

`resolveAction` é o coração do motor: o cartão do chat **nunca guarda o resultado**, só os dados de entrada, e recalcula tudo quando precisa (re-rolagem, aplicação).

## 2. Dados (`module/data`)

- `ActorBase` (→ `CharacterData`, `NpcData`): atributos, reservas, movimento, detalhes. O que é *calculado* (defesa, ataque, multiplicador, iniciativa, deslocamento) é preenchido em `prepareDerivedData` e nunca gravado. O que é *gravado* tem um campo "bônus" que Active Effects podem alterar.
- `ItemBase` → `ActionItemBase` (→ `PowerData`, `WeaponData`, `GearData`) com `actions`; `TraitData`, `TagData`, `OriginData`, `OccupationData` sem ações. Origem e ocupação têm `grants` (itens concedidos).
- `ActionData`: o modelo de uma ação (veja docs/IMPORTACAO.md para os campos). É um `DataModel` embutido num `ArrayField`.

Regra prática: arrays de ações e efeitos são atualizados **inteiros** (`item.update({"system.actions": [...]})`), pois o Foundry não atualiza um índice isolado de um array.

## 3. Motor de ações (`module/actions`)

```
useAction (executor)
  availabilityProblem / payCost (cost)      usos e recursos
  collectTargets (executor)                 tokens marcados -> snapshot (defesas, redução)
  promptRollConfig (roll-config)            Edge/Trouble, bônus, visibilidade
  D616Roll.build + evaluate                rolagem
  makeCard + postCard (card)                cartão com tudo em flags da mensagem
requestApply (apply)  --socket-->  GM ativo executeApply
  relê o cartão da mensagem, recalcula com resolveAction, aplica dano/cura/efeitos,
  marca o que já foi aplicado e reescreve o cartão
```

Decisões que importam:

- **O pedido ao GM leva só o id da mensagem e o escopo.** O GM relê o cartão gravado e recalcula, então um jogador não consegue escolher quantidades (`apply.mjs`).
- **O cartão é regerado, não editado.** `renderCard(card, roll)` sempre parte dos dados guardados; `card.applied` evita aplicar duas vezes.
- **Snapshots** (`snapshots.mjs`) convertem atores em objetos simples para `resolveAction`. É o único ponto que conhece os dois mundos.
- **Efeitos temporários** são Active Effects criados por `Actor#applyActionEffect`. A expiração por rodadas é controlada pelo próprio sistema (flags `mmrpg.expires` + hook `updateCombat` em `helpers/combat.mjs`), sem depender do formato de duração do core.

## 4. Fichas e janelas (`module/apps`)

- `ActorSheetV2` / `ItemSheetV2` + `HandlebarsApplicationMixin`. Cada ficha monta um contexto em `_prepareContext`; os templates não fazem contas.
- As abas são trocadas pelo próprio sistema (classe `active`), sem o sistema de abas do core, para não depender de detalhes da API.
- Ações dos botões usam `data-action` + `DEFAULT_OPTIONS.actions`. O validador confere que todo `data-action` de um template tem manipulador e vice-versa.
- O editor de ação lê o item, aplica o formulário numa cópia da ação e grava o array inteiro.

## 5. Formas

Uma **forma** (`FormData`, item `form`) é uma armadura, transformação ou forma alternativa que mora na ficha e se liga e desliga. Quem manda é o ator: `Actor#setFormActive(forma, ativa)`.

```
setFormActive (fila: uma troca por vez por personagem)
  desliga a forma ativa da mesma categoria
  remove o efeito e as concessões da forma (limpeza idempotente)
  grava system.active na forma
  ativando: cria UM Active Effect no ator (origin = a forma, flag mmrpg.formId) com formChanges(),
            e cria os itens concedidos (flag mmrpg.grantedBy = id da forma; ignora o que já existe)
  desativando: recria as concessões das outras formas ativas que dependiam dos mesmos itens
  carryPoolValue: ajusta Saúde e Foco atuais ao novo máximo
  troca ou restaura retrato e token (original guardado em flags.mmrpg.formBase)
  posta a mensagem no chat (configuração announceForms)
```

Decisões que importam:

- **O efeito é do ator, não da forma.** As alterações ficam em `system.changes` (dados da própria forma) e viram um Active Effect no ator só enquanto a forma está ativa. Assim não dependemos de efeitos transferidos de itens (que valem sempre) nem de suprimir efeitos; a forma em compêndio ou fora da ficha nunca afeta ninguém.
- **Cópias nunca chegam ativas** (`MMRPGItem#_preCreate`). Arrastar uma forma ativa para outra ficha cria uma forma desligada.
- **Editar ou apagar uma forma ativa** é tratado: `helpers/forms.mjs` (gancho `updateItem`) chama `Actor#refreshForm`, e `MMRPGItem#_preDelete` desliga antes de apagar.
- **Rank efetivo** vem do efeito sobre `system.rank`; a ficha edita `_source.system.rank` e mostra o efetivo ao lado.
- **Imagens** são trocadas com `actor.update` e `TokenDocument#update`, dentro de `try/catch`: se falhar, a forma ativa mesmo assim.

## 6. Testes

| Arquivo | O que cobre |
|---|---|
| `tests/rules.test.mjs` | regras puras: d616, Edge/Trouble, defesa, dano, cura, deslocamento, `resolveAction`, formas |
| `tests/content.test.mjs` | formato de importação (validação, concessões, ids estáveis) |
| `tests/foundry.test.mjs` | o sistema carregado num Foundry simulado (`tests/support/foundry-stub.mjs`) |

O Foundry simulado implementa só o necessário: campos de dados com validação **estrita** (valores iniciais e opções inválidos falham), documentos com itens embutidos e efeitos, `Roll` com dados sorteados de forma controlável (`dice.queue`), `ApplicationV2` + Handlebars de verdade, hooks, configurações e socket. Quando um teste falha por causa do simulado e não do sistema, ajuste o simulado; quando passa, isso **não prova** que o Foundry real se comporta igual.

`scripts/validate.mjs` faz as checagens estáticas e roda dentro do `npm run check`.

## 7. Como estender

**Novo tipo de item**
1. Crie o modelo em `module/data/` e exporte em `_module.mjs`.
2. Registre em `system.json` (`documentTypes.Item`) e em `mmrpg.mjs` (`CONFIG.Item.dataModels`).
3. Se tem ações, herde de `ActionItemBase` e inclua o tipo em `MMRPG.actionItemTypes`.
4. Adicione `templates/item/details-<tipo>.hbs`, o rótulo em `lang/*.json` (`TYPES.Item.<tipo>`) e o tipo em `ITEM_TYPES` (`content-format.mjs`).
5. `npm run check`.

**Novo campo em ações**
1. `module/data/action.mjs` (esquema) e, se afeta o resultado, `module/rules/resolve.mjs` com teste em `tests/rules.test.mjs`.
2. Campo no `templates/apps/action-editor.hbs` e textos em `lang/*.json`.
3. Se aparece no cartão, `actions/card.mjs` (`buildContext`) e `templates/chat/action-card.hbs`.

**Nova condição**: acrescente em `MMRPG.statuses` e o texto `MMRPG.Status.<id>` nos dois idiomas.

**Textos**: toda string da interface vai em `lang/*.json`, com as mesmas chaves nos dois arquivos (o validador confere). Sem emojis na interface.

## 8. Limites conhecidos

- Escrito e testado sem um Foundry real, v14 ou v13 (veja o README).
- Gabarito de área: posicionado no token do atacante, sem interação.
- Efeitos "desde o começo/fim do turno" não são automatizados: use duração em rodadas ou remova à mão.
- A compatibilidade declarada é `minimum: 13`. Nenhuma versão foi marcada como *verificada* no manifesto, porque nenhuma foi aberta num Foundry real.
- As diferenças entre v13 e v14 ficam em `module/helpers/compat.mjs` (modo de mensagem, registro de fichas, helpers de Handlebars). Código novo que dependa da versão deve passar por ali, e `tests/foundry-v13.test.mjs` roda a bateria de integração com o simulador na geração 13.
- Formas: a troca de retrato e token nunca foi testada num Foundry real. Se o personagem trocar o retrato à mão enquanto uma forma com imagem estiver ativa, ao desativar volta o retrato guardado na primeira troca. Pontos de atributo e Karma ganhos com um Rank novo não são distribuídos sozinhos (use `changes` ou ajuste à mão).

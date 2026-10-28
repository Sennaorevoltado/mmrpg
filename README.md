# Marvel Multiverse RPG (não oficial) para Foundry VTT

Sistema de fã para jogar **Marvel Multiverse RPG** no Foundry VTT **v14** (alvo principal) e **v13** (experimental). Foi organizado a partir da ideia de que *quase todo poder é um ataque ou um teste de atributo que aplica dano ou um efeito*: cada poder, arma ou equipamento carrega uma **lista de ações**, e cada ação descreve sozinha a rolagem, o dano/cura, os efeitos e o custo.

> **Este sistema não traz conteúdo dos livros.** Não há poderes, traços, tags, origens ou ocupações prontos. Você cria o seu material ou **importa um arquivo seu** (veja [docs/IMPORTACAO.md](docs/IMPORTACAO.md)). O arquivo [examples/exemplo-conteudo.json](examples/exemplo-conteudo.json) é inventado e só mostra o formato.

Projeto não oficial, sem vínculo com a Marvel, a Disney ou a Foundry Gaming. Créditos e licenças em [NOTICE](NOTICE).

## Estado do projeto: leia antes de usar

Este sistema foi escrito **sem acesso a um Foundry de verdade, nem v14 nem v13**. O que foi feito para reduzir o risco:

- Mais de 160 testes automáticos (`npm test`): regras do d616, formato de importação e um **Foundry simulado** que carrega o sistema inteiro, usa ações, posta e aplica cartões, renderiza fichas e janelas. A bateria roda duas vezes, uma com o simulador na geração 14 e outra na 13.
- Um validador estático (`npm run validate`): confere o manifesto, a sintaxe, os templates, as ligações `data-action` ↔ código, as traduções e a ausência de emojis.

Isso pega erros de código e de dados, mas **não substitui um teste num mundo real**. A primeira rodada de testes no Foundry, na ordem:

1. Criar um mundo, ativar o sistema e olhar o console (F12) por erros ao carregar.
2. Criar um Personagem e um NPC; abrir as fichas; editar atributos e recursos.
3. Criar um Poder, abrir o **editor de ação**, usar a ação com um alvo marcado (tecla T) e conferir o cartão no chat.
4. Clicar em **Aplicar** como GM e depois como jogador (o pedido passa pelo GM via socket).
5. Rolar com Edge/Trouble e usar o botão de re-rolar um dado.
6. Importar o arquivo de exemplo e arrastar a Origem de exemplo para uma ficha.
7. Iniciar um combate, rolar iniciativa e aplicar um efeito de 2 rodadas.
8. Criar uma **Forma** (aba Formas → adicionar armadura), pôr Rank, uma alteração (por exemplo `system.health.max`, soma 20) e um poder concedido; ativar e desativar com a ficha e o token abertos; conferir Rank efetivo, Saúde, itens e o anúncio no chat.

Se algo quebrar, o erro do console e o passo em que aconteceu bastam para corrigir.

### Foundry v13 (experimental)

O manifesto declara `minimum: 13`. As diferenças de API entre as duas versões estão concentradas em [module/helpers/compat.mjs](module/helpers/compat.mjs):

| Assunto | v14 | v13 |
|---|---|---|
| Visibilidade das mensagens (público, GM, cego, privado) | `messageMode` | `rollMode` (`publicroll`, `gmroll`, `blindroll`, `selfroll`) |
| Registro de fichas | coleções (`Actors.registerSheet`) | `DocumentSheetConfig`; a ficha padrão do núcleo é a antiga (AppV1) e também é retirada |
| Gabarito de área | Região | Gabarito clássico (`MeasuredTemplate`) |
| Modificações de efeito | `type` | `mode` numérico (o sistema grava os dois) |

Os pontos abaixo só um teste real confirma, tanto na v13 quanto na v14: arrastar itens da barra lateral para a ficha, a aparência (CSS) das fichas e janelas, e o comportamento das durações de efeito. Se você usa só a v14, nada muda para você.

## Instalação

**Por pasta (mais simples para testar):** copie esta pasta inteira para `Data/systems/mmrpg` do seu Foundry e reinicie. O nome da pasta precisa ser `mmrpg`.

**Por zip:** rode `npm run package` e extraia `dist/mmrpg-<versão>.zip` em `Data/systems/mmrpg`.

**Por URL de manifesto:** depois de publicar o projeto no GitHub e criar uma tag (`git tag v0.3.0 && git push --tags`), o workflow em `.github/workflows/release.yml` gera o release com `system.json` e o zip. A URL a colar em *Instalar sistema* é
`https://github.com/<usuário>/<repositório>/releases/latest/download/system.json`.

## O que o sistema faz

**Mecânica do d616**
- Rolagem `1d6 + dado Marvel + 1d6 + modificador`. A face 1 do dado Marvel aparece como **M**, conta 6 e é um resultado **Fantástico**. Dois 6 com o M formam um **Ultimate**.
- **Edge / Trouble**: re-rola um dado e mantém o melhor / o pior. Marque na ficha (por atributo ou na iniciativa), na ação ou no diálogo de rolagem. Edge e Trouble juntos se anulam. No chat há um botão para escolher o dado a re-rolar.
- Defesa = 10 + atributo (mais bônus). Acerta quem iguala ou supera a defesa; o Fantástico acerta sempre.
- Dano = valor do dado Marvel × (multiplicador − redução do alvo) + atributo; o Fantástico multiplica o dano (fator configurável por ação). Cada ação ainda pode reduzir o dano por **escala** (por exemplo, metade no acerto comum e cheio no Fantástico), dar dano **só no Fantástico**, **ignorar a redução** do alvo ou usar a redução de outro recurso.
- Iniciativa = d616 + Vigilância (mais bônus), com Edge/Trouble automáticos.

**Ações (o centro do sistema)**
- Cada item de poder, arma ou equipamento tem uma lista de ações.
- Uma ação define: ativação; alvo (marcados, si mesmo ou área, com alcance e gabarito); rolagem (nenhuma, **ataque** contra uma defesa ou **teste** contra dificuldade fixa); **dano** (atributo, bônus, recurso atingido, elemento); **cura** (pelo dado Marvel ou valor fixo; Saúde, Foco ou Karma); **efeitos** (condição e/ou modificações de Active Effect, com gatilho e duração em rodadas); **custo** (Foco, Karma, Saúde; o Foco pode ser **escalável**, com o jogador escolhendo quanto gastar e o dano ou a cura crescendo por Foco) e **usos limitados**.
- O **cartão de chat** mostra a rolagem, a defesa de cada alvo, acerto/erro, dano calculado (com a conta à mostra), cura e efeitos. Botões: aplicar por alvo, só dano, só efeitos, em si mesmo, aplicar tudo, re-rolar um dado, posicionar o gabarito de área no mapa.
- Jogadores aplicam resultados em atores que não são deles **pedindo ao GM ativo** (socket). O GM relê o cartão gravado na mensagem e recalcula os valores: o jogador não escolhe quantidades.
- Opção de mundo **Aplicar resultados automaticamente** para quem prefere não clicar.

**Fichas e dados**
- Personagem e NPC: seis atributos (defesa, ataque, bônus fora de combate e multiplicador calculados), Saúde, Foco e Karma, redução de dano, iniciativa, movimento (corrida, escalada, natação, voo, etc., cada um com modo de cálculo: fixo, metade, cheio, dobro, triplo, Rank ou corrida × Rank), tamanho, detalhes, biografia.
- Abas: principal, poderes (agrupados por conjunto de poder), traços e tags, equipamentos, modificadores, efeitos, biografia.
- Itens: poder, traço, tag, origem, ocupação, arma, equipamento e **forma**. **Origens e ocupações concedem itens**: ao entrar na ficha, criam os itens ligados.
- **Efeitos passivos nos itens**: um poder numerado (Mighty, Sturdy, Flight…) pode trazer Active Effects que valem enquanto ele estiver na ficha e ajustam atributos, redução de dano, movimento e outros campos. Poderes com vários níveis usam `upgrade`, então vale só o maior.
- 17 condições + derrotado como status effects do Foundry. NPC chega a 0 de Saúde → derrotado (opção de mundo).
- Efeitos com duração em rodadas expiram sozinhos quando o combate chega à rodada certa, e somem quando o combate termina.
- **Manobra de equipe**: janela que cobra o Foco de cada integrante selecionado e posta um cartão. O texto das regras da manobra não está incluído.
- Macros: arraste uma ação da ficha para a barra de atalhos.

**Formas (armaduras, transformações, formas alternativas)**
- Aba **Formas** na ficha de personagem e de NPC, com um botão Ativar/Desativar por forma. Só uma forma de cada categoria fica ativa; armadura e transformação podem estar ativas juntas.
- Ativar aplica, de uma vez: **Rank** (pelo menos X, ou somando X), **alterações em qualquer campo da ficha** (atributos, Saúde e Foco máximos, redução, movimento…), **itens concedidos** (poderes, traços e tags, que saem ao desativar) e, se a forma tiver, **imagem da ficha e do token**.
- O **dano sofrido acompanha o corpo**: se a forma muda a Saúde ou o Foco máximos, o dano que o personagem já levou continua o mesmo ao entrar e ao sair da forma.
- Armadura **emprestada**: concede os itens, mas não mexe em Rank nem em valores (quem veste usa o próprio Rank).
- O cabeçalho mostra as formas ativas e o **Rank efetivo** ao lado do Rank base. A troca é anunciada no chat (configuração do mundo).
- Detalhes e formato de importação: [docs/IMPORTACAO.md](docs/IMPORTACAO.md#formas-form-armaduras-transformações-e-formas-alternativas).

**Importar/exportar**: janela *Importar conteúdo* (menu de configurações do sistema e botão no diretório de itens) para o seu próprio JSON. Pode importar para os **itens do mundo** ou para **compêndios do mundo**, um por tipo (poderes, traços, origens, tags, ocupações, armas, equipamentos, formas), e exporta no mesmo formato.

## Primeiros passos

1. **Crie um Personagem**, preencha os atributos e o Rank. *Saúde e Foco máximos são digitados na ficha* (o sistema não os calcula por fórmula). Os modificadores fixos ficam na aba de modificadores.
2. **Crie um Poder** (aba de poderes → adicionar). Na ficha do item, aba *Ações* → adicionar ação → abre o editor. Ajuste e feche; o editor salva a cada alteração.
3. **Use a ação**: clique no ícone da ação na ficha (Shift pula o diálogo e rola direto). Marque alvos antes com a tecla T.
4. **Aplique** pelo cartão de chat.
5. Para um **ataque simples** com arma: crie uma Arma; ela já vem com uma ação de ataque em branco.

### Modificar valores com Active Effects

Nas modificações de um efeito (ou nos efeitos da ficha), a chave aponta para um campo do ator. As mais úteis:

| Chave | Efeito |
|---|---|
| `system.abilities.<atributo>.attackBonus` | bônus de ataque do atributo |
| `system.abilities.<atributo>.defenseBonus` | bônus de defesa |
| `system.abilities.<atributo>.damageBonus` | bônus fixo de dano |
| `system.abilities.<atributo>.noncomBonus` | bônus fora de combate |
| `system.abilities.<atributo>.multiplierBonus` | bônus no multiplicador |
| `system.init.bonus` | bônus de iniciativa |
| `system.health.reduction` / `system.focus.reduction` | redução de dano |
| `system.movement.<tipo>.bonus` | bônus de deslocamento |

Atributos: `mle`, `agl`, `res`, `vig`, `ego`, `log`.

### API para macros

```js
game.mmrpg.useItem(uuidDoItem, idDaAcao, { fastForward: true });  // usa uma ação
game.mmrpg.rollAbility("mle");                                      // teste para os tokens selecionados
game.mmrpg.rollActorAbility(ator, "vig", { kind: "attack" });       // teste de um ator
game.mmrpg.openImporter();                                          // janela de importação
game.mmrpg.openTeamManeuver(ator);                                  // manobra de equipe
game.mmrpg.setForm(ator, "Armadura Mark VII", true);         // liga (true) ou desliga (false) uma forma pelo nome ou id
```

## Rótulos em português

Todos os textos da interface estão em [lang/pt-BR.json](lang/pt-BR.json) (e `en.json`). Os termos foram escolhidos sem acesso a um glossário oficial; **alinhe-os ao seu glossário** editando esse arquivo, sem mexer em código. O validador garante que os dois idiomas continuem com as mesmas chaves.

## O que não está implementado de propósito

- **Tamanho** é só um rótulo: o sistema não aplica bônus numéricos, para não inventar valores. Use os modificadores.
- **Saúde/Foco máximos** são manuais.
- **Formas**: o Rank sobe, mas os pontos de atributo e o Karma que um Rank novo dá não são distribuídos sozinhos; ponha-os nas alterações da forma ou ajuste à mão. A troca de retrato e token é opcional e só um teste real confirma.
- **Texto de regras** de poderes, traços, manobras de equipe, etc.: nada é distribuído.
- Gabaritos de área são posicionados no token do atacante, sem arrastar. Tamanhos de área e alcances são lidos em **casas**: configure a grade da cena com 1 unidade por casa.
- Sem compêndios pré-montados no repositório. Quem tem o texto dos livros monta o próprio arquivo e importa.

## Desenvolvimento

```bash
npm install          # só para o handlebars, usado nos testes e no validador
npm test             # regras puras + Foundry simulado
npm run validate     # checagens estáticas
npm run check        # os dois
npm run package      # gera dist/mmrpg-<versão>.zip
```

Como o código está organizado e como estender: [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## Licença

MIT (veja [LICENSE](LICENSE)). O projeto se apoia em duas obras MIT, creditadas em [NOTICE](NOTICE): *Gaia: Prelúdio* (LPfontes) e o sistema comunitário *marvel-multiverse*.

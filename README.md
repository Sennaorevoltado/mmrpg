# Marvel Multiverse RPG (não oficial) para Foundry VTT v14

Sistema de fã para jogar **Marvel Multiverse RPG** no Foundry VTT v14. Foi organizado a partir da ideia de que *quase todo poder é um ataque ou um teste de atributo que aplica dano ou um efeito*: cada poder, arma ou equipamento carrega uma **lista de ações**, e cada ação descreve sozinha a rolagem, o dano/cura, os efeitos e o custo.

> **Este sistema não traz conteúdo dos livros.** Não há poderes, traços, tags, origens ou ocupações prontos. Você cria o seu material ou **importa um arquivo seu** (veja [docs/IMPORTACAO.md](docs/IMPORTACAO.md)). O arquivo [examples/exemplo-conteudo.json](examples/exemplo-conteudo.json) é inventado e só mostra o formato.

Projeto não oficial, sem vínculo com a Marvel, a Disney ou a Foundry Gaming. Créditos e licenças em [NOTICE](NOTICE).

## Estado do projeto: leia antes de usar

Este sistema foi escrito **sem acesso a um Foundry v14 de verdade**. O que foi feito para reduzir o risco:

- Mais de 70 testes automáticos (`npm test`): regras do d616, formato de importação e um **Foundry simulado** que carrega o sistema inteiro, usa ações, posta e aplica cartões, renderiza fichas e janelas.
- Um validador estático (`npm run validate`): confere o manifesto, a sintaxe, os templates, as ligações `data-action` ↔ código, as traduções e a ausência de emojis.

Isso pega erros de código e de dados, mas **não substitui um teste num mundo real**. A primeira rodada de testes no Foundry, na ordem:

1. Criar um mundo v14, ativar o sistema e olhar o console (F12) por erros ao carregar.
2. Criar um Personagem e um NPC; abrir as fichas; editar atributos e recursos.
3. Criar um Poder, abrir o **editor de ação**, usar a ação com um alvo marcado (tecla T) e conferir o cartão no chat.
4. Clicar em **Aplicar** como GM e depois como jogador (o pedido passa pelo GM via socket).
5. Rolar com Edge/Trouble e usar o botão de re-rolar um dado.
6. Importar o arquivo de exemplo e arrastar a Origem de exemplo para uma ficha.
7. Iniciar um combate, rolar iniciativa e aplicar um efeito de 2 rodadas.

Se algo quebrar, o erro do console e o passo em que aconteceu bastam para corrigir.

## Instalação

**Por pasta (mais simples para testar):** copie esta pasta inteira para `Data/systems/mmrpg` do seu Foundry e reinicie. O nome da pasta precisa ser `mmrpg`.

**Por zip:** rode `npm run package` e extraia `dist/mmrpg-<versão>.zip` em `Data/systems/mmrpg`.

**Por URL de manifesto:** depois de publicar o projeto no GitHub e criar uma tag (`git tag v0.1.0 && git push --tags`), o workflow em `.github/workflows/release.yml` gera o release com `system.json` e o zip. A URL a colar em *Instalar sistema* é
`https://github.com/<usuário>/<repositório>/releases/latest/download/system.json`.

## O que o sistema faz

**Mecânica do d616**
- Rolagem `1d6 + dado Marvel + 1d6 + modificador`. A face 1 do dado Marvel aparece como **M**, conta 6 e é um resultado **Fantástico**. Dois 6 com o M formam um **Ultimate**.
- **Edge / Trouble**: re-rola um dado e mantém o melhor / o pior. Marque na ficha (por atributo ou na iniciativa), na ação ou no diálogo de rolagem. Edge e Trouble juntos se anulam. No chat há um botão para escolher o dado a re-rolar.
- Defesa = 10 + atributo (mais bônus). Acerta quem iguala ou supera a defesa; o Fantástico acerta sempre.
- Dano = valor do dado Marvel × (multiplicador − redução do alvo) + atributo; o Fantástico multiplica o dano (fator configurável por ação).
- Iniciativa = d616 + Vigilância (mais bônus), com Edge/Trouble automáticos.

**Ações (o centro do sistema)**
- Cada item de poder, arma ou equipamento tem uma lista de ações.
- Uma ação define: ativação; alvo (marcados, si mesmo ou área, com alcance e gabarito); rolagem (nenhuma, **ataque** contra uma defesa ou **teste** contra dificuldade fixa); **dano** (atributo, bônus, recurso atingido, elemento); **cura** (pelo dado Marvel ou valor fixo; Saúde, Foco ou Karma); **efeitos** (condição e/ou modificações de Active Effect, com gatilho e duração em rodadas); **custo** (Foco, Karma, Saúde) e **usos limitados**.
- O **cartão de chat** mostra a rolagem, a defesa de cada alvo, acerto/erro, dano calculado (com a conta à mostra), cura e efeitos. Botões: aplicar por alvo, só dano, só efeitos, em si mesmo, aplicar tudo, re-rolar um dado, posicionar o gabarito de área no mapa.
- Jogadores aplicam resultados em atores que não são deles **pedindo ao GM ativo** (socket). O GM relê o cartão gravado na mensagem e recalcula os valores: o jogador não escolhe quantidades.
- Opção de mundo **Aplicar resultados automaticamente** para quem prefere não clicar.

**Fichas e dados**
- Personagem e NPC: seis atributos (defesa, ataque, bônus fora de combate e multiplicador calculados), Saúde, Foco e Karma, redução de dano, iniciativa, movimento (corrida, escalada, natação, voo, etc., cada um com modo de cálculo: fixo, metade, cheio, dobro, triplo ou Rank), tamanho, detalhes, biografia.
- Abas: principal, poderes (agrupados por conjunto de poder), traços e tags, equipamentos, modificadores, efeitos, biografia.
- Itens: poder, traço, tag, origem, ocupação, arma e equipamento. **Origens e ocupações concedem itens**: ao entrar na ficha, criam os itens ligados.
- 12 condições + derrotado como status effects do Foundry. NPC chega a 0 de Saúde → derrotado (opção de mundo).
- Efeitos com duração em rodadas expiram sozinhos quando o combate chega à rodada certa, e somem quando o combate termina.
- **Manobra de equipe**: janela que cobra o Foco de cada integrante selecionado e posta um cartão. O texto das regras da manobra não está incluído.
- Macros: arraste uma ação da ficha para a barra de atalhos.

**Importar/exportar**: janela *Importar conteúdo* (menu de configurações do sistema e botão no diretório de itens) para o seu próprio JSON. Exporta os itens do mundo no mesmo formato.

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
```

## Rótulos em português

Todos os textos da interface estão em [lang/pt-BR.json](lang/pt-BR.json) (e `en.json`). Os termos foram escolhidos sem acesso a um glossário oficial; **alinhe-os ao seu glossário** editando esse arquivo, sem mexer em código. O validador garante que os dois idiomas continuem com as mesmas chaves.

## O que não está implementado de propósito

- **Tamanho** é só um rótulo: o sistema não aplica bônus numéricos, para não inventar valores. Use os modificadores.
- **Saúde/Foco máximos** são manuais.
- **Texto de regras** de poderes, traços, manobras de equipe, etc.: nada é distribuído.
- Gabaritos de área são posicionados no token do atacante, sem arrastar.
- Sem compêndios pré-montados.

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

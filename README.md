# Marvel Multiverse RPG (não oficial) para Foundry VTT

Sistema de fãs, sem fins lucrativos e sem vínculo com a Marvel, a Disney ou a Foundry Gaming LLC.
**Não inclui nenhum texto, tabela ou arte dos livros.** Funciona no Foundry v14 (e, de forma
experimental, no v13).

Esta é a versão **1.0.0**: um recomeço do zero, feito em peças pequenas. Por enquanto a ficha cobre
só a primeira etapa da criação de personagem: identidade, Rank, atributos com compra de pontos,
e Saúde, Foco e Karma. Rolagens, poderes, traits, tags e itens voltam nas próximas versões, uma por vez.

## Instalar

No Foundry: *Sistemas de jogo > Instalar sistema* e cole na caixa "URL do manifesto":

```
https://github.com/Sennaorevoltado/mmrpg/releases/latest/download/system.json
```

## O que a ficha faz

- **Barra fixa no topo**: retrato, codinome, nome real, Rank (1 a 6), os seis atributos, Saúde, Foco e Karma.
  Ela não sai da tela quando o resto da ficha rola.
- **Atributos** com os botões −/+ e a Defesa e o teste fora de combate já calculados.
- **Modo Criação** (padrão dos personagens): mostra os pontos restantes e o teto por atributo,
  e marca em vermelho o atributo que passou do teto. O botão − não desce de 0.
- **Modo Livre** (padrão dos NPCs): sem contadores, qualquer número vale, inclusive negativo.
- **Pontos extras e teto extra**: campos manuais para bônus de Origem, Ocupação, traits ou do Narrador.
- **Aparência** (menu da janela, o botão de três pontos): tema claro ou escuro e tamanho do texto,
  escolhidos por cada jogador, só no navegador dele.

## O Narrador precisa preencher o orçamento

O orçamento de atributos depende do Rank e **só o Rank 1 vem preenchido** (5 pontos, teto 4), conferido
no criador de personagens da Demiplane. Nos demais Ranks a ficha avisa "orçamento não definido" em
vez de inventar um número.

*Configurações do jogo > Configurações do sistema > Orçamento de atributos > Definir orçamento.*
Preencha pontos e teto de cada Rank com os valores do seu livro. Deixe em branco o que não souber.

Na mesma tela de configurações há a opção **Parar o botão + no limite**. Desligada (padrão), a ficha só avisa
quando passa do teto ou dos pontos. Ligada, o botão + para.

## Pressupostos para conferir no livro

- Cada atributo começa em 0 e os pontos gastos são a **soma das pontuações** (pontuação negativa, digitada, devolve pontos).
- Defesa = 10 + pontuação do atributo; teste fora de combate = pontuação do atributo.
- Saúde e Foco começam em 10 e **os máximos são digitados à mão**: o sistema não os calcula a partir dos atributos
  (a fórmula depende do livro).
- Karma começa em 0.

## Desenvolvimento

```
npm install
npm test            # regras, ficha e configurações (Foundry simulado, v14 e v13)
npm run validate    # idiomas, templates, ações, CSS
npm run package     # gera dist/mmrpg-<versão>.zip
```

Os testes usam um Foundry **simulado** (`tests/support/foundry-stub.mjs`). Eles pegam erros de código e de
dados, mas não substituem abrir a ficha num mundo de verdade.

Para publicar: faça o commit, crie a tag `v1.0.0` e envie. O fluxo em `.github/workflows/release.yml`
roda os testes e anexa `system.json` e o `.zip` à versão.

## Créditos e licença

MIT. Veja `LICENSE` e `NOTICE` (referências abertas usadas como inspiração de organização e de mecânica, e as
fontes Roboto e Roboto Condensed).

# Marvel Multiverse RPG (não oficial) para Foundry VTT, em português do Brasil

Sistema de fãs para jogar **Marvel Multiverse RPG** no [Foundry VTT](https://foundryvtt.com), com ficha de personagem e de NPC, itens (poderes, traços, tags, origens, ocupações, armas, equipamentos e **formas**: armaduras, formas alternativas e transformações) e a rolagem **d616**, tudo em português do Brasil. Também tem a interface em inglês.

É uma adaptação, em português e para o Foundry v13 e v14, do sistema de [mjording / Rollbones Projects](https://github.com/mjording/marvel-multiverse) (licença MIT). Veja [NOTICE](NOTICE) e [LICENSE](LICENSE).

> Projeto de fãs. Não tem relação com a Marvel Entertainment, LLC, com a The Walt Disney Company nem com seus parceiros. **Este sistema não traz regras nem textos dos livros.** Para jogar você precisa dos livros oficiais.

## Instalar

No Foundry, em **Sistemas de Jogo > Instalar Sistema**, cole no campo "URL do Manifesto":

```
https://github.com/Sennaorevoltado/mmrpg/releases/latest/download/system.json
```

Compatível com Foundry **v13 e v14**. As fichas usam a API de janelas antiga do Foundry (ApplicationV1), que a v13 e a v14 ainda aceitam, mas que o Foundry marcou como obsoleta e pretende remover na v15.

## O que a ficha faz

- **Atributos** Corpo a Corpo, Agilidade, Resiliência, Vigilância, Ego e Lógica, com a Defesa (10 + valor) e o bônus de teste fora de combate calculados.
- **Rank, Karma, Saúde e Foco**, redução de dano de cada recurso, velocidade (corrida, escalada, natação, salto, voo etc.), iniciativa (Vigilância) e manobra de equipe.
- **Multiplicador de dano** de cada atributo de ataque (igual ao Rank).
- Abas de **Poderes** (agrupados por conjunto), **Formas**, **Biografia**, **Equipamento** e **Efeitos**; traços e tags ficam ao lado dos poderes.
- **Tamanho**: ao escolher o tamanho, a ficha cria o Efeito Ativo correspondente (Defesa, alcance, movimento, token).
- **Origem e Ocupação**: ao arrastar uma para a ficha, ela cria os traços, tags e poderes que concede.
- Clique no nome de um atributo para rolar o teste; clique em um poder, arma ou equipamento para mostrar o cartão no chat e, se o item tem um atributo de ataque, rolar.
- Itens da ficha podem ser arrastados para a barra de macros.

### A rolagem d616

A rolagem é `{1d6, 1dm, 1d6} + atributo`: o dado do meio é o **dado Marvel** (o 1 vale como "M" e conta 6, o **Sucesso Fantástico**). No cartão do chat:

- **Edge** e **Trouble**: botões ao lado de cada dado rolam aquele dado de novo e ficam com o melhor (Edge) ou o pior (Trouble) resultado.
- **Dano**: calcula `dado Marvel x (multiplicador - redução de dano do alvo) + atributo`, em dobro no Fantástico. Se houver alvos marcados (tecla T), mostra um resultado por alvo. O sistema mostra o número no chat; **não tira Saúde automaticamente**.

Saúde e Foco máximos são campos que você preenche na ficha.

### Formas: armaduras, formas alternativas e transformações

Na aba **Formas** da ficha (e num bloco da ficha de NPC) ficam as formas do personagem, em três listas: **Armaduras**, **Formas alternativas** e **Transformações**. O botão **+** de cada lista cria uma forma da categoria; você também pode arrastar uma do diretório de Itens.

- **Ligar e desligar:** o ícone de liga/desliga da linha (ou clicar no nome, ou usar a forma pela barra de macros). Só uma forma de cada categoria fica ligada: ligar outra armadura desliga a anterior; uma armadura e uma transformação podem estar ligadas juntas. A forma ligada fica destacada, com o selo "Ligada".
- **Ao ligar,** o sistema aplica um Efeito Ativo na ficha com as alterações da forma e cria os poderes, traços e tags que ela concede (marcados como "da forma"). **Ao desligar,** tira o efeito e só esses itens (o que o personagem já tinha continua). Itens repetidos em duas formas ligadas não são duplicados.
- **Ficha da forma** (editar o item), em três abas:
  - *Forma:* categoria, **Rank** (não altera, **pelo menos** X, ou **soma** X), **Emprestada** (concede os itens, mas não muda Rank nem valores), se o dano sofrido acompanha o corpo quando a Saúde ou o Foco máximos mudam, retrato e imagem de token para usar enquanto a forma estiver ligada, restrições e descrição.
  - *Alterações:* mudanças em valores da ficha (por exemplo Saúde máxima, atributos, redução de dano, velocidade), cada uma com o campo, o tipo (somar, multiplicar, substituir, pelo menos, no máximo) e o valor.
  - *Concessões:* poderes, traços e tags. Arraste itens do diretório para a aba ou digite o nome (`Nome (nota)` põe uma nota; num poder elemental a nota pode ser o elemento).
- **Saúde e Foco:** se a forma muda o máximo, o dano sofrido acompanha (40 de 50 de Saúde, uma armadura de +20, vira 60 de 70; ao desligar, volta a 40 de 50).
- **Imagens:** ao ligar, troca o retrato e a imagem do token (inclusive de tokens já na cena); ao desligar, devolve as originais.
- **Chat:** cada troca de forma mostra um aviso com o Rank antes e depois e o que foi ganho ou perdido. O Narrador pode desligar o aviso em Configurações do Jogo (opção "Avisar formas no chat").
- Forma copiada, arrastada para outra ficha ou importada **sempre chega desligada**. Apagar uma forma ligada desliga antes. Editar uma forma ligada refaz o efeito e as concessões.

A forma **não** muda a rolagem sozinha: ela muda os números da ficha (Rank, atributos etc.), e as rolagens usam esses números.

## Conteúdo (poderes, traços, origens...)

O sistema vem **sem conteúdo de livro**. Cada grupo monta o seu:

1. Cadastre itens à mão (aba **Itens** > Criar Item) ou
2. Importe um arquivo de conteúdo: na aba **Itens**, o Narrador vê o botão **Importar conteúdo**. Escolha um arquivo `.json` no formato abaixo. O sistema cria as pastas e os itens (e pula o que já existe, então importar de novo não duplica nada).

Formato do arquivo (`format` e `items` são obrigatórios; `system` usa os mesmos campos da ficha de cada item):

```json
{
  "format": "mmrpg-content",
  "version": 2,
  "items": [
    {
      "type": "power",
      "name": "Nome do poder",
      "folder": "Magic/Chaos",
      "system": { "powerSet": "Magic", "action": "Padrão", "duration": "Instantâneo", "cost": "10 de Foco", "description": "<p>...</p>" }
    }
  ]
}
```

Tipos aceitos: `power`, `trait`, `tag`, `origin`, `occupation`, `weapon`, `item` e `form`. O conjunto de um poder (`powerSet`) é gravado com o nome em inglês (`Basic`, `Elemental Control`, `Healing`, `Illusion`, `Luck`, `Magic`, `Martial Arts`, `Melee Weapons`, `Narrative`, `Omniversal Travel`, `Phasing`, `Plasticity`, `Power Control`, `Ranged Weapons`, `Resize`, `Shield Bearer`, `Sixth Sense`, `Spider-Powers`, `Super-Speed`, `Super-Strength`, `Tactics`, `Telekinesis`, `Telepathy`, `Teleportation`, `Translation`, `Weather Control`); a ficha mostra o nome em português.

Origens e ocupações listam o que concedem em `tags`, `traits` e (origens) `powers`, por nome (com `note` opcional, por exemplo `{ "name": "Connections", "note": "Criminal" }` cria "Connections (Criminal)"). Se existir um item de mesmo nome e tipo no mundo, a ficha copia os dados dele.

Uma forma (`form`) traz em `system`: `kind` (`suit`, `alternate` ou `transformation`), `rank` (`{ "mode": "none|set|add", "value": 4 }`), `changes` (lista de `{ "key": "system.health.max", "type": "add", "value": "20" }`) e as listas `powers`, `traits` e `tags` do que concede, no mesmo formato das origens.

Quem não for o Narrador não vê o botão. O arquivo é só uma lista de dados: nada nele é executado.

> Não publique no GitHub arquivos com texto dos livros. O `.gitignore` deste projeto já ignora `*.privado.json` e a pasta `conteudo-privado/`.

## Desenvolvimento

Precisa do Node 20 ou mais novo.

```
npm install      # só para o Handlebars, usado na validação
npm test         # testes automáticos (Foundry simulado)
npm run validate # confere system.json, templates, idiomas e CSS
npm run package  # gera dist/system.json e dist/mmrpg-<versão>.zip
npm run preview  # gera páginas HTML das fichas em previews/ para olhar no navegador
```

Os testes rodam sobre um Foundry **simulado** (`tests/support/foundry-stub.mjs`): conferem as regras, os modelos de dados, as fichas e o importador, mas não substituem abrir o sistema no Foundry de verdade. Os dados do d616 não são simulados.

O CSS fica em `css/mmrpg.css` (editado direto). Os textos ficam em `lang/pt-BR.json` e `lang/en.json`, que precisam ter as mesmas chaves (a validação confere).

### Publicar uma versão

1. Faça o commit na branch `main` e envie (push).
2. Crie a tag **com o `v`**, por exemplo `v1.0.1`, e envie a tag. O GitHub Actions roda os testes e a validação e publica `system.json` e `mmrpg-<versão>.zip` na página de Releases.

O fluxo copia a versão da tag para o `system.json` do pacote; não precisa editar o número à mão (mas mantenha `package.json` e `system.json` iguais).

## Licença

MIT, com o aviso de copyright de Rollbones Projects / Foundry Systems & Mods mantido. Fontes Roboto sob Apache 2.0 e SIL OFL 1.1. Detalhes em [NOTICE](NOTICE).

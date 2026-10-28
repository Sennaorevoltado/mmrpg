/**
 * A mesma bateria de integração, agora com o Foundry simulado na geração 13.
 *
 * Cada arquivo de teste roda em um processo próprio, então a variável de ambiente abaixo
 * só afeta este. A v13 simulada exige as APIs da v13 (DocumentSheetConfig) e recusa as
 * antigas onde a v14 as aposentou.
 *
 * Isto NÃO substitui um teste num Foundry v13 de verdade: a simulação só garante que o código
 * escolhe as APIs certas por versão.
 */

process.env.MMRPG_FOUNDRY_GENERATION = "13";
await import("./foundry.test.mjs");

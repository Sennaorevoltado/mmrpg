#!/usr/bin/env node
/**
 * Empacota o sistema em um .zip pronto para instalar no Foundry (system.json na raiz do zip).
 *
 * Sem dependências: o zip é escrito aqui mesmo (método "deflate"), para funcionar em qualquer
 * sistema operacional com Node 20 ou mais novo.
 *
 * Uso: node scripts/package.mjs [--out dist]
 * Resultado: dist/mmrpg-<versão>.zip e dist/system.json (cópia do manifesto).
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outArg = process.argv.indexOf("--out");
const outDir = path.resolve(root, outArg > 0 ? process.argv[outArg + 1] : "dist");

/** O que entra no pacote (relativo à raiz do projeto). */
const INCLUDE = ["system.json", "module", "templates", "styles", "fonts", "lang", "docs", "examples", "README.md", "LICENSE", "NOTICE"];

const manifest = JSON.parse(fs.readFileSync(path.join(root, "system.json"), "utf8"));

function listFiles(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return [];
  const stat = fs.statSync(abs);
  if (stat.isFile()) return [rel];
  return fs
    .readdirSync(abs)
    .sort()
    .flatMap((name) => listFiles(path.posix.join(rel.split(path.sep).join("/"), name)));
}

/* ---- CRC-32 e escrita do zip ---- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Data fixa (reprodutível): 2026-01-01 00:00 no formato MS-DOS. */
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

function writeZip(entries) {
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, "utf8");
    const deflated = zlib.deflateRawSync(data, { level: 9 });
    const useDeflate = deflated.length < data.length;
    const body = useDeflate ? deflated : data;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // nomes em UTF-8
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuf, body);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE((3 << 8) | 20, 4); // criado em Unix (para as permissões valerem)
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(method, 10);
    cd.writeUInt16LE(DOS_TIME, 12);
    cd.writeUInt16LE(DOS_DATE, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(body.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, nameBuf);

    offset += local.length + nameBuf.length + body.length;
  }

  const centralSize = central.reduce((s, b) => s + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, ...central, end]);
}

/* ---- Execução ---- */

const files = INCLUDE.flatMap(listFiles);
const missing = ["system.json", "module/mmrpg.mjs", "styles/mmrpg.css"].filter((f) => !files.includes(f));
if (missing.length) {
  console.error(`Arquivos obrigatórios ausentes: ${missing.join(", ")}`);
  process.exit(1);
}
for (const required of ["README.md", "LICENSE", "NOTICE"]) {
  if (!files.includes(required)) console.warn(`aviso: ${required} não existe e ficará fora do pacote`);
}

const entries = files.map((name) => ({ name, data: fs.readFileSync(path.join(root, name)) }));
fs.mkdirSync(outDir, { recursive: true });
const zipPath = path.join(outDir, `${manifest.id}-${manifest.version}.zip`);
fs.writeFileSync(zipPath, writeZip(entries));
fs.copyFileSync(path.join(root, "system.json"), path.join(outDir, "system.json"));

const kb = (fs.statSync(zipPath).size / 1024).toFixed(1);
console.log(`${entries.length} arquivos -> ${path.relative(root, zipPath)} (${kb} KB)`);

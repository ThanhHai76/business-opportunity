'use strict';
/**
 * Minimal .xlsx reader for the data scripts (no dependency): unzips the workbook with zlib and returns every
 * sheet as rows of cell values (strings or numbers). Enough for plain tables; ignores styles and formulas.
 */
const fs = require('node:fs');
const zlib = require('node:zlib');

function unzip(buffer) {
  // End of central directory: signature 0x06054b50 within the last 64 kB.
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65_557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Not a zip file');
  const count = buffer.readUInt16LE(eocd + 10);
  let p = buffer.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let n = 0; n < count; n++) {
    const method = buffer.readUInt16LE(p + 10);
    const size = buffer.readUInt32LE(p + 20);
    const nameLen = buffer.readUInt16LE(p + 28);
    const extraLen = buffer.readUInt16LE(p + 30);
    const commentLen = buffer.readUInt16LE(p + 32);
    const local = buffer.readUInt32LE(p + 42);
    const name = buffer.toString('utf8', p + 46, p + 46 + nameLen);
    const dataStart = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const raw = buffer.subarray(dataStart, dataStart + size);
    files.set(name, method === 8 ? zlib.inflateRawSync(raw) : raw);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const decode = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');

const colIndex = (ref) => [...ref.replace(/\d+/g, '')].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

/** @returns {{ name: string, rows: (string|number|null)[][] }[]} */
function readXlsx(path) {
  const files = unzip(fs.readFileSync(path));
  const text = (name) => files.get(name)?.toString('utf8') ?? '';
  const shared = [...text('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    decode([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')),
  );
  const workbook = text('xl/workbook.xml');
  const rels = text('xl/_rels/workbook.xml.rels');
  const target = (id) => new RegExp(`Id="${id}"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Id="${id}"`).exec(rels);
  return [...workbook.matchAll(/<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)].map(([, name, id]) => {
    const m = target(id);
    const file = `xl/${(m[1] ?? m[2]).replace(/^\/?xl\//, '')}`;
    const rows = [];
    for (const row of text(file).matchAll(/<row [^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells = [];
      for (const c of row[2].matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const type = /t="(\w+)"/.exec(c[2])?.[1];
        const v = /<v>([\s\S]*?)<\/v>/.exec(c[3] ?? '')?.[1];
        const inline = /<is>([\s\S]*?)<\/is>/.exec(c[3] ?? '')?.[1];
        let value = null;
        if (type === 's' && v !== undefined) value = shared[Number(v)];
        else if (type === 'inlineStr' && inline) value = decode([...inline.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(''));
        else if (type === 'str' && v !== undefined) value = decode(v);
        else if (v !== undefined) value = Number.isNaN(Number(v)) ? decode(v) : Number(v);
        cells[colIndex(c[1])] = value;
      }
      rows[Number(row[1]) - 1] = Array.from(cells, (x) => x ?? null);
    }
    return { name: decode(name), rows: Array.from(rows, (r) => r ?? []) };
  });
}

module.exports = { readXlsx };

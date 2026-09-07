import * as XLSX from "xlsx";

const cellPattern = /<c\b[^>]*?\br="([A-Z]+\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g;
const rowPattern = /<row\b[^>]*\br="(\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/row>)/g;

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function shiftFormula(formula, fromAddress, toAddress) {
  const from = XLSX.utils.decode_cell(fromAddress);
  const to = XLSX.utils.decode_cell(toAddress);
  const rowDelta = to.r - from.r;
  const colDelta = to.c - from.c;
  return formula.replace(
    /(\$?)([A-Z]{1,3})(\$?)(\d+)/g,
    (whole, colAbs, col, rowAbs, row) => {
      const nextCol = colAbs
        ? col
        : XLSX.utils.encode_col(XLSX.utils.decode_col(col) + colDelta);
      const nextRow = rowAbs ? row : String(Number(row) + rowDelta);
      return `${colAbs}${nextCol}${rowAbs}${nextRow}`;
    },
  );
}

export function unshareFormulas(xml) {
  const masters = new Map();
  let match;
  while ((match = cellPattern.exec(xml))) {
    const [cellText, address] = match;
    const masterMatch = cellText.match(
      /<f t="shared" ref="[^"]*" si="(\d+)"[^>]*>([^<]*)<\/f>/,
    );
    if (masterMatch) {
      masters.set(masterMatch[1], { formula: masterMatch[2], anchorAddress: address });
    }
  }
  if (!masters.size) return xml;

  cellPattern.lastIndex = 0;
  return xml.replace(cellPattern, (cellText, address) => {
    const sharedMatch = cellText.match(
      /<f t="shared"(?: ref="[^"]*")? si="(\d+)"\s*\/?>(?:([^<]*)<\/f>)?/,
    );
    if (!sharedMatch) return cellText;
    const master = masters.get(sharedMatch[1]);
    if (!master) return cellText;
    const formula = shiftFormula(master.formula, master.anchorAddress, address);
    return cellText.replace(
      /<f t="shared"(?: ref="[^"]*")? si="\d+"\s*\/?>(?:[^<]*<\/f>)?/,
      `<f>${formula}</f>`,
    );
  });
}

function cellXml(address, value, original = "") {
  const isLiteralPatch =
    value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "literal");
  if (/<f\b/.test(original) && !isLiteralPatch) return original;

  const cellValue = isLiteralPatch ? value.literal : value;
  const openingEnd = original.indexOf(">");
  let opening = openingEnd >= 0 ? original.slice(0, openingEnd + 1) : `<c r="${address}">`;
  opening = opening.replace(/\s+t="[^"]*"/g, "").replace(/\s*\/?>(?=$)/, ">");

  if (cellValue && typeof cellValue === "object" && cellValue.formula) {
    return `${opening}<f>${escapeXml(cellValue.formula)}</f><v></v></c>`;
  }
  if (cellValue == null || cellValue === "") return `${opening}</c>`;
  if (typeof cellValue === "number" && Number.isFinite(cellValue)) {
    return `${opening}<v>${cellValue}</v></c>`;
  }
  return `${opening.replace(/>$/, ' t="inlineStr">')}<is><t xml:space="preserve">${escapeXml(cellValue)}</t></is></c>`;
}

export function applySheetPatches(xml, patches, sheetName) {
  const seen = new Set();
  const updated = xml.replace(rowPattern, (rowXml, rowNumber) => {
    const row = Number(rowNumber);
    const isSelfClosing = /\/>\s*$/.test(rowXml);
    let nextRow = isSelfClosing ? rowXml.replace(/\s*\/>\s*$/, "></row>") : rowXml;
    nextRow = nextRow.replace(cellPattern, (original, address) => {
      if (!patches.has(address)) return original;
      seen.add(address);
      return cellXml(address, patches.get(address), original);
    });

    const missing = [];
    patches.forEach((value, address) => {
      if (!seen.has(address) && XLSX.utils.decode_cell(address).r + 1 === row) {
        seen.add(address);
        missing.push({
          address,
          column: XLSX.utils.decode_cell(address).c,
          xml: cellXml(address, value),
        });
      }
    });
    missing.sort((first, second) => first.column - second.column);
    missing.forEach(({ column, xml: missingCell }) => {
      const existingCells = [...nextRow.matchAll(cellPattern)];
      const nextCell = existingCells.find((match) => {
        const existingAddress = match[1];
        return XLSX.utils.decode_cell(existingAddress).c > column;
      });
      const extensionPoint = nextRow.indexOf("<extLst");
      const insertionPoint =
        nextCell?.index ?? (extensionPoint >= 0 ? extensionPoint : nextRow.lastIndexOf("</row>"));
      nextRow = `${nextRow.slice(0, insertionPoint)}${missingCell}${nextRow.slice(insertionPoint)}`;
    });
    return nextRow;
  });

  const unapplied = [...patches.keys()].filter((address) => !seen.has(address));
  if (unapplied.length) {
    console.warn(
      `Excel sync: ${unapplied.length} cell(s) on "${sheetName}" have no matching row in the template and were not written: ${unapplied.slice(0, 8).join(", ")}${unapplied.length > 8 ? ", ..." : ""}`,
    );
  }
  return updated;
}

export function getTemplateFile(cfb, name) {
  const file = cfb.FileIndex.find((item) => item.name === name);
  if (!file) throw new Error(`Template sheet file ${name} was not found.`);
  return file;
}

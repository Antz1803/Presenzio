import * as XLSX from "xlsx";

export function cellAddress(row, column) {
  return XLSX.utils.encode_cell({ r: row, c: column });
}

export function patchCell(patches, sheetName, row, column, value) {
  patches[sheetName] ??= new Map();
  patches[sheetName].set(cellAddress(row, column), value);
}

export function patchAddress(patches, sheetName, address, value) {
  patches[sheetName] ??= new Map();
  patches[sheetName].set(address, value);
}

export function patchFormula(patches, sheetName, row, column, formula) {
  patchCell(patches, sheetName, row, column, { formula });
}

export function patchLiteral(patches, sheetName, row, column, value) {
  patchCell(patches, sheetName, row, column, { literal: value });
}

export function clearRange(patches, sheetName, startRow, endRow, startColumn, endColumn) {
  for (let row = startRow; row <= endRow; row += 1) {
    for (let column = startColumn; column <= endColumn; column += 1) {
      patchCell(patches, sheetName, row, column, "");
    }
  }
}

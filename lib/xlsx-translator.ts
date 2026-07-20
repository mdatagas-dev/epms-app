import JSZip from "jszip";

const chineseCharacter = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u;
const textNode = /<t(\s[^>]*)?>([\s\S]*?)<\/t>/g;
const sharedString = /<si(?:\s[^>]*)?>[\s\S]*?<\/si>/g;
const cell = /<c\b([^>]*)>([\s\S]*?)<\/c>/g;
const inlineString = /<is(?:\s[^>]*)?>[\s\S]*?<\/is>/;

export async function extractChinesePhrases(workbook: ArrayBuffer) {
  const zip = await loadWorkbook(workbook);
  const worksheets = worksheetFiles(zip);
  const usedSharedStrings = new Set<number>();
  const phrases = new Set<string>();

  for (const path of worksheets) {
    const xml = await zip.file(path)!.async("string");
    for (const match of xml.matchAll(cell)) {
      if (/\bt="s"/.test(match[1])) {
        const index = match[2].match(/<v>(\d+)<\/v>/)?.[1];
        if (index !== undefined) usedSharedStrings.add(Number(index));
      }
      if (/\bt="inlineStr"/.test(match[1])) {
        const value = readText(match[2].match(inlineString)?.[0] ?? "");
        if (chineseCharacter.test(value)) phrases.add(value);
      }
    }
  }

  const sharedXml = await zip.file("xl/sharedStrings.xml")?.async("string");
  if (sharedXml) {
    Array.from(sharedXml.matchAll(sharedString)).forEach((match, index) => {
      const value = readText(match[0]);
      if (usedSharedStrings.has(index) && chineseCharacter.test(value)) phrases.add(value);
    });
  }

  return [...phrases];
}

export async function buildTranslatedWorkbook(workbook: ArrayBuffer, translations: Record<string, string>) {
  const zip = await loadWorkbook(workbook);
  const shared = zip.file("xl/sharedStrings.xml");

  if (shared) {
    const xml = await shared.async("string");
    zip.file("xl/sharedStrings.xml", xml.replace(sharedString, (entry) => translateText(entry, translations)), { createFolders: false });
  }

  for (const path of worksheetFiles(zip)) {
    const file = zip.file(path)!;
    const xml = await file.async("string");
    zip.file(path, xml.replace(cell, (entry, attributes: string) => {
      if (!/\bt="inlineStr"/.test(attributes)) return entry;
      return entry.replace(inlineString, (value) => translateText(value, translations));
    }), { createFolders: false });
  }

  return zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
}

async function loadWorkbook(workbook: ArrayBuffer) {
  const zip = await JSZip.loadAsync(workbook);
  if (!zip.file("[Content_Types].xml") || !zip.file("xl/workbook.xml")) {
    throw new Error("This file is not a valid XLSX workbook.");
  }
  return zip;
}

function worksheetFiles(zip: JSZip) {
  return Object.keys(zip.files).filter((path) => /^xl\/worksheets\/[^/]+\.xml$/.test(path));
}

function readText(xml: string) {
  return [...xml.matchAll(textNode)].map((match) => decodeXml(match[2])).join("");
}

function translateText(xml: string, translations: Record<string, string>) {
  const translation = translations[readText(xml)];
  if (!translation?.trim()) return xml;

  let first = true;
  return xml.replace(textNode, (_node, attributes = "") => {
    const value = first ? escapeXml(translation.trim()) : "";
    first = false;
    const spacing = attributes.includes("xml:space=") ? "" : " xml:space=\"preserve\"";
    return `<t${attributes}${spacing}>${value}</t>`;
  });
}

function decodeXml(value: string) {
  return value
    .replace(/&#(?:x([\da-f]+)|(\d+));/gi, (_entity, hex, decimal) => String.fromCodePoint(Number.parseInt(hex ?? decimal, hex ? 16 : 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

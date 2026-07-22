import JSZip from "jszip";

const chineseCharacter = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u;
const paragraph = /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;
const textNode = /<w:t(\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
const contentFile = /^word\/(?:document|header\d+|footer\d+|footnotes|endnotes|comments)\.xml$/;

export async function extractChineseDocumentPhrases(document: ArrayBuffer) {
  const zip = await loadDocument(document);
  const phrases = new Set<string>();
  for (const path of contentFiles(zip)) {
    const xml = await zip.file(path)!.async("string");
    for (const match of xml.matchAll(paragraph)) {
      const value = readText(match[0]);
      if (chineseCharacter.test(value)) phrases.add(value);
    }
  }
  return [...phrases];
}

export async function buildTranslatedDocument(document: ArrayBuffer, translations: Record<string, string>) {
  const zip = await loadDocument(document);
  for (const path of contentFiles(zip)) {
    const file = zip.file(path)!;
    const xml = await file.async("string");
    zip.file(path, xml.replace(paragraph, (value) => translateParagraph(value, translations)), { createFolders: false });
  }
  return zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
}

async function loadDocument(document: ArrayBuffer) {
  const zip = await JSZip.loadAsync(document);
  if (!zip.file("[Content_Types].xml") || !zip.file("word/document.xml")) {
    throw new Error("This file is not a valid DOCX document.");
  }
  return zip;
}

function contentFiles(zip: JSZip) {
  return Object.keys(zip.files).filter((path) => contentFile.test(path));
}

function readText(xml: string) {
  return [...xml.matchAll(textNode)].map((match) => decodeXml(match[2])).join("");
}

function translateParagraph(xml: string, translations: Record<string, string>) {
  const translation = translations[readText(xml)];
  if (!translation?.trim()) return xml;

  const nodes = [...xml.matchAll(textNode)];
  const characters = [...translation.trim()];
  let index = 0;
  return xml.replace(textNode, (_node, attributes = "") => {
    const start = Math.floor(index * characters.length / nodes.length);
    const end = Math.floor((index + 1) * characters.length / nodes.length);
    index++;
    const value = characters.slice(start, end).join("") || "\u200b";
    const spacing = attributes.includes("xml:space=") ? "" : " xml:space=\"preserve\"";
    return `<w:t${attributes}${spacing}>${escapeXml(value)}</w:t>`;
  });
}

function decodeXml(value: string) {
  return value.replace(/&#(?:x([\da-f]+)|(\d+));/gi, (_entity, hex, decimal) => String.fromCodePoint(Number.parseInt(hex ?? decimal, hex ? 16 : 10))).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

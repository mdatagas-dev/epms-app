import JSZip from "jszip";

const chineseCharacter = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u;
const translatableText = /\p{L}/u;
const paragraph = /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;
const textNode = /<w:t(\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
const contentFile = /^word\/(?:document|header\d+|footer\d+|footnotes|endnotes|comments)\.xml$/;
const relationship = /<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/>/g;

export type DocumentBlock = { index: number; text: string; images: Array<{ extension: string; data: Uint8Array }> };

export async function extractChineseDocumentPhrases(document: ArrayBuffer) {
  return (await extractDocumentPhrases(document)).filter((value) => chineseCharacter.test(value));
}

export async function extractDocumentPhrases(document: ArrayBuffer) {
  const zip = await loadDocument(document);
  const phrases = new Set<string>();
  for (const path of contentFiles(zip)) {
    const xml = await zip.file(path)!.async("string");
    for (const match of xml.matchAll(paragraph)) {
      const value = readText(match[0]);
      if (translatableText.test(value)) phrases.add(value);
    }
  }
  return [...phrases];
}

export async function extractDocumentBlocks(document: ArrayBuffer): Promise<DocumentBlock[]> {
  const zip = await loadDocument(document);
  const xml = await zip.file("word/document.xml")!.async("string");
  const relsXml = await zip.file("word/_rels/document.xml.rels")?.async("string") ?? "";
  const relationships = Object.fromEntries([...relsXml.matchAll(relationship)].map((match) => [match[1], decodeXml(match[2])]));
  const blocks: DocumentBlock[] = [];

  for (const match of xml.matchAll(paragraph)) {
    const text = readText(match[0]).trim();
    const images: DocumentBlock["images"] = [];
    for (const embed of match[0].matchAll(/<a:blip[^>]*r:embed="([^"]+)"/g)) {
      const target = relationships[embed[1]];
      if (!target) continue;
      const path = normalizePath("word/document.xml", target);
      const data = await zip.file(path)?.async("uint8array");
      if (data) images.push({ extension: path.split(".").pop()?.toLowerCase() ?? "png", data });
    }
    if (text || images.length) blocks.push({ index: blocks.length, text, images });
  }
  return blocks;
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

function normalizePath(base: string, target: string) {
  if (target.startsWith("/")) return target.replace(/^\//, "");
  const parts = base.split("/").slice(0, -1);
  for (const segment of target.split("/")) {
    if (segment === "..") parts.pop();
    else if (segment !== ".") parts.push(segment);
  }
  return parts.join("/");
}

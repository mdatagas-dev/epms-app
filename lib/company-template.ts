import JSZip from "jszip";

const cellPattern = /<c\b([^>]*?)(?<!\/)>([\s\S]*?)<\/c>/g;
const sheetPattern = /<sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"[^>]*\/>/g;
const relationshipPattern = /<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/>/g;
const anchorPattern = /<xdr:(twoCellAnchor|oneCellAnchor)([\s\S]*?)<\/xdr:\1>/g;
const han = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u;

export type TemplateImage = { extension: string; data: Uint8Array };
export type TemplateStep = { title: string; instruction: string; keyPoints: string[]; images: TemplateImage[] };
export type TemplateMetadata = {
  ikNumber: string;
  revision: string;
  date: string;
  product: string;
  station: string;
  series: string;
  cycleTime: string;
  model: string;
  author: string;
};

export async function extractCompanyInstruction(workbook: ArrayBuffer) {
  const zip = await JSZip.loadAsync(workbook);
  const strings = await sharedStrings(zip);
  const sheets = await workbookSheets(zip);
  let operational: { path: string; xml: string; cells: Map<string, string> } | undefined;

  for (const sheet of sheets) {
    const xml = await zip.file(sheet.path)?.async("string");
    if (!xml) continue;
    const cells = readCells(xml, strings);
    if ([...cells.values()].some((value) => /\[Work steps?\]/i.test(value))) {
      operational = { path: sheet.path, xml, cells };
      break;
    }
  }
  if (!operational) throw new Error("No operational [Work steps] sheet was found in the translated workbook.");

  const starts = [...operational.cells]
    .map(([ref, value]) => ({ ref, value, row: Number(ref.match(/\d+/)?.[0]) }))
    .filter(({ ref, value, row }) => /^B\d+$/.test(ref) && /^\d+$/.test(value) && row >= 8 && row <= 35)
    .sort((a, b) => a.row - b.row);
  if (!starts.length) throw new Error("No numbered work steps were found in the translated workbook.");

  const steps: TemplateStep[] = starts.map((start, index) => {
    const end = starts[index + 1]?.row ?? 31;
    const instruction = joinRows(operational!.cells, "C", start.row, end);
    const keyPoint = joinRows(operational!.cells, "J", start.row, end);
    return {
      title: instruction.split(/[.!?\r\n]/, 1)[0].slice(0, 90) || `Step ${index + 1}`,
      instruction,
      keyPoints: keyPoint ? [keyPoint] : [],
      images: [],
    };
  });

  const drawing = await sheetDrawing(zip, operational.path, operational.xml);
  if (drawing) {
    const drawingRels = relationships(await zip.file(drawing.relsPath)?.async("string") ?? "");
    for (const match of drawing.xml.matchAll(anchorPattern)) {
      const row = Number(match[2].match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/)?.[1] ?? -1);
      if (row < starts[0].row - 2 || row > 35) continue;
      const stepIndex = Math.max(0, starts.findLastIndex((start) => start.row <= row));
      const text = [...match[2].matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map((item) => decodeXml(item[1])).join("").trim();
      if (text && !/^\d+$/.test(text) && !steps[stepIndex].keyPoints.includes(text)) steps[stepIndex].keyPoints.push(text);

      const embed = match[2].match(/<a:blip[^>]*r:embed="([^"]+)"/)?.[1];
      const target = embed ? drawingRels[embed] : undefined;
      if (!target || !match[2].includes("<xdr:pic>")) continue;
      const mediaPath = normalizePath(drawing.path, target);
      const data = await zip.file(mediaPath)?.async("uint8array");
      if (data) steps[stepIndex].images.push({ extension: mediaPath.split(".").pop()?.toLowerCase() ?? "png", data });
    }
  }

  const cells = operational.cells;
  const documentNumber = await findCellAcrossSheets(sheets, zip, strings, "AB2");
  return {
    metadata: {
      ikNumber: documentNumber ?? "",
      revision: cells.get("AK4") ?? "00",
      date: new Intl.DateTimeFormat("en-GB").format(new Date()),
      product: "AIR CONDITIONER",
      station: cells.get("D2") ?? "Assembly",
      series: "INDOOR",
      cycleTime: "",
      model: cells.get("I2") ?? cells.get("D7") ?? "",
      author: "",
    } satisfies TemplateMetadata,
    steps,
  };
}

export async function buildCompanyTemplate(workbook: ArrayBuffer, metadata: TemplateMetadata, steps: TemplateStep[]) {
  const zip = await JSZip.loadAsync(workbook);
  const sheets = await workbookSheets(zip);
  if (!steps.length) throw new Error("Add at least one reviewed work step.");
  if (steps.length > sheets.length) throw new Error(`This template supports up to ${sheets.length} work-step pages.`);

  let workbookXml = await zip.file("xl/workbook.xml")!.async("string");
  let sheetIndex = 0;
  workbookXml = workbookXml.replace(sheetPattern, (sheet) => {
    const index = sheetIndex++;
    if (index < steps.length) return sheet.replace(/name="[^"]+"/, `name="${index + 1}"`).replace(/\s+state="[^"]+"/, "");
    const hidden = sheet.replace(/name="[^"]+"/, `name="Unused ${index + 1}"`);
    return /\sstate="/.test(hidden) ? hidden.replace(/state="[^"]+"/, "state=\"hidden\"") : hidden.replace("/>", " state=\"hidden\"/>");
  });
  zip.file("xl/workbook.xml", workbookXml, { createFolders: false });

  for (let index = 0; index < steps.length; index++) {
    const sheet = sheets[index];
    const step = steps[index];
    let xml = await zip.file(sheet.path)!.async("string");
    const values: Record<string, string> = {
      E3: step.title,
      P1: `IK No : ${metadata.ikNumber}`,
      P2: `Rev    : ${metadata.revision}`,
      P3: `Date   : ${metadata.date}`,
      P4: `Page   : ${index + 1} total ${steps.length}`,
      D5: metadata.product,
      H5: metadata.station,
      K5: metadata.series,
      M5: metadata.cycleTime,
      O5: metadata.model,
      A33: `Langkah Kerja:\n${step.instruction}`,
      B49: metadata.author,
    };
    for (const [ref, value] of Object.entries(values)) xml = setCell(xml, ref, value);
    xml = copyCellStyle(xml, "A33", "Q12");
    xml = addMerge(xml, "A33:O43");
    const notes = step.keyPoints.filter(Boolean).slice(0, 5);
    for (const [noteIndex, ref] of ["Q12", "Q15", "Q17", "Q19", "Q21"].entries()) xml = setCell(xml, ref, notes[noteIndex] ?? "");
    for (let row = 24; row <= 32; row++) for (const column of ["Q", "T", "U"]) xml = setCell(xml, `${column}${row}`, "");
    zip.file(sheet.path, xml, { createFolders: false });

    const drawing = await sheetDrawing(zip, sheet.path, xml);
    if (!drawing) continue;
    const result = await replaceTemplateDrawing(zip, drawing, step, index);
    zip.file(drawing.path, result.xml, { createFolders: false });
    zip.file(drawing.relsPath, result.rels, { createFolders: false });
  }

  return zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
}

async function replaceTemplateDrawing(zip: JSZip, drawing: Awaited<ReturnType<typeof sheetDrawing>> & {}, step: TemplateStep, pageIndex: number) {
  let rels = await zip.file(drawing.relsPath)?.async("string") ?? "";
  let imageIndex = 0;
  const addedExtensions = new Set<string>();
  const xml = drawing.xml.replace(anchorPattern, (anchor, _type, body: string) => {
    const row = Number(body.match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/)?.[1] ?? -1);
    if (row >= 5 && row <= 30) {
      if (!body.includes("<xdr:pic>")) return "";
      const image = step.images[imageIndex++];
      const embed = body.match(/<a:blip[^>]*r:embed="([^"]+)"/)?.[1];
      if (!image || !embed) return "";
      const extension = image.extension === "jpg" ? "jpeg" : image.extension;
      const filename = `company-step-${pageIndex + 1}-${imageIndex}.${extension}`;
      zip.file(`xl/media/${filename}`, image.data, { binary: true, createFolders: false });
      rels = rels.replace(new RegExp(`(<Relationship\\b[^>]*Id="${embed}"[^>]*Target=")[^"]+(")`), `$1../media/${filename}$2`);
      addedExtensions.add(extension);
      return anchor;
    }
    const text = [...body.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map((match) => decodeXml(match[1])).join("");
    if (/Step Kerja|PPC|FGQC/i.test(text)) return "";
    return anchor;
  });

  for (const extension of addedExtensions) await ensureContentType(zip, extension);
  return { xml, rels };
}

function setCell(xml: string, ref: string, value: string) {
  const pattern = new RegExp(`<c\\b([^>]*\\br="${ref}"[^>]*)\\/>|<c\\b([^>]*\\br="${ref}"[^>]*)>([\\s\\S]*?)<\\/c>`);
  if (!pattern.test(xml)) throw new Error(`Template cell ${ref} is missing.`);
  return xml.replace(pattern, (_cell, selfClosing = "", normal = "") => {
    const attributes = (selfClosing || normal).replace(/\s+t="[^"]*"/g, "").trimEnd();
    if (!value.trim()) return `<c${attributes}/>`;
    return `<c${attributes} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
  });
}

function copyCellStyle(xml: string, destination: string, source: string) {
  const style = xml.match(new RegExp(`<c\\b[^>]*\\br="${source}"[^>]*\\bs="(\\d+)"`))?.[1];
  if (!style) return xml;
  return xml.replace(new RegExp(`<c\\b([^>]*\\br="${destination}"[^>]*)`), (cell, attributes: string) => {
    const next = /\bs="\d+"/.test(attributes) ? attributes.replace(/\bs="\d+"/, `s="${style}"`) : `${attributes} s="${style}"`;
    return `<c${next}`;
  });
}

function addMerge(xml: string, ref: string) {
  if (xml.includes(`<mergeCell ref="${ref}"`)) return xml;
  if (/<mergeCells\b/.test(xml)) {
    return xml
      .replace(/<mergeCells\b([^>]*)count="(\d+)"([^>]*)>/, (_tag, before, count, after) => `<mergeCells${before}count="${Number(count) + 1}"${after}>`)
      .replace("</mergeCells>", `<mergeCell ref="${ref}"/></mergeCells>`);
  }
  return xml.replace("</worksheet>", `<mergeCells count="1"><mergeCell ref="${ref}"/></mergeCells></worksheet>`);
}

async function workbookSheets(zip: JSZip) {
  const workbookXml = await zip.file("xl/workbook.xml")?.async("string");
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");
  if (!workbookXml || !relsXml) throw new Error("This file is not a valid XLSX workbook.");
  const rels = relationships(relsXml);
  return [...workbookXml.matchAll(sheetPattern)].map((match) => ({ name: decodeXml(match[1]), path: normalizePath("xl/workbook.xml", rels[match[2]]) }));
}

async function sharedStrings(zip: JSZip) {
  const xml = await zip.file("xl/sharedStrings.xml")?.async("string");
  if (!xml) return [];
  return [...xml.matchAll(/<si(?:\s[^>]*)?>[\s\S]*?<\/si>/g)].map((entry) => [...entry[0].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((text) => decodeXml(text[1])).join(""));
}

function readCells(xml: string, strings: string[]) {
  const cells = new Map<string, string>();
  for (const match of xml.matchAll(cellPattern)) {
    const ref = match[1].match(/\br="([^"]+)"/)?.[1];
    if (!ref) continue;
    const type = match[1].match(/\bt="([^"]+)"/)?.[1];
    const raw = match[2].match(/<v>([\s\S]*?)<\/v>/)?.[1];
    const inline = match[2].match(/<is>[\s\S]*?<t(?:\s[^>]*)?>([\s\S]*?)<\/t>[\s\S]*?<\/is>/)?.[1];
    if (type === "s" && raw !== undefined) cells.set(ref, strings[Number(raw)] ?? "");
    else if (type === "inlineStr" && inline !== undefined) cells.set(ref, decodeXml(inline));
    else if (raw !== undefined) cells.set(ref, decodeXml(raw));
  }
  return cells;
}

function joinRows(cells: Map<string, string>, column: string, start: number, end: number) {
  return Array.from({ length: end - start }, (_, index) => cells.get(`${column}${start + index}`)?.trim()).filter(Boolean).join(" ").replace(/\s+([.,;:])/g, "$1").trim();
}

async function sheetDrawing(zip: JSZip, sheetPath: string, sheetXml: string) {
  const relId = sheetXml.match(/<drawing r:id="([^"]+)"/)?.[1];
  if (!relId) return undefined;
  const relsPath = sheetPath.replace("xl/worksheets/", "xl/worksheets/_rels/") + ".rels";
  const rels = relationships(await zip.file(relsPath)?.async("string") ?? "");
  const target = rels[relId];
  if (!target) return undefined;
  const path = normalizePath(sheetPath, target);
  const xml = await zip.file(path)?.async("string");
  if (!xml) return undefined;
  return { path, xml, relsPath: path.replace("xl/drawings/", "xl/drawings/_rels/") + ".rels" };
}

function relationships(xml: string) {
  return Object.fromEntries([...xml.matchAll(relationshipPattern)].map((match) => [match[1], decodeXml(match[2])]));
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

async function findCellAcrossSheets(sheets: Awaited<ReturnType<typeof workbookSheets>>, zip: JSZip, strings: string[], ref: string) {
  for (const sheet of sheets) {
    const xml = await zip.file(sheet.path)?.async("string");
    const value = xml ? readCells(xml, strings).get(ref) : undefined;
    if (value && !han.test(value)) return value;
  }
  return undefined;
}

async function ensureContentType(zip: JSZip, extension: string) {
  const mime: Record<string, string> = { png: "image/png", jpeg: "image/jpeg", jpg: "image/jpeg", emf: "image/x-emf" };
  const file = zip.file("[Content_Types].xml")!;
  let xml = await file.async("string");
  if (!new RegExp(`<Default Extension="${extension}"`, "i").test(xml)) {
    xml = xml.replace("</Types>", `<Default Extension="${extension}" ContentType="${mime[extension] ?? "application/octet-stream"}"/></Types>`);
    zip.file("[Content_Types].xml", xml, { createFolders: false });
  }
}

function decodeXml(value: string) {
  return value.replace(/&#(?:x([\da-f]+)|(\d+));/gi, (_entity, hex, decimal) => String.fromCodePoint(Number.parseInt(hex ?? decimal, hex ? 16 : 10))).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

import assert from "node:assert/strict";
import test from "node:test";

import JSZip from "jszip";

import { buildTranslatedDocument, extractChineseDocumentPhrases, extractDocumentBlocks, extractDocumentPhrases } from "../lib/docx-translator.ts";

test("translates Word paragraphs across formatted runs without changing document assets", async () => {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", "<Types/>");
  zip.file("word/document.xml", "<w:document><w:body><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>安装</w:t></w:r><w:r><w:t>电机</w:t></w:r></w:p><w:p><w:r><w:t>Already English</w:t></w:r></w:p><w:p><w:r><w:drawing><a:blip r:embed=\"rId1\"/></w:drawing></w:r></w:p></w:body></w:document>");
  zip.file("word/_rels/document.xml.rels", "<Relationships><Relationship Id=\"rId1\" Target=\"media/image1.png\"/></Relationships>");
  zip.file("word/header1.xml", "<w:hdr><w:p><w:r><w:t>注意安全</w:t></w:r></w:p></w:hdr>");
  zip.file("word/media/image1.png", new Uint8Array([1, 2, 3]));
  const document = await zip.generateAsync({ type: "arraybuffer" });

  assert.deepEqual(await extractChineseDocumentPhrases(document), ["安装电机", "注意安全"]);
  assert.deepEqual(await extractDocumentPhrases(document), ["安装电机", "Already English", "注意安全"]);
  const blocks = await extractDocumentBlocks(document);
  assert.deepEqual(blocks.map(({ index, text, images }) => ({ index, text, images: images.length })), [
    { index: 0, text: "安装电机", images: 0 },
    { index: 1, text: "Already English", images: 0 },
    { index: 2, text: "", images: 1 },
  ]);

  const output = await buildTranslatedDocument(document, { "安装电机": "Install motor", "注意安全": "Observe safety" });
  const translated = await JSZip.loadAsync(output);
  const body = await translated.file("word/document.xml")!.async("string");
  const header = await translated.file("word/header1.xml")!.async("string");

  assert.match(body.replace(/<[^>]+>/g, ""), /Install motorAlready English/);
  assert.match(body, /<w:b\/>/);
  assert.equal(header.replace(/<[^>]+>/g, ""), "Observe safety");
  assert.deepEqual(await translated.file("word/media/image1.png")!.async("uint8array"), new Uint8Array([1, 2, 3]));
  assert.deepEqual(await extractChineseDocumentPhrases(output), []);
});

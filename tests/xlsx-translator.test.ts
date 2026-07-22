import assert from "node:assert/strict";
import test from "node:test";

import JSZip from "jszip";

import { buildTranslatedWorkbook, extractChinesePhrases, extractWorkbookPhrases } from "../lib/xlsx-translator.ts";

test("translates used shared and inline strings without changing workbook assets", async () => {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", "<Types/>");
  zip.file("xl/workbook.xml", "<workbook/>");
  zip.file("xl/sharedStrings.xml", "<sst><si><t>安装电机</t></si><si><t>未使用</t></si><si><r><t>检查</t></r><r><t>螺钉</t></r></si><si><t>Already English</t></si></sst>");
  zip.file("xl/worksheets/sheet1.xml", "<worksheet><sheetData><row><c r=\"A0\" s=\"1\"/><c r=\"A1\" t=\"s\"><v>0</v></c><c r=\"A2\" t=\"s\"><v>2</v></c><c r=\"A3\" t=\"inlineStr\"><is><t>注意安全 &amp; 防护</t></is></c><c r=\"A4\" t=\"s\"><v>3</v></c></row></sheetData></worksheet>");
  zip.file("xl/drawings/drawing1.xml", "<xdr:wsDr><xdr:sp><a:txBody><a:p><a:r><a:t>电机</a:t></a:r><a:r><a:t>标记</a:t></a:r></a:p></a:txBody></xdr:sp></xdr:wsDr>");
  zip.file("xl/media/image1.png", new Uint8Array([1, 2, 3, 4]));
  const workbook = await zip.generateAsync({ type: "arraybuffer" });

  assert.deepEqual(await extractChinesePhrases(workbook), ["注意安全 & 防护", "安装电机", "检查螺钉", "电机标记"]);
  assert.deepEqual(await extractWorkbookPhrases(workbook), ["注意安全 & 防护", "安装电机", "检查螺钉", "Already English", "电机标记"]);

  const output = await buildTranslatedWorkbook(workbook, {
    "安装电机": "Install motor",
    "检查螺钉": "Check screws",
    "注意安全 & 防护": "Observe safety & protection",
    "电机标记": "Motor mark",
  });
  const translated = await JSZip.loadAsync(output);
  const sharedStrings = await translated.file("xl/sharedStrings.xml")!.async("string");
  const worksheet = await translated.file("xl/worksheets/sheet1.xml")!.async("string");
  const drawing = await translated.file("xl/drawings/drawing1.xml")!.async("string");

  assert.match(sharedStrings, /Install motor/);
  assert.match(sharedStrings.replace(/<[^>]+>/g, ""), /Check screws/);
  assert.match(sharedStrings, /未使用/);
  assert.match(worksheet, /Observe safety &amp; protection/);
  assert.equal(drawing.replace(/<[^>]+>/g, ""), "Motor mark");
  assert.doesNotMatch(sharedStrings, /<t[^>]*><\/t>/);
  assert.doesNotMatch(drawing, /<a:t[^>]*><\/a:t>/);
  assert.deepEqual(await translated.file("xl/media/image1.png")!.async("uint8array"), new Uint8Array([1, 2, 3, 4]));
  assert.deepEqual(Object.keys(translated.files), Object.keys(zip.files));
});

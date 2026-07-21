import assert from "node:assert/strict";
import test from "node:test";

import JSZip from "jszip";

import { buildCompanyTemplate, type TemplateMetadata } from "../lib/company-template.ts";

test("reuses native picture anchors and hides unused template pages", async () => {
  const zip = new JSZip();
  const requiredCells = new Set([
    "E3", "P1", "P2", "P3", "P4", "D5", "H5", "K5", "M5", "O5", "A33", "B49",
    "Q12", "Q15", "Q17", "Q19", "Q21",
  ]);
  for (let row = 24; row <= 32; row++) for (const column of ["Q", "T", "U"]) requiredCells.add(`${column}${row}`);
  const sheetXml = `<worksheet><sheetData><row>${[...requiredCells].map((ref) => `<c r="${ref}" s="1"/>`).join("")}</row></sheetData><drawing r:id="rId1"/></worksheet>`;
  const pictureAnchor = "<xdr:twoCellAnchor><xdr:from><xdr:row>6</xdr:row></xdr:from><xdr:pic><xdr:blipFill><a:blip r:embed=\"rId1\"/></xdr:blipFill></xdr:pic><xdr:clientData/></xdr:twoCellAnchor>";
  const legacyTextAnchor = "<xdr:twoCellAnchor><xdr:from><xdr:row>40</xdr:row></xdr:from><xdr:sp><a:t>Step Kerja</a:t></xdr:sp><xdr:clientData/></xdr:twoCellAnchor>";

  zip.file("[Content_Types].xml", "<Types></Types>");
  zip.file("xl/workbook.xml", "<workbook><sheets><sheet name=\"Page 1\" r:id=\"rId1\"/><sheet name=\"Page 2\" r:id=\"rId2\"/></sheets></workbook>");
  zip.file("xl/_rels/workbook.xml.rels", "<Relationships><Relationship Id=\"rId1\" Target=\"worksheets/sheet1.xml\"/><Relationship Id=\"rId2\" Target=\"worksheets/sheet2.xml\"/></Relationships>");
  zip.file("xl/worksheets/sheet1.xml", sheetXml);
  zip.file("xl/worksheets/sheet2.xml", sheetXml);
  zip.file("xl/worksheets/_rels/sheet1.xml.rels", "<Relationships><Relationship Id=\"rId1\" Target=\"../drawings/drawing1.xml\"/></Relationships>");
  zip.file("xl/drawings/drawing1.xml", `<xdr:wsDr>${pictureAnchor}${legacyTextAnchor}</xdr:wsDr>`);
  zip.file("xl/drawings/_rels/drawing1.xml.rels", "<Relationships><Relationship Id=\"rId1\" Target=\"../media/example.png\"/></Relationships>");
  zip.file("xl/media/example.png", new Uint8Array([0]));

  const metadata: TemplateMetadata = {
    ikNumber: "IK-1", revision: "00", date: "21/07/2026", product: "AC", station: "Assembly",
    series: "Indoor", cycleTime: "60", model: "M1", author: "Operator",
  };
  const output = await buildCompanyTemplate(await zip.generateAsync({ type: "arraybuffer" }), metadata, [{
    title: "Install motor", instruction: "Install the motor.", keyPoints: ["Use correct torque"],
    images: [{ extension: "png", data: new Uint8Array([1, 2, 3]) }],
  }]);
  const result = await JSZip.loadAsync(output);
  const workbook = await result.file("xl/workbook.xml")!.async("string");
  const worksheet = await result.file("xl/worksheets/sheet1.xml")!.async("string");
  const drawing = await result.file("xl/drawings/drawing1.xml")!.async("string");
  const drawingRels = await result.file("xl/drawings/_rels/drawing1.xml.rels")!.async("string");

  assert.match(workbook, /<sheet name="1" r:id="rId1"\/>/);
  assert.match(workbook, /<sheet name="Unused 2" r:id="rId2" state="hidden"\/>/);
  assert.match(worksheet, /Work Steps:\nInstall the motor\./);
  assert.match(worksheet, /<mergeCell ref="A33:O43"\/>/);
  assert.equal(drawing, `<xdr:wsDr>${pictureAnchor}</xdr:wsDr>`);
  assert.match(drawingRels, /Target="\.\.\/media\/company-step-1-1\.png"/);
  assert.deepEqual(await result.file("xl/media/company-step-1-1.png")!.async("uint8array"), new Uint8Array([1, 2, 3]));
});

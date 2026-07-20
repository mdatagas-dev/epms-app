import type { Metadata } from "next";

import { InstructionTranslator } from "@/components/instruction-translator";

export const metadata: Metadata = { title: "Instruction Translator · EPMS" };

export default function InstructionTranslatorPage() {
  return <main className="page-shell">
    <div className="page-heading"><div><p className="eyebrow">Work instruction utility</p><h1>Chinese to English Translator</h1><p className="page-subtitle">Translate editable cell text while preserving the original Excel workbook structure.</p></div></div>
    <InstructionTranslator />
  </main>;
}

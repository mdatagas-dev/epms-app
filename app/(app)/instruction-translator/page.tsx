import type { Metadata } from "next";

import { InstructionTranslator } from "@/components/instruction-translator";

export const metadata: Metadata = { title: "Instruction Translator · EPMS" };

export default function InstructionTranslatorPage() {
  const ninerouterConfigured = Boolean(process.env.NINEROUTER_BASE_URL && process.env.NINEROUTER_API_KEY);

  return <main className="page-shell">
    <div className="page-heading"><div><p className="eyebrow">Workbook utility</p><h1>Chinese Workbook Translator</h1><p className="page-subtitle">Translate legacy XLS or modern XLSX workbooks into English or Bahasa Indonesia.</p></div></div>
    <InstructionTranslator ninerouterConfigured={ninerouterConfigured} />
  </main>;
}

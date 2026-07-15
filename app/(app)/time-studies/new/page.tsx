import { CycleEntryForm } from "@/components/cycle-entry-form";
import { getMasterData } from "@/lib/data";

export default async function NewTimeStudyPage() {
  const masters = await getMasterData();
  return <main className="page-shell page-shell--narrow"><div className="page-heading"><div><p className="eyebrow">New measurement</p><h1>Create Time Study</h1><p className="page-subtitle">Minimal 30 valid cycles. Paste langsung dari Excel atau isi per baris.</p></div></div><CycleEntryForm models={masters.models} lines={masters.lines} elements={masters.elements} /></main>;
}

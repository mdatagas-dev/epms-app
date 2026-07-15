import { MotionStudyForm } from "@/components/motion-study-form";
import { getMasterData } from "@/lib/data";

export default async function NewMotionStudyPage() {
  const masters = await getMasterData();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
  return <main className="page-shell page-shell--narrow">
    <div className="page-heading"><div><p className="eyebrow">New observation</p><h1>Create Motion Study</h1><p className="page-subtitle">Classify every observed motion explicitly. Suggestions remain editable.</p></div></div>
    <MotionStudyForm models={masters.models} lines={masters.lines} stations={masters.stations} today={today}/>
  </main>;
}

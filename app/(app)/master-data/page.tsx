import { MasterDataManager } from "@/components/master-data-manager";
import { getMasterData } from "@/lib/data";
import { requireUser } from "@/lib/session";

export default async function MasterDataPage() {
  const [data, user] = await Promise.all([getMasterData(), requireUser()]);
  return (
    <main className="page-shell">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Controlled references</p>
          <h1>Master Data</h1>
          <p className="page-subtitle">Maintain the references used by Time Study, Line Balance, and Capacity calculations.</p>
        </div>
      </div>
      <MasterDataManager data={data} canManage={user.role === "supervisor"} />
    </main>
  );
}

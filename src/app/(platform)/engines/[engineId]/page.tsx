import { notFound } from "next/navigation";
import { getEngineById } from "@/lib/engines/registry";
import EngineComingSoon from "./EngineComingSoon";
import MaDashboard from "@/components/engines/MaDashboard";
import FinanceDashboard from "@/components/engines/FinanceDashboard";
import RegulatoryDashboard from "@/components/engines/RegulatoryDashboard";
import SalesDashboard from "@/components/engines/SalesDashboard";
import ProductDashboard from "@/components/engines/ProductDashboard";

interface EnginePageProps {
  params: Promise<{ engineId: string }>;
}

/** Map engine IDs to their dedicated dashboard components */
const ENGINE_DASHBOARDS: Record<string, React.ComponentType<{ engine: ReturnType<typeof getEngineById> & {} }>> = {
  ma: MaDashboard,
  finance: FinanceDashboard,
  regulatory: RegulatoryDashboard,
  sales: SalesDashboard,
  product: ProductDashboard,
};

export default async function EnginePage({ params }: EnginePageProps) {
  const { engineId } = await params;
  const engine = getEngineById(engineId);

  if (!engine) {
    notFound();
  }

  // Render dedicated dashboard for active engines, fallback to coming-soon
  if (engine.status === "active" && ENGINE_DASHBOARDS[engine.id]) {
    const Dashboard = ENGINE_DASHBOARDS[engine.id];
    return <Dashboard engine={engine} />;
  }

  return <EngineComingSoon engine={engine} />;
}

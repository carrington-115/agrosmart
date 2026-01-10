import { DashboardHeader } from "@/components/web";

export default function Dashboard() {
  return (
    <div>
      <DashboardHeader
        leftContent={<h1>leftContent</h1>}
        rightContent={<h1>Right content</h1>}
      />
    </div>
  );
}

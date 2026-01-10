import { AppSidebar } from "@/components/web";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-[100vw] overflow-x-hidden mx-auto">
      <div>
        <AppSidebar />
      </div>
      <main className="w-[100%] flex-1 mx-auto">{children}</main>
    </div>
  );
}

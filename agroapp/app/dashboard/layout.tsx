import { AppSidebar } from "@/components/web";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex max-w-full container mx-auto">
      <div>
        <AppSidebar />
      </div>
      <main className="w-[100%] flex-1 mx-auto">{children}</main>
    </div>
  );
}

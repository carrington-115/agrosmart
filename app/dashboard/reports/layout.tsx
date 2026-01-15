import { ReportsHeader } from "@/components/web";

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-full container mx-auto">
      <ReportsHeader reports={true} />

      <main className="w-full max-w-full">{children}</main>
    </div>
  );
}

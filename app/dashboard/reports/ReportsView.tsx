"use client";

import { Button } from "@/components/ui/button";
import { DashboardEmptyTemplate, ReportsCard } from "@/components/web";
import { reportsCardProps } from "@/lib/types";
import { Download, FileText } from "lucide-react";
import { useRouter } from "next/navigation";

/**
 * Client half of the reports page. The empty state now reflects whether any
 * sensor has reported, rather than a hardcoded `useState(false)`.
 */
export default function ReportsView({
  reports,
}: {
  reports: reportsCardProps[];
}) {
  const router = useRouter();

  if (!reports.length) {
    return (
      <div className="w-full h-[80vh] flex justify-center items-center">
        <DashboardEmptyTemplate
          Icon={<FileText />}
          title="No reports found"
          description="Reports are generated from sensor readings. Add a sensor and wait for its first reading to appear here."
          actionText="Get Started"
          action={() => router.push("/dashboard/sensors")}
          anotherButtonAction={() => router.push("/dashboard/settings")}
        />
      </div>
    );
  }

  return (
    <section className="flex flex-col px-4 gap-4 mt-5">
      <div className="w-full flex items-center justify-between">
        <h3 className="text-lg font-semibold">Download summary report</h3>
        <Button asChild>
          <a href="/api/reports/summary" download>
            Download summary <Download />
          </a>
        </Button>
      </div>
      <div className="grid grid-cols-4 gap-4 mb-16">
        {reports.map((report) => (
          <ReportsCard key={report.title} {...report} />
        ))}
      </div>
    </section>
  );
}

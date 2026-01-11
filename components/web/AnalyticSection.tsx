import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { dataAnalysisContent } from "@/app/dashboard/page";
import { AnalyticsCard } from "@/components/web";

export default function Analytics() {
  return (
    <section className="max-w-[100%] mx-0 px-4 py-5 overflow-x-hidden">
      <div className="w-full flex flex-col gap-4">
        <div className="w-full flex items-center justify-between">
          <h2 className="text-2xl font-semibold">SSSP Data Readings</h2>
          <Button
            className="!bg-primary-container !text-on-primary-container"
            variant={"secondary"}
          >
            View all <ArrowRight />
          </Button>
        </div>
        <div className="w-full flex justify-between">
          {dataAnalysisContent.map((item) => (
            <AnalyticsCard key={item.title} {...item} />
          ))}
        </div>
      </div>
    </section>
  );
}

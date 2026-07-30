import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { AnalyticsCard } from "@/components/web";
import { analyticsProps } from "@/lib/types";

export default function Analytics({ items }: { items: analyticsProps[] }) {
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
        <div className="w-full grid grid-cols-4 gap-5 justify-between">
          {items.map((item) => (
            <AnalyticsCard key={item.title} {...item} />
          ))}
        </div>
      </div>
    </section>
  );
}

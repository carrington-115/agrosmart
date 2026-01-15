"use client";

import { DetailedReport } from "@/components/web";
import { detailedReportProps } from "@/lib/types";
import { twMerge } from "tailwind-merge";

const detailedReportSuggestions: detailedReportProps[] = [
  {
    title: "Weekly Soil Nutrient Summary (Jan 8–14, 2026)",
    description:
      "Comprehensive analysis of NPK levels, pH, organic carbon, and EC from your IoT sensors across 3 fields. Nitrogen remains low at 88–94 mg/kg, while Phosphorus and Potassium are in optimal range. Includes trend graphs and comparison with last month's readings.",
    exportFunction: () => {},
    AISummary: () => {},
  },
  {
    title: "Maize Crop Health & Pest Risk Report",
    description:
      "Detailed assessment based on leaf camera images and environmental data. Detected early nitrogen deficiency symptoms and low risk of fall armyworm (score: 18/100). Recommends foliar application of 19:19:19 + neem oil within 5 days to prevent spread.",
    exportFunction: () => {},
    AISummary: () => {},
  },
  {
    title: "Irrigation & Water Usage Report (Last 30 Days)",
    description:
      "Shows total water applied: 420 mm, efficiency: 71%, savings: ~38,000 liters/ha compared to flood irrigation. Critical dry spell detected Jan 10–14. Recommends scheduling next drip cycle for tomorrow morning (18–22 mm).",
    exportFunction: () => {},
    AISummary: () => {},
  },
  {
    title: "Projected Yield & Market Outlook – Wheat (Rabi 2025-26)",
    description:
      "Current projection: 4.9–5.3 tons/ha (based on NPK trends, weather forecast, and growth stage). Mandi prices in Lucknow expected to rise 8–12% by mid-February. Recommendation: Delay sale by 10–15 days if storage available.",
    exportFunction: () => {},
    AISummary: () => {},
  },
  {
    title: "Sustainability & Carbon Footprint Report",
    description:
      "This season's estimated carbon sequestration: 1.7 t/ha. Water use efficiency improved 22% YoY. Organic practices adopted on 40% of land. Total carbon credits potential: ~₹12,500/ha if certified. Includes comparison with conventional farming benchmarks.",
    exportFunction: () => {},
    AISummary: () => {},
  },
];

export default function Detailed() {
  return (
    <div className="w-full max-w-full">
      <div className={twMerge("flex flex-col px-4 gap-4 mt-5")}>
        {detailedReportSuggestions.map((report) => (
          <DetailedReport key={report.title} {...report} />
        ))}
      </div>
    </div>
  );
}

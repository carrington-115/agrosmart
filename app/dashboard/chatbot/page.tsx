"use client";

import { ChatHeader, ChatInput, Suggestion } from "@/components/web";
import Image from "next/image";
import agrologo from "@/assets/images/logo-dark.svg";
import { useState } from "react";
import { botSuggestionsProps, Message } from "@/lib/types";

const fakeSuggestion: botSuggestionsProps[] = [
  {
    header: "Your Projected Yield & Market Tip",
    suggestions:
      "Based on current NPK trends, weather, and growth stage, expected yield is ~4.8-5.2 tons/ha. Current mandi prices for your variety are ₹2,150-2,280/quintal — consider holding for 10-15 days as prices are trending upward.",
    footer: "Market forecast",
    action: () => {
      /* View full yield forecast dashboard or connect to buyer network */
    },
  },
  {
    header: "Early Pest/Disease Alert",
    suggestions:
      "Leaf images from your field camera indicate early signs of nitrogen deficiency + possible mild leaf blight. Suggested action: Apply balanced foliar spray (NPK 19:19:19) + neem-based organic pesticide this week.",
    footer: "Pest detection",
    action: () => {
      /* Open disease scanner or product marketplace */
    },
  },
  {
    header: "Time to Water Your Crop",
    suggestions:
      "Soil moisture has dropped to 28% (critical threshold for your maize crop). Recommend 18-22 mm of irrigation within the next 12 hours to prevent stress. Weather forecast shows no rain until Friday.",
    footer: "Irrigation",
    action: () => {
      /* Trigger automated drip schedule or show irrigation map */
    },
  },
  {
    header: "Optimize Your Nutrient Balance",
    suggestions:
      "Current soil readings show Nitrogen is low (85 mg/kg), Phosphorus adequate, but Potassium slightly high. Consider applying 25-30 kg/ha of Urea in the next 7 days to boost leaf growth without risking excess K.",
    footer: "Fertilizer recommendation",
    action: () => {
      /* Open detailed fertilizer calculator or schedule reminder */
    },
  },
];

export default function Chatbot() {
  const [messages, setMessages] = useState<Message[]>([]);

  return (
    <div>
      <ChatHeader />
      {messages.length > 0 ? (
        <></>
      ) : (
        <div className="px-4 h-[80vh] w-full flex gap-5 flex-col items-center justify-center">
          <div className="flex items-center gap-2">
            <Image src={agrologo} alt="agrosmart logo" width={80} height={80} />
            <h1 className="text-4xl font-bold text-on-primary-container/50">
              Ask AgroSmart
            </h1>
          </div>
          <div className="w-full grid grid-cols-4 gap-5">
            {fakeSuggestion.map((suggestion) => (
              <Suggestion key={suggestion.header} {...suggestion} />
            ))}
          </div>
          <ChatInput messages={messages} />
        </div>
      )}
    </div>
  );
}

"use client";

import { ChatHeader, ChatInput, Suggestion } from "@/components/web";
import Image from "next/image";
import agrologo from "@/assets/images/logo-dark.svg";
import { useState } from "react";
import {
  botSuggestionsProps,
  Message,
  type knowledgeBase,
  contextType,
  ChatUser,
} from "@/lib/types";
import ChatElement from "@/components/web/ChatElement";

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

const knowledgeBase: knowledgeBase[] = [
  {
    contextType: contextType.LINK,
    link: "https://www.cis.jhu.edu/~younes/machine_learning.pdf",
    title: "Introduction to Machine Learning - Laurent Younes",
    description:
      "Comprehensive free textbook covering mathematical foundations of ML, useful for understanding crop yield prediction models.",
  },
  {
    contextType: contextType.LINK,
    link: "https://www.fao.org/3/ca8753en/ca8753en.pdf",
    title:
      "FAO Guidelines - Nutrient Management for Sustainable Crop Production",
    description:
      "Official FAO guide on balanced NPK fertilization and soil health management.",
  },
  {
    contextType: contextType.LINK,
    link: "https://agritech.tnau.ac.in/agriculture/agri_nutrientmgt_NPK.html",
    title: "TNAU Agritech Portal - NPK Recommendations for Major Crops",
    description:
      "State-specific NPK fertilizer recommendations for crops commonly grown in Uttar Pradesh.",
  },
  {
    contextType: contextType.FILE,
    link: "/uploads/soil-testing-procedure-2025.pdf",
    title: "Standard Soil Testing Procedure (ICAR 2025)",
    description:
      "Official document detailing how to collect, process and interpret soil samples for NPK analysis.",
  },
  {
    contextType: contextType.LINK,
    link: "https://krishi.icar.gov.in/jspui/bitstream/123456789/78901/1/fert-recommendation-up.pdf",
    title: "ICAR - Fertilizer Recommendations for Uttar Pradesh Soils",
    description:
      "Region-specific fertilizer dosage charts based on soil test results for major crops in UP.",
  },
  {
    contextType: contextType.FILE,
    link: "/knowledge/crop-water-requirement-lucknow.xlsx",
    title: "Crop Water Requirements - Lucknow Region (2024-2025)",
    description:
      "Excel sheet with daily/weekly evapotranspiration and irrigation requirements for major crops.",
  },
  {
    contextType: contextType.LINK,
    link: "https://plantvillage.psu.edu/",
    title: "PlantVillage - AI-powered Plant Disease Identification",
    description:
      "Reference resource for visual disease identification and management practices.",
  },
  {
    contextType: contextType.FILE,
    link: "/uploads/pesticide-organic-alternatives-2026.pdf",
    title: "Organic Alternatives to Chemical Pesticides (2026 Update)",
    description:
      "List of neem, bio-pesticides and cultural practices for common pests in North India.",
  },
];

export default function Chatbot() {
  const [messages, setMessages] = useState<Message[]>([]);

  return (
    <div className="w-full flex flex-col items-center pb-[4rem]">
      <ChatHeader />
      {messages.length > 0 ? (
        <>
          <section className="w-[50%] flex flex-col gap-8">
            {messages.map((message) => (
              <ChatElement
                key={message.id}
                message={message}
                role={message.role}
                knowledgeBase={["hello"]}
                attachments={["lll"]}
              />
            ))}
            <ChatElement
              message={{
                id: "",
                content:
                  "Based on current NPK trends, weather, and growth stage, expected yield is ~4.8-5.2 tons/ha. Current mandi prices for your variety are ₹2,150-2,280/quintal — consider holding for 10-15 days as prices are trending upward.",
                role: ChatUser.AGENT,
              }}
              role={ChatUser.AGENT}
            />
          </section>
        </>
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
          <ChatInput messages={messages} setMessages={setMessages} />
        </div>
      )}
      {messages.length > 0 && (
        <section className="w-full flex justify-center items-center fixed bottom-5">
          <ChatInput messages={messages} setMessages={setMessages} />
        </section>
      )}
    </div>
  );
}

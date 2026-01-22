import {
  chatElementProps,
  ChatUser,
  type knowledgeBase,
  contextType,
} from "@/lib/types";
import { Button } from "../ui/button";
import {
  CircleX,
  Copy,
  File,
  Link,
  Paperclip,
  Pencil,
  Share,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { twMerge } from "tailwind-merge";
import { Badge } from "../ui/badge";
import testImage from "@/assets/images/92be93fe63af9ecf1afbc0561386d564248a535f.jpg";
import agentIcon from "@/assets/images/logo-light.svg";
import Image from "next/image";
import React from "react";

const someKnowledgeBase: knowledgeBase[] = [
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
    file: true,
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
    file: true,
    title: "Standard Soil Testing Procedure (ICAR 2025)",
    description:
      "Official document detailing how to collect, process and interpret soil samples for NPK analysis.",
  },
];

const someAttachments: any[] = [
  {
    link: testImage,
    title: "Test Image",
  },
];

type agentIconActionsType = {
  name: string;
  Icon: React.ReactNode;
  action: () => void;
};

const agentActions: agentIconActionsType[] = [
  {
    name: "rate-like",
    Icon: <ThumbsUp />,
    action: () => console.log("Rate like"),
  },
  {
    name: "rate-dislike",
    Icon: <ThumbsDown />,
    action: () => console.log("Rate dislike"),
  },
  {
    name: "copy",
    Icon: <Copy />,
    action: () => console.log("Copy"),
  },
];

export default function ChatElement({
  message,
  role,
  knowledgeBase,
  attachments,
}: chatElementProps) {
  return (
    <section
      className={twMerge(
        "max-w-full mx-auto break-words overflow-hidden flex items-center",
        role === ChatUser.USER ? "justify-end" : "justify-center",
      )}
    >
      <div className="max-w-full">
        <div className="flex gap-1 items-center justify-end flex-wrap">
          {role === ChatUser.USER &&
            knowledgeBase &&
            knowledgeBase.length > 0 &&
            someKnowledgeBase.map((context) => (
              <Badge
                key={context.link}
                className="bg-primary-container text-on-primary-container cursor-pointer hover:bg-on-primary-container hover:text-primary-container shrink-0 max-w-[180px] truncate"
              >
                {context.file ? <File /> : <Link />}
                <span className="truncate">{context.title}</span>
                <span className="">
                  <CircleX width={12} height={12} />
                </span>
              </Badge>
            ))}
        </div>
        {/* For context */}

        {role === ChatUser.USER ? (
          <div className="max-w-full break-words overflow-hidden flex flex-col items-end gap-1 mt-4">
            <div
              className={twMerge(
                "max-w-full break-words overflow-hidden",
                role === ChatUser.USER
                  ? "bg-neutral-100 px-5 py-3 max-w-[80%] rounded-tl-lg rounded-tr-4xl rounded-bl-lg rounded-br-sm"
                  : "",
              )}
            >
              <p className="break-words hyphens-auto overflow-wrap-anywhere max-w-full">
                {message.content}
              </p>
            </div>
            {/* For added imagews to the prompt */}
            {attachments &&
              attachments.length > 0 &&
              role === ChatUser.USER && (
                <div className="w-full overflow-x-auto flex justify-end gap-2 mt-4">
                  {someAttachments.map((attachment) => (
                    <Image
                      src={attachment.link}
                      alt={attachment.link}
                      width={100}
                      height={100}
                      className="rounded-lg cursor-pointer"
                      key={attachment.link}
                    />
                  ))}
                </div>
              )}
            <div className="flex items-center gap-3">
              <Button
                variant={"ghost"}
                size={"icon-sm"}
                className="rounded-full"
              >
                <Pencil />
              </Button>
              <Button
                variant={"ghost"}
                size={"icon-sm"}
                className="rounded-full"
              >
                <Copy />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-end gap-5 p-6 rounded-lg bg-primary-container/50 text-on-primary-container mb-20">
            <div className="w-full flex items-start gap-5">
              <Image
                src={agentIcon}
                alt="agent is chatting..."
                width={50}
                height={50}
              />
              <p className="break-words hyphens-auto overflow-wrap-anywhere max-w-full">
                {message.content}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {agentActions.map((action) => (
                <Button
                  variant={"ghost"}
                  size={"icon-sm"}
                  className="rounded-full hover:bg-primary-container text-on-primary-container"
                  key={action.name}
                  onClick={action.action}
                >
                  {action.Icon}
                </Button>
              ))}
              <Button className="rounded-full bg-on-primary-container/95 hover:bg-on-primary-container">
                Export as PDF <Share />
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

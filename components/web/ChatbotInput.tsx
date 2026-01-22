"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { chatSchema } from "@/lib/schema";
import { useState } from "react";
import {
  ChatUser,
  Message,
  modelType,
  modeType,
  webSourceProps,
} from "@/lib/types";
import { Form, FormField, FormItem, FormControl } from "../ui/form";
import { Button } from "../ui/button";
import { ArrowUp, Ellipsis, Mic, Paperclip, Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Textarea } from "../ui/textarea";
import { Input } from "../ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { twMerge } from "tailwind-merge";

export default function ChatInput({
  messages,
  setMessages,
}: {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}) {
  const [messageMode, setMessageMode] = useState<
    modelType | webSourceProps | modeType
  >(modelType.AUTO);
  const [modelMode, setModelMode] = useState<modeType>(modeType.AUTO);

  const form = useForm<z.infer<typeof chatSchema>>({
    resolver: zodResolver(chatSchema),
    defaultValues: {
      message: "",
    },
  });

  const onSubmit = (data: z.infer<typeof chatSchema>) => {
    setMessages((prev) => {
      return [
        ...prev,
        { id: String(Date.now()), content: data.message, role: ChatUser.USER },
      ];
    });
  };

  return (
    <div
      className={twMerge(
        "w-[60%] bg-neutral-100",
        messages.length > 0 ? "rounded-xl p-4" : "rounded-full p-2",
      )}
    >
      {messages.length > 0 ? (
        <>
          <div>{/* Nothing yet to add here */}</div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              {/* form message */}
              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        id="Ask AgroSmart"
                        placeholder="Ask AgroSmart"
                        // rows={Math.min(field.value.split("\n").length || 3)}
                        className="!border-none focus-visible:border-none resize-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:ring-transparent shadow-none w-full min-h-[2.5rem] max-h-[12rem]"
                        {...field}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            form.handleSubmit(onSubmit)();
                          }
                        }}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant={"ghost"}
                    size={"icon"}
                    className="rounded-full hover:bg-neutral-200/50"
                  >
                    <Paperclip />
                  </Button>

                  <Select>
                    <SelectTrigger className="border-none shadow-none cursor-pointer hover:bg-neutral-200/50 rounded-full">
                      <SelectValue placeholder="auto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {Object.values(modeType).map((mode) => (
                          <SelectItem key={mode} value={mode}>
                            {mode}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant={"ghost"}
                          size={"icon"}
                          className="rounded-full hover:bg-neutral-200/50"
                        >
                          <Ellipsis />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuLabel>Personalization</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>Model</DropdownMenuSubTrigger>
                          <DropdownMenuPortal>
                            <DropdownMenuSubContent>
                              <DropdownMenuItem>Gpt-5.1</DropdownMenuItem>
                              <DropdownMenuItem>Gpt-4o-mini</DropdownMenuItem>
                              <DropdownMenuItem>More...</DropdownMenuItem>
                            </DropdownMenuSubContent>
                          </DropdownMenuPortal>
                        </DropdownMenuSub>
                        <DropdownMenuItem>Add web context</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size={"icon-lg"}
                    variant={"ghost"}
                    className="rounded-full hover:bg-neutral-200/50"
                  >
                    <Mic />
                  </Button>
                  <Button
                    size={"icon-lg"}
                    className="rounded-full bg-neutral-700 hover:bg-neutral-900"
                    type="submit"
                  >
                    <ArrowUp />
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </>
      ) : (
        <>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex gap-2 items-center w-[70%]">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size={"icon-lg"}
                      className="rounded-full bg-transparent text-black hover:bg-neutral-200/50"
                    >
                      <Plus />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        Select mode
                      </DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                          {Object.values(modeType).map((mode) => (
                            <DropdownMenuItem key={mode}>
                              {mode}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                    <DropdownMenuLabel>Optimize output</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>Model</DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem>Gpt-5.1</DropdownMenuItem>
                          <DropdownMenuItem>Gpt-4o-mini</DropdownMenuItem>
                          <DropdownMenuItem>More...</DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                    <DropdownMenuItem>Add web context</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* form message */}
                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          id="Ask AgroSmart"
                          placeholder="Ask AgroSmart"
                          className="!border-none focus-visible:border-none w-full resize-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:ring-transparent shadow-none w-full min-h-[2.5rem] max-h-[12rem]"
                          {...field}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              form.handleSubmit(onSubmit)();
                            }
                          }}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size={"icon-lg"}
                  variant={"ghost"}
                  className="rounded-full hover:bg-neutral-200/50"
                >
                  <Mic />
                </Button>
                <Button
                  size={"icon-lg"}
                  className="rounded-full bg-neutral-700 hover:bg-neutral-900"
                  type="submit"
                >
                  <ArrowUp />
                </Button>
              </div>
            </form>
          </Form>
        </>
      )}
    </div>
  );
}

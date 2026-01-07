"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
} from "@/components/ui/sidebar";

import {
  LayoutDashboard,
  SatelliteDish,
  BellElectric,
  BotMessageSquare,
  ScrollText,
  User2Icon,
  Settings,
} from "lucide-react";
import Image from "next/image";
import Logo from "@/assets/images/logo-light.svg";
import { useState } from "react";
import { twMerge } from "tailwind-merge";

// Menu items.
const items = {
  header: [
    {
      title: "Dashboard",
      url: "#",
      icon: LayoutDashboard,
    },
    {
      title: "Sensors",
      url: "#",
      icon: SatelliteDish,
    },
    {
      title: "Alerts",
      url: "#",
      icon: BellElectric,
    },
    {
      title: "Chatbot",
      url: "#",
      icon: BotMessageSquare,
    },
    {
      title: "Reports",
      url: "#",
      icon: ScrollText,
    },
  ],
  footer: [
    {
      title: "Profile",
      url: "#",
      icon: User2Icon,
    },
    {
      title: "Settings",
      url: "#",
      icon: Settings,
    },
  ],
};

export function AppSidebar() {
  const [sidebarOpen, setSidebarOpen] = useState<boolean | null>(null);
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <Image
            src={Logo}
            alt="logo"
            width={sidebarOpen ? 24 : 48}
            height={sidebarOpen ? 24 : 48}
          />
          {sidebarOpen && <h2 className="font-bold">AgroSmart</h2>}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.header.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.footer.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
          <div className={twMerge(sidebarOpen && "w-full flex justify-end")}>
            <SidebarTrigger onClick={() => setSidebarOpen(!sidebarOpen)} />
          </div>
        </SidebarGroup>
      </SidebarFooter>
    </Sidebar>
  );
}

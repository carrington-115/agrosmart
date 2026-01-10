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
import Link from "next/link";
import { usePathname } from "next/navigation";

// Menu items.
const items = {
  header: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "Sensors",
      url: "/dashboard/sensors",
      icon: SatelliteDish,
    },
    {
      title: "Alerts",
      url: "/dashboard/alerts",
      icon: BellElectric,
    },
    {
      title: "Chatbot",
      url: "/dashboard/chatbot",
      icon: BotMessageSquare,
    },
    {
      title: "Reports",
      url: "/dashboard/reports",
      icon: ScrollText,
    },
  ],
  footer: [
    {
      title: "Profile",
      url: "/dashboard/profile",
      icon: User2Icon,
    },
    {
      title: "Settings",
      url: "/dashboard/settings",
      icon: Settings,
    },
  ],
};

export default function AppSidebar() {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const pathname = usePathname();
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader
        className={twMerge("mt-4", !sidebarOpen && "items-center")}
      >
        <div className="flex items-center gap-2">
          <Image src={Logo} alt="logo" width={36} height={36} />
          {sidebarOpen && <h2 className="font-bold text-2xl">AgroSmart</h2>}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className={twMerge(!sidebarOpen && "items-center")}>
              {items.header.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={item.url === pathname}
                    className={twMerge(
                      item.url === pathname &&
                        "!bg-primary !text-primary-foreground"
                    )}
                  >
                    <Link href={item.url}>
                      <item.icon
                        fill={
                          pathname === item.url
                            ? "var(--primary-foreground"
                            : "none"
                        }
                        className={twMerge(!sidebarOpen && "!size-5")}
                      />
                      <span>{item.title}</span>
                    </Link>
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
            <SidebarMenu className={twMerge(!sidebarOpen && "items-center")}>
              {items.footer.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link href={item.url}>
                      <item.icon
                        fill={
                          pathname === item.url
                            ? "var(--primary-foreground"
                            : "none"
                        }
                        className={twMerge(
                          !sidebarOpen && "!size-5",
                          pathname === item.url &&
                            "!fill-[var(--primary-foreground)]"
                        )}
                      />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
          <div className={twMerge(sidebarOpen && "w-full flex justify-end")}>
            <SidebarTrigger
              onBeforeToggle={() => setSidebarOpen(!sidebarOpen)}
              onClick={() => setSidebarOpen(!sidebarOpen)}
            />
          </div>
        </SidebarGroup>
      </SidebarFooter>
    </Sidebar>
  );
}

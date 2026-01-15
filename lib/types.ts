import { chartData } from "@/components/web/LineChart";

export interface zodLoginSchema {
  email: string;
  password: string;
}

export enum HeaderType {
  DASHBOARD = "dashboard",
  OTHER = "other",
}

export interface HeaderProps {
  leftContent?: React.ReactNode;
  rightContent: React.ReactNode;
  type: HeaderType;
  title?: string;
  greeting?: string;
  getReport?: boolean;
}

export interface analyticsProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  badgeStatus: string;
  badgeColor: string;
}

export interface MonitoringChartProps {
  data?: typeof chartData;
  className?: string;
}

export interface recommendationsCardProps {
  title: string;
  content: string;
  color: string;
}

export interface alertsCardProps {
  title: string;
  description: string;
  badgeType:
    | "default"
    | "secondary"
    | "destructive"
    | "outline"
    | null
    | undefined;
  badgeInfo: string;
  alertId: string;
  viewAction?: () => void;
  acceptAction?: () => void;
  rejectAction?: () => void;
}

export interface botSuggestionsProps {
  header: string;
  suggestions: string;
  footer: string;
  action: () => void;
}

export enum modeType {
  AUTO = "auto",
  ALERTS = "alerts",
  REPORTS = "reports",
  ANALYSER = "analyser",
  RESEARCHER = "researcher",
  FORECASTER = "forecaster",
}

export enum modelType {
  AUTO = "auto",
  CUSTOM = "custom",
}

export interface webSourceProps {
  link: string;
}

export interface chatInputProps {
  message: string;
  mode: modeType;
  model: modelType;
  files: any[];
}

export interface Message {
  id: string;
  content: string;
  role: ChatUser;
  knowledgeBase?: any[];
}

export enum ChatUser {
  USER = "user",
  AGENT = "agent",
}

export type knowledgeBase = {
  contextType: contextType;
  link: string;
  file?: boolean;
  title?: string;
  description?: string;
};

export interface chatElementProps {
  message: Message;
  role: ChatUser;
  knowledgeBase?: knowledgeBase[] | any[];
  attachments?: any[];
}

export enum contextType {
  LINK = "link",
  FILE = "file",
}

export interface FilterOption {
  label: string;
  value: string;
  onSelect: () => void;
}

export interface reportsCardProps {
  title: string;
  data: number;
  description?: string;
  badgeContent: string;
  badgeVariant:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | null
    | undefined;
  reportsIcon: React.ReactNode;
}

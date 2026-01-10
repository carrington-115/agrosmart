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

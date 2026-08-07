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
  sensorView?: boolean;
}

/**
 * One point on the NPK time series.
 *
 * Defined here rather than imported from the chart component. It used to be
 * `typeof chartData`, a mock fixture living in `components/web/LineChart.tsx`,
 * while that component imported its props type back out of this file — a cycle
 * between the type layer and the UI that had to break before the chart could
 * carry real data.
 */
export interface ChartPoint {
  /** ISO timestamp of the reading. */
  time: string;
  nitrogen: number | null;
  phosphorus: number | null;
  potassium: number | null;
}

export interface MonitoringChartProps {
  data?: ChartPoint[];
  /** True when any contributing reading has `npkEstimated` set. */
  estimated?: boolean;
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
  /** open | accepted | rejected — drives the status filter. */
  state?: "open" | "accepted" | "rejected";
  /** ISO timestamp, for the date filter and display. */
  createdAt?: string | null;
  /** Device code this alert concerns, when it came from one sensor. */
  sensorId?: string | null;
  /** Steps the user can take, shown in the detail panel. */
  steps?: string[];
  /** True for alerts derived from live readings rather than stored rows. These
   *  cannot be accepted or rejected — there is no row to update. */
  derived?: boolean;
  viewAction?: () => void;
  acceptAction?: () => void;
  rejectAction?: () => void;
  busy?: boolean;
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
  link?: string;
  onSelect: () => void;
}

export interface reportsCardProps {
  title: string;
  /** `null` when no sensor reported this metric — rendered as `—`, never 0. */
  data: number | null;
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

export interface detailedReportProps {
  title: string;
  description: string;
  /** Where Export downloads from. Omitted when this report has no export yet. */
  exportHref?: string;
  /**
   * AI summaries need a language model, and none is wired up. The button is
   * disabled and says why rather than being present and inert.
   */
  aiUnavailableReason?: string;
}

/**
 * One checkbox. `id` is a `user_settings` column name rather than a free string,
 * so a renamed or mistyped preference is a type error instead of a checkbox that
 * quietly never saves.
 */
type checkType = {
  id: keyof import("@/lib/database.types").UserSettings;
  label: string;
};

export interface settingsCheckType {
  checkContent: checkType[];
  title: string;
  addSensor: boolean;
}

type npk = {
  nitrogen: number | null;
  phosphorus: number | null;
  potassium: number | null;
};

/**
 * The device's self-reported data-quality block.
 *
 * Always sent, never defaulted, and load-bearing. `null` here means the reading
 * predates the contract or arrived without one — which is a different statement
 * from "all three are false", and must never be rendered as if it were.
 */
export type Quality = {
  /** N/P/K were back-calculated from conductivity, not measured. No fertiliser
   *  recommendation may rest on them while this is true. */
  npkEstimated: boolean;
  /** Inside the probe's 5-minute settling window. Real but still converging. */
  stabilising: boolean;
  /** Conductivity was zero, which zeroes derived NPK. Expected in dry soil.
   *  Never a sensor fault. */
  soilDry: boolean;
};

/** Identifiers carried alongside a row so actions can address the DB record. */
type sensorActions = {
  /** sensors.id — the UUID primary key, distinct from the device code. */
  id: string;
  tag: string | null;
};

/**
 * A sensor plus its latest reading, as the tables and cards consume it.
 *
 * Every metric is nullable, and that is the whole point. A node whose 4-in-1
 * board is unplugged omits `phWater` entirely; storing or rendering `0.0` for it
 * would be a perfectly plausible-looking acid reading that nothing downstream
 * could distinguish from a real one.
 */
export interface Sensor {
  /** The device code printed on the sensor, e.g. 'AGS-001'. */
  sensorId: string;
  temperature: number | null;
  /**
   * Soil and water pH are separate quantities measured in different media by
   * different hardware, and cannot be merged into one number. The database's
   * `ph` column still exists as `coalesce(ph_soil, ph_water)` for compatibility,
   * but the UI reads the two directly.
   */
  phSoil: number | null;
  phWater: number | null;
  waterTemperature: number | null;
  waterLevel: number | null;
  /** Uncalibrated and relative — an LDR reading, not lux. */
  sunlight: number | null;
  moisture: number | null;
  salinity: number | null;
  npk: npk;
  quality: Quality | null;
  /** When the soil was measured. */
  recordedAt: string | null;
  /** Whether `recordedAt` is the device's clock or our arrival stamp. */
  recordedAtSource: "device" | "server" | null;
  /** Arrival of the latest payload — the liveness signal behind `status`. */
  lastSeenAt: string | null;
  rssi: number | null;
  firmwareVersion: string | null;
  /** Derived by the backend from `lastSeenAt` and thresholds, not read from the
   *  stored column, which can never say `offline`. */
  status: "normal" | "warning" | "offline";
  /**
   * Metrics outside their band, as the backend computed them.
   *
   * Each carries the band it left, so the UI can say "42% is below 30–70" without
   * holding a copy of the thresholds. Empty for an offline sensor: stale
   * complaints from a node that is unreachable are not actionable.
   */
  breaches: Breach[];
  actions: sensorActions;
}

/** A metric outside its safe range, with the range, as reported by the backend. */
export type Breach = {
  metric: string;
  value: number;
  band: { low: number; high: number };
  direction: "low" | "high";
};

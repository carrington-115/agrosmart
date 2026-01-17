import { alertsCardProps, Sensor } from "./types";

export const sampleSensors: Sensor[] = [
  {
    sensorId: "SENSOR-LKO-001",
    temperature: 24.8,
    ph: 7.1,
    sunlight: 780, // lux
    moisture: 42,
    salinity: 0.38, // dS/m
    npk: { nitrogen: 95, phosphorus: 52, potassium: 210 },
    status: "normal",
    actions: { alert: false, calibrate: false },
  },
  {
    sensorId: "SENSOR-LKO-002",
    temperature: 26.2,
    ph: 6.8,
    sunlight: 920,
    moisture: 28,
    salinity: 0.45,
    npk: { nitrogen: 78, phosphorus: 38, potassium: 180 },
    status: "warning",
    actions: { alert: true, calibrate: false }, // low moisture trigger
  },
  {
    sensorId: "SENSOR-LKO-003",
    temperature: 22.5,
    ph: 7.4,
    sunlight: 650,
    moisture: 55,
    salinity: 0.32,
    npk: { nitrogen: 142, phosphorus: 68, potassium: 320 },
    status: "normal",
    actions: { alert: false, calibrate: false },
  },
  {
    sensorId: "SENSOR-LKO-004",
    temperature: 27.9,
    ph: 8.1,
    sunlight: 1050,
    moisture: 19,
    salinity: 0.62,
    npk: { nitrogen: 65, phosphorus: 22, potassium: 145 },
    status: "warning",
    actions: { alert: true, calibrate: true }, // high salinity + low P
  },
  {
    sensorId: "SENSOR-LKO-005",
    temperature: 25.1,
    ph: 7.0,
    sunlight: 810,
    moisture: 48,
    salinity: 0.41,
    npk: { nitrogen: 110, phosphorus: 55, potassium: 265 },
    status: "normal",
    actions: { alert: false, calibrate: false },
  },
  {
    sensorId: "SENSOR-LKO-006",
    temperature: 28.4,
    ph: 6.5,
    sunlight: 450, // cloudy afternoon
    moisture: 35,
    salinity: 0.55,
    npk: { nitrogen: 88, phosphorus: 45, potassium: 198 },
    status: "warning",
    actions: { alert: true, calibrate: false }, // slight acidity + moderate salinity
  },
  {
    sensorId: "SENSOR-LKO-007",
    temperature: 23.7,
    ph: 7.6,
    sunlight: 890,
    moisture: 62,
    salinity: 0.29,
    npk: { nitrogen: 165, phosphorus: 72, potassium: 380 },
    status: "normal",
    actions: { alert: false, calibrate: false },
  },
  {
    sensorId: "SENSOR-LKO-008",
    temperature: 29.2,
    ph: 8.3,
    sunlight: 1120,
    moisture: 15,
    salinity: 0.78,
    npk: { nitrogen: 52, phosphorus: 18, potassium: 120 },
    status: "offline",
    actions: { alert: true, calibrate: true }, // multiple critical parameters
  },
  {
    sensorId: "SENSOR-LKO-009",
    temperature: 24.9,
    ph: 7.2,
    sunlight: 760,
    moisture: 51,
    salinity: 0.36,
    npk: { nitrogen: 102, phosphorus: 60, potassium: 240 },
    status: "normal",
    actions: { alert: false, calibrate: false },
  },
  {
    sensorId: "SENSOR-LKO-010",
    temperature: 26.8,
    ph: 6.9,
    sunlight: 980,
    moisture: 31,
    salinity: 0.48,
    npk: { nitrogen: 84, phosphorus: 41, potassium: 175 },
    status: "warning",
    actions: { alert: true, calibrate: false },
  },
];

// fake test data using <AlertsCard />
export const mockAlerts: alertsCardProps[] = [
  {
    title: "Low Soil Moisture Detected",
    description:
      "Soil moisture in Field A-3 is at 18% – below the recommended 30-35% for maize.",
    badgeType: "destructive",
    badgeInfo: "Urgent",
    alertId: "alert-001",
  },
  {
    title: "High Temperature Warning",
    description:
      "Temperature reached 38°C in Greenhouse B – risk of heat stress to tomatoes.",
    badgeType: "destructive",
    badgeInfo: "Critical",
    alertId: "alert-002",
  },
  {
    title: "Pest Activity Detected",
    description:
      "Early signs of fall armyworm detected in maize plot C-2 via camera trap.",
    badgeType: "destructive",
    badgeInfo: "Action Required",
    alertId: "alert-003",
  },
  {
    title: "Fertilizer Recommendation",
    description:
      "NPK levels low in Field D-1. Suggested: 20 kg/ha Urea + 15 kg/ha DAP.",
    badgeType: "secondary",
    badgeInfo: "Recommendation",
    alertId: "alert-004",
  },
  {
    title: "Irrigation Scheduled",
    description:
      "Automatic drip irrigation started in Orchard E at 06:30 AM for 45 minutes.",
    badgeType: "default",
    badgeInfo: "Info",
    alertId: "alert-005",
  },
  {
    title: "pH Level Out of Range",
    description:
      "Soil pH in Plot F-4 is 5.2 (too acidic). Consider lime application soon.",
    badgeType: "destructive",
    badgeInfo: "Warning",
    alertId: "alert-006",
  },
  {
    title: "Rainfall Incoming",
    description:
      "Heavy rain expected in next 4 hours – pause fertigation and close greenhouse vents.",
    badgeType: "secondary",
    badgeInfo: "Weather Alert",
    alertId: "alert-007",
  },
  {
    title: "Battery Low – Soil Sensor",
    description:
      "Sensor node #12 in Field B-1 has battery level at 14%. Replace soon.",
    badgeType: "outline",
    badgeInfo: "Maintenance",
    alertId: "alert-008",
  },
  {
    title: "Good Growth Progress",
    description:
      "Wheat crop in Field G-2 shows healthy NDVI increase of +0.18 since last week.",
    badgeType: "default",
    badgeInfo: "Positive",
    alertId: "alert-009",
  },
  {
    title: "Nutrient Imbalance Detected",
    description:
      "Potassium (K) levels low in tomato greenhouse C. Recommend foliar spray.",
    badgeType: "secondary",
    badgeInfo: "Recommendation",
    alertId: "alert-010",
  },
  {
    title: "Frost Risk Tonight",
    description:
      "Temperature expected to drop to 2°C tonight – activate frost protection in orchard.",
    badgeType: "destructive",
    badgeInfo: "Urgent",
    alertId: "alert-011",
  },
  {
    title: "All Systems Normal",
    description:
      "No critical alerts detected in the last 24 hours across all monitored fields.",
    badgeType: "default",
    badgeInfo: "All Good",
    alertId: "alert-012",
  },
];

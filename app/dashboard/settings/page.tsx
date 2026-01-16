import { SettingsCheck, SettingsHeader } from "@/components/web";
import UserProfileInput from "@/components/web/UserProfileInput";
import { settingsCheckType } from "@/lib/types";

const settingsValues: settingsCheckType[] = [
  {
    title: "Settings",
    checkContent: [
      {
        id: "sensor-id",
        label: "Add sensor by ID",
      },
      {
        id: "qr-code",
        label: "Add sensor by QR code",
      },
    ],
    addSensor: true,
  },
  {
    title: "Reports",
    checkContent: [
      {
        id: "weekly",
        label: "Receive reports weekly",
      },
      {
        id: "monthly",
        label: "Receive reports monthly",
      },
      {
        id: "notifications",
        label: "Send report notifications to email",
      },
    ],
    addSensor: false,
  },
  {
    title: "Alerts and notifications",
    checkContent: [
      {
        id: "dashboard",
        label: "Receive alerts on dashboard",
      },
      {
        id: "popup",
        label: "Receive alerts on popup",
      },
      {
        id: "email",
        label: "Send alerts to email",
      },
      {
        id: "sms",
        label: "Send alerts to SMS",
      },
      {
        id: "ignored",
        label: "Delete ignored alerts after 14 days",
      },
    ],
    addSensor: false,
  },
];

export default function Settings() {
  return (
    <div>
      <SettingsHeader />
      <UserProfileInput farmSettings={false} />
      <div className="flex flex-col items-center gap-5 my-5">
        {settingsValues.map((item) => (
          <SettingsCheck key={item.title} {...item} />
        ))}
      </div>
    </div>
  );
}

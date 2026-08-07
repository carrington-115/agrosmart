import { SettingsHeader } from "@/components/web";
import UserProfileInput from "@/components/web/UserProfileInput";
import { getUserSettings } from "@/lib/queries";
import SettingsView from "./SettingsView";

export default async function Settings() {
  const settings = await getUserSettings();

  return (
    <div>
      <SettingsHeader />
      <UserProfileInput farmSettings={false} />
      <SettingsView initial={settings} />
    </div>
  );
}

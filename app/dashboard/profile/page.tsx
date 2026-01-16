import { ProfileHeader, UserProfileForm } from "@/components/web";

export default function Settings() {
  return (
    <div className="flex flex-col items-center gap-5 mb-12">
      <ProfileHeader />
      <UserProfileForm farmSettings />
    </div>
  );
}

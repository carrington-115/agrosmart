import { ProfileHeader, UserProfileForm } from "@/components/web";
import { getCurrentUser, getFarm, getProfile } from "@/lib/queries";

export default async function Profile() {
  const [user, profile, farm] = await Promise.all([
    getCurrentUser(),
    getProfile(),
    getFarm(),
  ]);

  return (
    <div className="flex flex-col items-center gap-5 mb-12">
      <ProfileHeader />
      <UserProfileForm
        farmSettings
        initialProfile={{
          name: profile?.name ?? "",
          // Fall back to the address on the auth record before the profile row exists.
          email: profile?.email ?? user?.email ?? "",
          address: profile?.address ?? "",
          phone: profile?.phone ?? "",
        }}
        initialFarm={{
          country: farm?.country ?? "",
          city: farm?.city ?? "",
          address: farm?.address ?? "",
          state: farm?.state ?? "",
          farmSize: farm?.farm_size ?? 0,
          farmZones: farm?.farm_zones ?? 0,
          farmType: farm?.farm_type ?? "",
          farmName: farm?.farm_name ?? "",
        }}
      />
    </div>
  );
}

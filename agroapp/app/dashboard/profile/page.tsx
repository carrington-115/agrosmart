import { ProfileHeader, UserProfileForm } from "@/components/web";
import { getCurrentUser, getMe } from "@/lib/queries";

export default async function Profile() {
  // One request for profile and farm, rather than two: `GET /v1/me` returns both,
  // and this page needs both before it can render either.
  const [user, me] = await Promise.all([getCurrentUser(), getMe()]);
  const { profile, farm } = me;

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
          farmSize: farm?.farmSize ?? 0,
          farmZones: farm?.farmZones ?? 0,
          farmType: farm?.farmType ?? "",
          farmName: farm?.farmName ?? "",
        }}
      />
    </div>
  );
}

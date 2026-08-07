import { AppSidebar } from "@/components/web";

/**
 * Every page under /dashboard is per-user and must never be prerendered.
 *
 * Declared rather than inferred, and that distinction cost a CI failure. These
 * pages were only dynamic by accident: `apiFetch` reads the Supabase session, and
 * touching cookies is what made Next treat the route as dynamic. But `apiFetch`
 * resolves `AGRO_API_URL` *before* that read, so with the variable unset it throws
 * `NOT_CONFIGURED` first, the cookie is never touched, and Next concludes the page
 * is static and fails the build trying to prerender it.
 *
 * That made the build depend on configuration it is not supposed to need.
 * `AGRO_API_URL` is deliberately runtime-only — one image that reads its backend's
 * location — so `pnpm build` and `docker build` must both succeed with no backend
 * reachable and no address configured. It passed locally purely because a
 * developer's .env.local supplies the variable.
 *
 * Prerendering RLS-scoped data would be wrong even if it worked: the output is one
 * tenant's rows baked into a static payload.
 */
export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex max-w-full container mx-auto">
      <div>
        <AppSidebar />
      </div>
      <main className="w-[100%] flex-1 mx-auto">{children}</main>
    </div>
  );
}

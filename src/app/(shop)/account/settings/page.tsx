import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import { PasswordForm, ProfileForm } from "@/components/shop/profile-form";

export const metadata: Metadata = { title: "Settings" };

export default async function AccountSettingsPage() {
  const { user, profile } = await getSessionProfile();
  if (!user) redirect("/login?next=/account/settings");

  return (
    <div>
      <h1 className="text-2xl font-semibold sm:text-3xl">Settings</h1>
      <p className="mt-1 text-sm text-ink-soft">Your details and password.</p>

      <div className="mt-6 grid gap-6">
        <Card>
          <h2 className="font-semibold">Profile</h2>
          <p className="mb-5 text-sm text-ink-soft">Used for delivery and order updates.</p>
          <ProfileForm fullName={profile?.full_name ?? ""} phone={profile?.phone ?? ""} email={user.email ?? ""} />
        </Card>

        <Card>
          <h2 className="font-semibold">Password</h2>
          <p className="mb-5 text-sm text-ink-soft">Choose a new password of at least 8 characters.</p>
          <PasswordForm />
        </Card>
      </div>
    </div>
  );
}

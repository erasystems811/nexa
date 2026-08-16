import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { apiGet } from "../lib/api";
import { PhotoUpload } from "../components/photo-upload";
import { ProfileForm } from "../components/profile-form";

interface ProviderProfile {
  business_name: string;
  description: string | null;
  address: string | null;
  logo_url: string | null;
  cover_url: string | null;
}

interface Contact {
  contact_phone: string | null;
  contact_email: string | null;
}

/** Business profile. */
export function ProfilePage() {
  const { refreshProvider } = useAuth();
  const [provider, setProvider] = useState<ProviderProfile | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);

  useEffect(() => {
    // Loaded together so ProfileForm mounts with real defaults instead of an
    // empty contact section that a later fetch can no longer update — its
    // fields are uncontrolled-from-initial-state, set once at mount.
    Promise.all([apiGet<ProviderProfile>("/provider/me"), apiGet<Contact>("/provider/contact")]).then(
      ([p, c]) => {
        setProvider(p);
        setContact(c);
      },
    );
  }, []);

  if (!provider) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold">Business profile</h1>
      <p className="mt-1 text-sm text-muted-foreground">How customers see you.</p>

      <div className="mb-6 mt-6 space-y-4">
        <PhotoUpload kind="cover" label="Cover photo" aspect="wide" initialUrl={provider.cover_url} />
        <PhotoUpload kind="logo" label="Logo" aspect="square" initialUrl={provider.logo_url} />
      </div>

      <ProfileForm
        defaults={{
          business_name: provider.business_name,
          description: provider.description ?? "",
          address: provider.address ?? "",
          contact_phone: contact?.contact_phone ?? "",
          contact_email: contact?.contact_email ?? "",
        }}
        onSaved={refreshProvider}
      />
    </div>
  );
}

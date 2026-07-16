import { requireProvider, getContact } from "@/modules/provider";
import { PageHeader } from "@/components/ui";
import { ProfileForm } from "./profile-form";
import { PhotoUpload } from "./photo-upload";

/** Business profile. */
export default async function StudioProfile() {
  const provider = await requireProvider();
  const contact = await getContact(provider.id);

  return (
    <>
      <PageHeader title="Business profile" subtitle="How customers see you." />

      <div className="mb-6 space-y-4">
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
      />
    </>
  );
}

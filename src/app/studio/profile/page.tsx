import { requireProvider, getContact } from "@/modules/provider";
import { PageHeader } from "@/components/ui";
import { ProfileForm } from "./profile-form";

/** Business profile. */
export default async function StudioProfile() {
  const provider = await requireProvider();
  const contact = await getContact(provider.id);

  return (
    <>
      <PageHeader title="Business profile" subtitle="How customers see you." />
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

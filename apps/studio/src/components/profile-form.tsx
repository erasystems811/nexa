import { useState, type FormEvent } from "react";
import { Button } from "@nexa/design-system/src/components/ui/button";
import { Input } from "@nexa/design-system/src/components/ui/input";
import { Label } from "@nexa/design-system/src/components/ui/label";
import { Textarea } from "@nexa/design-system/src/components/ui/textarea";
import { apiSend, ApiError } from "../lib/api";

interface ProfileFormDefaults {
  business_name: string;
  description: string;
  address: string;
  contact_phone: string;
  contact_email: string;
}

/**
 * Contact details are collected but never shown to customers — Nexa masks them.
 * That is why the phone and email fields carry the note they do.
 */
export function ProfileForm({
  defaults,
  onSaved,
}: {
  defaults: ProfileFormDefaults;
  /** Called after a successful save — the caller refreshes anything derived from the provider row (e.g. the sidebar business name). */
  onSaved?: () => void;
}) {
  const [businessName, setBusinessName] = useState(defaults.business_name);
  const [description, setDescription] = useState(defaults.description);
  const [address, setAddress] = useState(defaults.address);
  const [contactPhone, setContactPhone] = useState(defaults.contact_phone);
  const [contactEmail, setContactEmail] = useState(defaults.contact_email);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setOk(false);
    try {
      await apiSend("PATCH", "/provider/profile", {
        business_name: businessName,
        description,
        address,
      });
      await apiSend("PATCH", "/provider/contact", {
        contact_phone: contactPhone,
        contact_email: contactEmail,
      });
      setOk(true);
      onSaved?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="business_name">Business name</Label>
        <Input
          id="business_name"
          name="business_name"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="address">Location</Label>
        <Input id="address" name="address" value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact_phone">Contact phone</Label>
        <Input
          id="contact_phone"
          name="contact_phone"
          type="tel"
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">Used to connect masked calls. Customers never see this number.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="contact_email">Contact email</Label>
        <Input
          id="contact_email"
          name="contact_email"
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">For Nexa to reach you. Not shown to customers.</p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {ok ? <p className="text-sm text-emerald-700">Saved.</p> : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}

import { useState, type FormEvent } from "react";
import { Button } from "@nexa/design-system/src/components/ui/button";
import { Card, CardContent } from "@nexa/design-system/src/components/ui/card";
import { Input } from "@nexa/design-system/src/components/ui/input";
import { apiSend, ApiError } from "../lib/api";

interface AddProviderResult {
  providerId: string;
  warning?: string;
}

/** Add a vendor by hand. */
export function AddProvider({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [warning, setWarning] = useState<string | undefined>(undefined);

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="shrink-0">
        Add a vendor
      </Button>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await apiSend<AddProviderResult>("POST", "/admin/providers", {
        email,
        businessName,
      });
      setOk(true);
      setWarning(result.warning);
      onAdded();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <form onSubmit={onSubmit}>
          <h2 className="text-sm font-semibold">Add a vendor</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Creates their account and approves them straight away. They get an email with a code to set their own
            password.
          </p>
          <div className="mt-3 space-y-2">
            <Input
              name="email"
              type="email"
              placeholder="Email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              name="business_name"
              placeholder="Business name"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
            />
          </div>
          {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
          {ok ? (
            <div className="mt-2 space-y-1">
              <p className="text-sm text-emerald-700">
                {warning ? "Vendor added." : "Vendor added. A set-password email is on its way to them."}
              </p>
              {warning ? <p className="text-sm text-destructive">{warning}</p> : null}
            </div>
          ) : null}
          <div className="mt-3 flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add vendor"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

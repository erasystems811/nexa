import { useState, type FormEvent } from "react";
import { Button } from "@nexa/design-system/src/components/ui/button";
import { Input } from "@nexa/design-system/src/components/ui/input";
import { Label } from "@nexa/design-system/src/components/ui/label";
import { apiUpload, ApiError } from "../lib/api";

export interface IdTypeOption {
  value: string;
  label: string;
  /** A CAC certificate is a document, not a number. Nothing to type in. */
  needsNumber: boolean;
}

/**
 * One document at a time. A vendor sends what they have, and comes back with the
 * second when they have it — asking for both in one go would turn away the
 * business whose CAC certificate is at home.
 */
export function VerifyForm({
  remainingTypes,
  acceptedMimeTypes,
  onSubmitted,
}: {
  remainingTypes: IdTypeOption[];
  acceptedMimeTypes: string[];
  /** Called after a successful send — the caller refetches identity status. */
  onSubmitted?: () => void;
}) {
  const [chosen, setChosen] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const needsNumber = remainingTypes.find((t) => t.value === chosen)?.needsNumber ?? true;

  if (remainingTypes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        You have sent Nexa every kind of ID we accept. Nothing more is needed from you.
      </p>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!chosen) {
      setError("Choose a means of identification");
      return;
    }
    if (!file) {
      setError("Attach a photo of your ID");
      return;
    }
    setPending(true);
    setError(null);
    setOk(false);
    try {
      await apiUpload("/provider/identity/documents", file, { idType: chosen, idNumber });
      setOk(true);
      setChosen("");
      setIdNumber("");
      setFile(null);
      onSubmitted?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="id_type">Which ID is this?</Label>
        <select
          id="id_type"
          name="id_type"
          required
          value={chosen}
          onChange={(e) => setChosen(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="" disabled>
            Choose one
          </option>
          {remainingTypes.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {needsNumber ? (
        <div className="space-y-1.5">
          <Label htmlFor="id_number">The number on it</Label>
          <Input id="id_number" name="id_number" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} required />
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="id_file">Photo of it</Label>
        <input
          id="id_file"
          type="file"
          name="id_file"
          required
          accept={acceptedMimeTypes.join(",")}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="flex w-full rounded-md border border-input bg-transparent p-2.5 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-secondary file:px-4 file:py-2 file:text-sm"
        />
        <span className="block text-xs text-muted-foreground">A clear photo or scan. JPG, PNG or WEBP, under 10MB.</span>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {ok ? <p className="text-sm text-emerald-700">Sent. Nexa will look at it.</p> : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send this to Nexa"}
      </Button>
    </form>
  );
}

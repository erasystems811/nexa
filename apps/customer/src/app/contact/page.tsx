import { getSession } from "@/modules/auth";
import { ContactForm } from "./contact-form";
import { Card, CardContent } from "@/components/ui/card";

export default async function ContactPage() {
  const session = await getSession();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">
          Contact Nexa
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A question, a problem, or something that doesn&rsquo;t fit anywhere else - tell us and
          someone will get back to you.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <ContactForm
            defaultName={session?.profile.full_name ?? ""}
            defaultContact={session?.profile.phone ?? session?.email ?? ""}
          />
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        You can also reach us directly at{" "}
        <a href="mailto:hello@erasystemsltd.com" className="underline">
          hello@erasystemsltd.com
        </a>
        .
      </p>
    </div>
  );
}

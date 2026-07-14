import Link from "next/link";
import type { Route } from "next";
import { Logo } from "@/components/logo";
import { Button, Card } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <Link href={"/" as Route} aria-label="Nexa home" className="mb-8 self-center">
        <Logo markClassName="size-12 rounded-2xl" textClassName="text-lg" />
      </Link>

      <Card className="text-center">
        <h1 className="text-lg font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-[color:var(--color-ink-muted)]">
          That page doesn&rsquo;t exist on Nexa.
        </p>
        <Link href={"/" as Route} className="mt-6 block">
          <Button className="w-full">Back to Nexa</Button>
        </Link>
      </Card>
    </main>
  );
}

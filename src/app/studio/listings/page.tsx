import Link from "next/link";
import type { Route } from "next";
import { requireProvider, listMyListings } from "@/modules/provider";
import { formatKobo } from "@/lib/money";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Live",
  rejected: "Rejected",
  changes_requested: "Changes requested",
  paused: "Paused",
  hidden: "Hidden by Admin",
};

/** Listings. */
export default async function StudioListings() {
  const provider = await requireProvider();
  const listings = await listMyListings(provider.id);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary mb-2">My Services</h1>
          <p className="text-muted-foreground">Manage what you offer to clients.</p>
        </div>
        <Link href={"/listings/new" as Route}>
          <Button>
            <Plus className="w-4 h-4 mr-2" /> New listing
          </Button>
        </Link>
      </div>

      {listings.length === 0 ? (
        <Card className="bg-muted/50 border-dashed">
          <CardContent className="flex flex-col items-center justify-center h-48 text-center">
            <p className="text-muted-foreground mb-4">
              No listings yet. Create one — it goes to Admin for approval before it&rsquo;s public.
            </p>
            <Link href={"/listings/new" as Route}>
              <Button>Add your first listing</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {listings.map((l) => (
            <Link key={l.id} href={`/listings/${l.id}` as Route}>
              <Card className={l.status === "hidden" || l.status === "rejected" ? "opacity-60" : undefined}>
                <CardContent className="p-6 flex flex-col h-full">
                  <div className="flex justify-between items-start mb-2 gap-3">
                    <h3 className="font-semibold text-lg truncate">{l.title}</h3>
                    <Badge variant={l.status === "approved" ? "default" : "secondary"} className="shrink-0">
                      {STATUS_LABEL[l.status] ?? l.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-6 flex-1">{l.categories?.name}</p>
                  <div className="flex items-center justify-between border-t border-border pt-4 mt-auto">
                    <div className="text-xs text-muted-foreground">
                      {l.price_type === "fixed" ? "Fixed price" : "Negotiable"}
                    </div>
                    <div className="font-bold text-primary">
                      {l.price_type === "fixed" && l.price_kobo !== null ? formatKobo(l.price_kobo) : "On request"}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

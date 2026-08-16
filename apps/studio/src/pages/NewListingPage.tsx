import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import type { Category } from "@nexa/db-types/src/types";
import { Button } from "@nexa/design-system/src/components/ui/button";
import { Card, CardContent } from "@nexa/design-system/src/components/ui/card";
import { apiGet } from "../lib/api";
import { isFlagEnabled } from "../lib/flags";
import { ListingForm } from "../components/listing-form";

interface IdentityStatus {
  verified: boolean;
  required: number;
  approvedCount: number;
}

export function NewListingPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [negotiableEnabled, setNegotiableEnabled] = useState(true);

  useEffect(() => {
    apiGet<Category[]>("/marketplace/categories").then(setCategories);
    apiGet<IdentityStatus>("/provider/identity")
      .then((i) => setVerified(i.verified))
      .catch(() => setVerified(false));
    isFlagEnabled("negotiable_pricing", "provider").then(setNegotiableEnabled);
  }, []);

  if (categories === null || verified === null) {
    return <div className="text-muted-foreground">Loading…</div>;
  }

  // No category means no admin has opened one yet. Nothing to list.
  if (categories.length === 0) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <Link to="/listings">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to listings
          </Button>
        </Link>
        <p className="text-muted-foreground">Nothing to list yet — Nexa hasn&rsquo;t opened a category.</p>
      </div>
    );
  }

  // The gate is enforced by the API regardless — this is only so a vendor
  // meets it before they fill in a form, rather than after.
  if (!verified) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <Link to="/listings">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to listings
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary mb-2">New listing</h1>
        </div>
        <Card>
          <CardContent className="p-6">
            <h2 className="text-sm font-semibold">Nexa has to know who you are first</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Every vendor on Nexa gives two means of identification, and a person at Nexa looks at
              both. It is what makes a customer trust the booking — and it is why your listing will be
              worth something when it goes up.
            </p>
            <Link to="/verification" className="mt-5 block">
              <Button className="w-full">Send your ID</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Link to="/listings">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to listings
        </Button>
      </Link>
      <div>
        <h1 className="text-3xl font-serif font-bold text-primary mb-2">New listing</h1>
        <p className="text-muted-foreground">Tell customers what you offer.</p>
      </div>
      <Card>
        <CardContent className="p-6">
          <ListingForm
            categories={categories}
            submitLabel="Create listing"
            showPhotos
            negotiableEnabled={negotiableEnabled}
            onSaved={(id) => navigate(`/listings/${id}`)}
          />
        </CardContent>
      </Card>
    </div>
  );
}

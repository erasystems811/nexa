import Link from "next/link";
import type { Route } from "next";
import { requireProvider, providerDashboard } from "@/modules/provider";
import { listProviderOrders } from "@/modules/provider";
import { formatKobo } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/status-pill";
import { Activity, Calendar, Clock, DollarSign, Star } from "lucide-react";

/** Studio dashboard. */
export default async function StudioHome() {
  const provider = await requireProvider();
  const [stats, orders] = await Promise.all([
    providerDashboard(provider.id),
    listProviderOrders(provider.id),
  ]);
  const recentOrders = orders.slice(0, 4);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-serif font-bold text-primary mb-2">{provider.business_name}</h1>
        <p className="text-muted-foreground">
          {provider.is_on_probation
            ? "New provider — your first bookings get closer attention."
            : "Overview of your performance and pending actions."}
        </p>
      </div>

      {stats.awaitingResponse > 0 ? (
        <Link href={"/orders" as Route}>
          <Card className="border-accent bg-accent/5 hover:border-accent transition-colors">
            <CardContent className="p-4">
              <p className="text-sm font-medium">
                {stats.awaitingResponse} booking{stats.awaitingResponse === 1 ? "" : "s"} awaiting your response
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">Already paid and held. Accept or decline.</p>
            </CardContent>
          </Card>
        </Link>
      ) : null}

      <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Action Required</CardTitle>
            <Activity className="w-4 h-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-accent">{stats.awaitingResponse}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today</CardTitle>
            <Calendar className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.todayCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Upcoming</CardTitle>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.upcomingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Available to Withdraw</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatKobo(stats.wallet.available_kobo)}</div>
            <p className="text-xs text-muted-foreground mt-1">{formatKobo(stats.wallet.pending_kobo)} pending</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Rating</p>
            <p className="mt-1 text-2xl font-bold flex items-center gap-1">
              <Star className="w-5 h-5 text-accent fill-accent" />
              {stats.rating?.review_count ? stats.rating.avg_rating : "—"}
            </p>
          </div>
          <Link href={"/reviews" as Route}>
            <Button variant="outline" size="sm">
              {stats.rating?.review_count ?? 0} reviews
            </Button>
          </Link>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-serif font-semibold">Recent Booking Activity</h2>
          <Link href={"/orders" as Route}>
            <Button variant="outline" size="sm">View All</Button>
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <Card className="bg-muted/50 border-dashed">
            <CardContent className="flex flex-col items-center justify-center h-48 text-center">
              <p className="text-muted-foreground mb-4">No recent bookings</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {recentOrders.map((order) => (
              <Card key={order.id} className="overflow-hidden border-l-4 border-l-primary">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-lg truncate">{order.listings?.title}</h3>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">{order.reference}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-medium">{formatKobo(order.agreed_price_kobo)}</div>
                      <div className="mt-1">
                        <StatusPill status={order.status} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-4 pt-4 border-t border-border">
                    <Calendar className="w-4 h-4" />
                    {new Date(order.scheduled_start).toLocaleString("en-NG")}
                  </div>
                  <div className="mt-4">
                    <Link href={"/orders" as Route}>
                      <Button variant="secondary" className="w-full">
                        {order.status === "paid_held" ? "Review Request" : "Manage"}
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {stats.pendingListings > 0 ? (
        <Card className="bg-muted/50">
          <CardContent className="p-4 text-sm text-muted-foreground">
            {stats.pendingListings} listing{stats.pendingListings === 1 ? "" : "s"} awaiting Admin approval.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

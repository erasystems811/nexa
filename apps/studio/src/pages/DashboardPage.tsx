import { Link } from "react-router-dom";
import { Activity, Calendar, Clock, DollarSign, Star } from "lucide-react";
import { formatKobo } from "@nexa/money";
import { Card, CardContent, CardHeader, CardTitle } from "@nexa/design-system/src/components/ui/card";
import { Button } from "@nexa/design-system/src/components/ui/button";
import { StatusPill } from "../components/status-pill";
import { useAuth } from "../auth/AuthContext";
import { useApiQuery } from "../lib/query";

interface DashboardStats {
  awaitingResponse: number;
  todayCount: number;
  upcomingCount: number;
  wallet: { available_kobo: number; pending_kobo: number };
  rating: { avg_rating: number; review_count: number } | null;
  pendingListings: number;
}

interface Order {
  id: string;
  reference: string;
  status: string;
  scheduled_start: string;
  agreed_price_kobo: number;
  listings: { title: string } | null;
}

export function DashboardPage() {
  const { provider } = useAuth();
  const { data: stats } = useApiQuery<DashboardStats>(["dashboard-stats"], "/provider/dashboard");
  const { data: orders } = useApiQuery<Order[]>(["dashboard-orders"], "/provider/orders");

  if (!provider || !stats) return <div className="text-muted-foreground">Loading…</div>;

  const recentOrders = (orders ?? []).slice(0, 4);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-2 text-3xl font-serif font-bold text-primary">{provider.business_name}</h1>
        <p className="text-muted-foreground">
          {provider.is_on_probation
            ? "New provider — your first bookings get closer attention."
            : "Overview of your performance and pending actions."}
        </p>
      </div>

      {stats.awaitingResponse > 0 ? (
        <Link to="/orders">
          <Card className="border-accent bg-accent/5 transition-colors hover:border-accent">
            <CardContent className="p-4">
              <p className="text-sm font-medium">
                {stats.awaitingResponse} booking{stats.awaitingResponse === 1 ? "" : "s"} awaiting your response
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">Already paid and held. Accept or decline.</p>
            </CardContent>
          </Card>
        </Link>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Action Required</CardTitle>
            <Activity className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-accent">{stats.awaitingResponse}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.todayCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Upcoming</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.upcomingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Available to Withdraw</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatKobo(stats.wallet.available_kobo)}</div>
            <p className="mt-1 text-xs text-muted-foreground">{formatKobo(stats.wallet.pending_kobo)} pending</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex items-center justify-between p-6">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Rating</p>
            <p className="mt-1 flex items-center gap-1 text-2xl font-bold">
              <Star className="h-5 w-5 fill-accent text-accent" />
              {stats.rating?.review_count ? stats.rating.avg_rating : "—"}
            </p>
          </div>
          <Link to="/reviews">
            <Button variant="outline" size="sm">
              {stats.rating?.review_count ?? 0} reviews
            </Button>
          </Link>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-serif font-semibold">Recent Booking Activity</h2>
          <Link to="/orders">
            <Button variant="outline" size="sm">View All</Button>
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <Card className="border-dashed bg-muted/50">
            <CardContent className="flex h-48 flex-col items-center justify-center text-center">
              <p className="mb-4 text-muted-foreground">No recent bookings</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {recentOrders.map((order) => (
              <Card key={order.id} className="overflow-hidden border-l-4 border-l-primary">
                <CardContent className="p-6">
                  <div className="mb-4 flex items-start justify-between">
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-semibold">{order.listings?.title}</h3>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">{order.reference}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-medium">{formatKobo(order.agreed_price_kobo)}</div>
                      <div className="mt-1">
                        <StatusPill status={order.status as never} />
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {new Date(order.scheduled_start).toLocaleString("en-NG")}
                  </div>
                  <div className="mt-4">
                    <Link to="/orders">
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

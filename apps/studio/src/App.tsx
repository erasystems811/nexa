import { Routes, Route } from "react-router-dom";
import { StudioLayout } from "./components/StudioLayout";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { OrdersPage } from "./pages/OrdersPage";
import { ListingsPage } from "./pages/ListingsPage";
import { NewListingPage } from "./pages/NewListingPage";
import { ListingDetailPage } from "./pages/ListingDetailPage";
import { AvailabilityPage } from "./pages/AvailabilityPage";
import { WalletPage } from "./pages/WalletPage";
import { ReviewsPage } from "./pages/ReviewsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { VerificationPage } from "./pages/VerificationPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<StudioLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/listings" element={<ListingsPage />} />
        <Route path="/listings/new" element={<NewListingPage />} />
        <Route path="/listings/:id" element={<ListingDetailPage />} />
        <Route path="/listings/:id/availability" element={<AvailabilityPage />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/reviews" element={<ReviewsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/verification" element={<VerificationPage />} />
      </Route>
    </Routes>
  );
}

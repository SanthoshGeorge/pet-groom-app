// Chrome shared by every "marketing" public page (home, services, gallery, about,
// manage-booking) — the full SiteHeader + SiteFooter from Main.dc.html. The booking
// wizard (`/book`) deliberately lives OUTSIDE this group: Public-Booking.dc.html /
// Public-Details.dc.html use a different, slimmer top bar (`BookingTopBar`) and no footer,
// and Public-Confirmation.dc.html uses no header at all.
import { SiteHeader } from "../_components/SiteHeader";
import { SiteFooter } from "../_components/SiteFooter";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}

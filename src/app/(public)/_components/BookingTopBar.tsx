// Slim top bar used by the booking flow — Public-Booking.dc.html / Public-Details.dc.html
// share this exact bar (back-chevron + shop name on the left, "Booking as a guest · Log in
// instead" on the right); Public-Confirmation.dc.html shows no top bar at all, so
// `BookingWizard` simply doesn't render this component once it reaches that step.
//
// "Log in instead" links to `/login`, which doesn't exist yet — that's Step 21's page, a
// separate agent's work per the plan. The link itself is part of this mockup screen's
// copy/layout and is included faithfully; it will 404 until Step 21 lands.
import Link from "next/link";
import { ChevronLeftIcon } from "./icons";
import styles from "./BookingTopBar.module.css";

export function BookingTopBar() {
  return (
    <div className={styles.bar}>
      <Link href="/" className={styles.homeLink} data-testid="booking-top-bar-home-link">
        <ChevronLeftIcon />
        Happy Tails Grooming
      </Link>
      <div className={styles.guestNote}>
        Booking as a guest ·{" "}
        <Link href="/login" className={styles.loginLink} data-testid="booking-top-bar-login-link">
          Log in instead
        </Link>
      </div>
    </div>
  );
}

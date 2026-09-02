// About & contact page (FR-12: "an about/contact page (shop hours, address, phone)"). No
// mockup screen exists for this page — only the footer's placeholder hours/address/phone
// blurb on Main.dc.html. This page is built from FR-12's requirement text plus general
// judgment for a small local-business "about" page, reusing the same placeholder
// convention the mockup itself established (NFR-2: real shop branding/hours/address/phone
// swapped in once provided — there is no API this page could read real hours from; the
// only working-hours data in this codebase is admin-only, `POST /api/admin/hours`, with no
// public GET counterpart).
import Link from "next/link";
import styles from "./About.module.css";

export const metadata = {
  title: "About & Hours — Happy Tails Grooming",
};

const HOURS = [
  { day: "Monday – Friday", value: "[HOURS]" },
  { day: "Saturday", value: "[HOURS]" },
  { day: "Sunday", value: "[CLOSED]" },
];

export default function AboutPage() {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>About &amp; Hours</h1>
      <p className={styles.subtitle}>Get to know Happy Tails Grooming, and find everything you need to reach us.</p>

      <div className={styles.grid}>
        <div className={styles.about}>
          <p>
            Happy Tails Grooming is a neighborhood dog-grooming shop focused on making grooming day as calm and
            comfortable as possible for every dog that comes through the door — from a quick nail trim to a full
            bath-and-haircut visit.
          </p>
          <p>
            Booking online takes just a couple of minutes: pick a service, pick an open time, and you&apos;re set —
            no account and no phone call required. Already have a booking? Head to{" "}
            <Link href="/manage-booking" data-testid="about-page-manage-booking-link">
              Manage a Booking
            </Link>{" "}
            to view, reschedule, or cancel it using your
            confirmation number.
          </p>
          <p>Payment is handled in person at the shop after your appointment — no online payment is collected.</p>
        </div>

        <div className={styles.card}>
          <div className={styles.infoBlock}>
            <span className={styles.infoLabel}>HOURS</span>
            {HOURS.map((row) => (
              <div className={styles.hoursRow} key={row.day}>
                <span className={styles.hoursDay}>{row.day}</span>
                <span className={styles.hoursValue}>{row.value}</span>
              </div>
            ))}
          </div>
          <div className={styles.infoBlock}>
            <span className={styles.infoLabel}>ADDRESS</span>
            <span className={styles.infoValue}>[ADDRESS]</span>
          </div>
          <div className={styles.infoBlock}>
            <span className={styles.infoLabel}>PHONE</span>
            <span className={styles.infoValue}>[PHONE NUMBER]</span>
          </div>
          <Link href="/book" className={styles.bookButton} data-testid="about-page-book-button">
            Book an Appointment
          </Link>
          <p className={styles.placeholderNote}>
            Placeholder hours/address/phone — swapped for the real shop&apos;s details once provided (NFR-2).
          </p>
        </div>
      </div>
    </div>
  );
}

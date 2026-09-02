import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pet Grooming Booking",
  description: "Book grooming appointments online.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

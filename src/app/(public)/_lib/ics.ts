// Minimal .ics (iCalendar) generation for the confirmation screen's "Add to Calendar"
// button — not covered by any earlier-stage artifact (no story requires it), added as a
// small, self-contained real-interactivity nicety rather than a decorative no-op button.
function escapeICSText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

function toICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function downloadAppointmentICS(params: {
  title: string;
  description: string;
  start: Date;
  end: Date;
  uid: string;
}): void {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Happy Tails Grooming//Booking//EN",
    "BEGIN:VEVENT",
    `UID:${params.uid}@happytailsgrooming`,
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${toICSDate(params.start)}`,
    `DTEND:${toICSDate(params.end)}`,
    `SUMMARY:${escapeICSText(params.title)}`,
    `DESCRIPTION:${escapeICSText(params.description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "appointment.ics";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

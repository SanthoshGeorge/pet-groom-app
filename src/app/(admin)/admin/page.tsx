// `/admin` has no screen of its own in either mockup — both artboards' sidebars start on
// Calendar, so this is where an owner landing on the bare admin root ends up.
//
// URL PREFIX NOTE: every admin page lives under `/admin/...` (this `admin/` folder inside
// the `(admin)` route group), not bare at the site root — `(public)`'s marketing site
// already owns `/` (home) and `/services` (its catalog page); Next.js rejects two route
// groups resolving the same path (`next build`'s "parallel pages" error), so the admin site
// needed its own path segment. Nothing in any earlier-stage artifact pins down the admin
// site's URL scheme, so this is a Step 22 judgment call, documented here rather than made
// silently — see the Step 22 report.
import { redirect } from "next/navigation";

export default function AdminRootPage() {
  redirect("/admin/calendar");
}

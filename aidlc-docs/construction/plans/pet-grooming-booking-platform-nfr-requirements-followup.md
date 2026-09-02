# NFR Requirements — Follow-up Question

Questions 1-9 are answered. Question 10 (photo gallery storage) wasn't included in your last reply — repeating it here on its own so it doesn't get lost.

### Question 10 — Photo gallery storage (FR-12)

A) **Static images committed to the app repo, served directly** — simplest possible option, zero extra service or cost, entirely adequate for a small shop's gallery (a few dozen photos at most); re-deploy needed to add/change photos (acceptable given NFR-1's "hand off cleanly" framing — the groomer would ask you, or eventually learn to commit a file, rather than needing a self-service upload UI)

B) **A managed object storage service** (e.g. Supabase Storage, Cloudflare R2 free tier) with a simple admin upload UI — lets the groomer manage gallery photos himself without needing a code change, more setup and one more service to maintain

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A

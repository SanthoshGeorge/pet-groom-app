# Requirements Clarification Questions

Please answer each question by filling in the letter choice after the `\[Answer\]:` tag. If none of the options match, choose the last option ("Other") and describe your answer. Some of these you may need to check with the groomer on — guesses are fine for now, we can revise later.

## Question 1 — Species and services
What does the shop groom, and what services should the booking system offer?

A) Dogs only — baths, full grooms, nail trims, etc.

B) Dogs and cats

C) Dogs, cats, and other small pets (rabbits, etc.)

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A
## Question 2 — Staff / groomers
How many groomers work at the shop, and do customers need to be able to pick a specific groomer?

A) One groomer (the owner) — no groomer selection needed

B) Multiple groomers — customer picks a specific groomer

C) Multiple groomers — system assigns automatically, customer doesn't choose

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A
## Question 3 — Customer accounts
Should customers create an account (email/password) to book, or book as a guest with just contact info each time?

A) Guest booking only — name, phone, email collected at booking time, no password

B) Guest booking, with an optional account for returning customers to save their pets' info

C) Account required to book

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: B
## Question 4 — Multiple pets per appointment
Should a customer be able to book grooming for more than one pet in a single appointment/visit?

A) Yes — one visit can cover multiple pets

B) No — one pet per appointment, book separately for each pet

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A
## Question 5 — Cancellations and no-shows
How should cancellations/rescheduling be handled?

A) Customers can cancel/reschedule themselves online up to a cutoff (e.g., 24 hours before)

B) Customers must call/text the shop to cancel or reschedule — system doesn't handle it

C) Customers can cancel/reschedule themselves with no cutoff restriction

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: C
## Question 6 — Payments
Should the system collect payment or a deposit online at booking time, or is all payment handled in person at the shop?

A) No online payment — pay in person after service

B) Optional deposit collected online to hold the slot, balance paid in person

C) Full payment collected online at booking

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A
## Question 7 — Reminders and notifications
Should the system send appointment confirmations/reminders, and how?

A) Email only

B) Text/SMS only

C) Both email and SMS

D) No automated reminders needed for the first version

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: C
## Question 8 — Hosting and long-term ownership
Who will own/maintain this site and pay for hosting going forward?

A) You (Santhosh) will maintain it and hand the groomer a finished product

B) The groomer will take over hosting/maintenance once built

C) Shared — you set it up, groomer just uses it day-to-day, you maintain it as needed

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: B
## Question 9 — Branding and domain
Does the groomer already have a business name, logo, colors, or a domain name you should design around?

A) Yes, I have these details (please list what you have after \[Answer\]: tag below)

B) No branding yet — use a placeholder name/simple styling for now, groomer will provide real branding later

C) Not sure yet — need to check with the groomer

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: B
## Question 10 — Expected scale
Roughly how many appointments per week is the shop currently doing (or expecting)?

A) Small — under 20/week (single-location, low traffic is fine)

B) Medium — 20-75/week

C) Large — 75+/week or planning multiple locations eventually

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: C
## Question 11 — Public site scope beyond booking
Besides seeing available times and booking, what else should the public website include?

A) Just booking, hours, and contact info — keep it minimal

B) Booking plus a service menu with prices

C) Booking plus service menu, photo gallery, and about/contact page

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: C
## Question 12 — Admin/owner view
Beyond booking on behalf of customers, what should the shop owner be able to do in their admin view?

A) Just book/view/cancel appointments on the calendar

B) That, plus manage services/prices and their own working hours

C) That, plus see basic reports (appointments per week, no-shows, etc.)

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: C
---

## Extension Opt-Ins

These come from the AI-DLC toolkit itself and apply to how rigorously we build this (security/resiliency/testing rules). For a small business site, lighter-weight is usually the right call, but your choice.

## Question: Security Extensions
Should security extension rules be enforced for this project?

A) Yes — enforce all SECURITY rules as blocking constraints (recommended for production-grade applications)

B) No — skip all SECURITY rules (suitable for PoCs, prototypes, and experimental projects)

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: B
## Question: Resiliency Extensions
Should the resiliency baseline (fault tolerance, availability, observability best practices) be applied to this project?

A) Yes — apply the resiliency baseline as directional best practices (recommended for business-critical workloads)

B) No — skip the resiliency baseline (suitable for a small shop's PoC/first version, where rapid iteration matters more)

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: B
## Question: Property-Based Testing Extension
Should property-based testing (PBT) rules be enforced for this project?

A) Yes — enforce all PBT rules (recommended for complex business logic, data transformations, stateful components)

B) Partial — only for pure functions and serialization round-trips

C) No — skip all PBT rules (suitable for a CRUD-style booking app like this one)

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: C (user said "not sure" — C recommended by AI as default since this is a simple CRUD-style booking app with no complex algorithms; flagged for user confirmation in Requirements Analysis completion message)
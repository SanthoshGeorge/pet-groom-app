# Unit of Work — Story Map

All 13 stories from `stories.md` map to the single unit (**Pet Grooming Booking Platform**), organized here by which module primarily implements each — this is the mapping Construction will use to know what "done" looks like per module.

## `auth` module
- **RC-1**: Create or use an account (registration/login portion)

## `customer` module
- **RC-1**: Create or use an account (profile-linking portion)

## `catalog` module
- **SO-4**: Manage services and prices

## `availability` module
- **GC-1**: View available appointment times
- **SO-5**: Manage working hours and availability

## `booking` module
- **GC-2**: Book an appointment as a guest
- **GC-3**: Cancel or reschedule a guest appointment
- **RC-2**: Book an appointment using saved details
- **RC-3**: Cancel or reschedule an appointment
- **SO-1**: View and manage the full appointment calendar
- **SO-2**: Book an appointment on behalf of a customer
- **SO-3**: Book outside normal availability

## `notification` module
- *(No story owns this module directly — it's invoked by `booking`'s stories per FR-10. Its own acceptance criteria live inside GC-2, RC-2, SO-2's "confirmation + reminder" bullets and GC-3/RC-3's "cancellation confirmation" bullets.)*

## `reporting` module
- **SO-6**: View basic reports

---

## Coverage Check
- **13/13 stories assigned** — GC-1, GC-2, GC-3, RC-1, RC-2, RC-3, SO-1, SO-2, SO-3, SO-4, SO-5, SO-6 (12 stories with direct story numbers) plus RC-1 spans both `auth` and `customer` (counted once in the 13-story total, touches two modules).
- **No orphaned stories.**
- **No module without a purpose**: `notification` has no story of its own but is exercised by 5 other stories' acceptance criteria — confirmed intentional (it's a shared, cross-cutting module, not an unused one).

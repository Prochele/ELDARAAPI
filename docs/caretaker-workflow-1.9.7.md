# Caretaker workflow — 1.9.7

Last updated: 17-11-2026

## Scope

Caretaker registration remains the existing verified registration. New work adds My Availability, caretaker search, private contact requests/inbox, dated confirmed assignments, optional reviews for each assignment period and caretaker replies. Existing medicine, doctor appointment and daily activity reminder jobs retain their schedules, preferences and recipients.

## Caretaker

- Set accepting-new-work and full-time/part-time/either preferences.
- Enter weekly day/time ranges, including separate morning/evening ranges, and full-day leave date ranges. All care hours use IST. Overnight/live-in shifts are not supported in this release.
- Review introductions and accept/decline requests. Accepted conversations support text messages.
- Confirm/decline dated assignment proposals. Confirmation rechecks availability, leave and overlapping commitments atomically.
- Read public reviews and add/edit one reply per new dated review.

## Patron Admin

- All active caretakers appear by default, with pagination and city, gender, age, name/code filters.
- Profiles show city, gender, age, work preferences, weekly hours, leave, ratings and feedback/replies. Phone/email are excluded from both current and legacy public API responses; phone numbers are not searchable through the legacy endpoint.
- Send a private introduction; up to five new caretaker requests per IST day and one conversation per PTA/caretaker pair. Declined requests cannot be repeatedly resent.
- Discuss work after acceptance, then select an owned patron (including self), work type, one-day/weekly arrangement, dates, days and hours. Backend checks ownership and conflicts.
- Unassign/cancel without deleting health records. Reviews are optional and available only for confirmed ended/completed periods. Each assignment period has a separate review which the original PTA may edit later.

## Privacy and access

- Inbox/conversation/assignment endpoints check participants on the backend. Patron IDs, care notes and other employers are not published in caretaker search/reviews.
- Messages are stored in MySQL and fetched over authenticated HTTPS. They are not end-to-end encrypted. Authorised administrators can inspect reported conversations; such inspections and review actions are audited.
- Either participant can block/unblock the other or report a conversation. Blocking stops messages/new proposals; active care must be ended separately. A report does not automatically ban an account.
- Caretakers can access health records only during confirmed active assignment dates. Unassignment revokes subsequent medicine, appointment, activity, vital and file API access. Previously downloaded files cannot be recalled.
- Existing assignments migrate as active legacy periods with unspecified hours. No hours are invented. Their PTA must end/repropose agreed hours before the caretaker accepts conflicting/new scheduled work. Legacy reviews remain visible as historical reviews with unavailable assignment dates; their historical data is preserved.

## Database and stored programs

Source migration: `ELDARAAPI/migrations/20261117_caretaker_workflow.sql`.

Adds ten InnoDB tables: CareWorkPreferences, CareAvailability, CareLeave, CareContact, CareMessage, CareBlock, CareReport, CareAssignment, CareReview and CareNotice. Foreign keys/checks protect new records. Existing tables, procedures, triggers/events are not replaced. Backfill preserves existing active caretaker mappings.

Before live changes, a private full export (data, schema, procedures, triggers and events) is saved under `private-backups/2026-11-17-caretaker/`, with a SHA-256 manifest. This private export must never be committed to GitHub. A full restore and repeated migration were tested with MySQL networking and event scheduler disabled, then the temporary restored records were removed.

The reviewed existing assignment/rating SPs do not implement confirmation or period-based reviews. The API now implements these operations transactionally in the new tables; legacy write endpoints return an update-required response. Existing health-related SPs remain unchanged. New period data must not be managed by manually calling the legacy assignment SP.

## Notifications and administration

Existing Firebase Cloud Messaging carries generic care updates; message text/patron details are not in the notification preview. Care pushes use a separate notification type/channel and are sent only to supported app versions (1.9.7+) bound to the active registering session. Inbox data remains available if push is denied or delivery fails. The outbox retries with a bounded attempt count independently of reminder schedulers.

ELDARAADMIN → Caretaker Reports lists reports, opens the reported conversation with paginated history, and records the review action. Existing administrator user-block controls remain available. No new Firebase subscription/chat database is required.

## Release and validation

Android: versionName 1.9.7, base versionCode 17; upload AAB code 17001 (ABI APK codes differ). iPhone: marketing version 1.9.7, build 17001.

Release evidence and final readiness status: `output/caretaker-2026-11-17/READINESS.md`. Do not interpret passing local tests as proof of real-device push delivery or store approval.

The Android simulator harness `qa/caretaker.entry.js` uses offline demo data and is never imported into production. The standard entry is used for release APK/AAB builds.

The installed Xcode 16/iOS 18.5 SDK cannot compile multiple iOS 26 API references in the existing VisionCamera dependency. A newer Xcode with iOS 26 SDK is required; the dependency was not downgraded or stripped. A signed iPhone distribution archive additionally requires a valid Apple account and an App Store provisioning profile containing Push Notifications/aps-environment. After correcting those prerequisites, use `ELDARA/scripts/build-ios-release.sh`. Until then, no signed IPA is ready.

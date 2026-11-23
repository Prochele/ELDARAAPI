# Wellness monitoring

Status: release 1.9.8 source. The additive production database migration was applied and verified on 23 November 2026 after a private backup and restore rehearsal. Railway deployment verification is recorded in ELDARADOCS document 20.

## Access

- Patron Admin: Self and active PT-role patrons in the same member group. BASIC and PTASelf accounts are Self only, matching the existing plan scope.
- Patron: own records only.
- Caretaker: read-only access to active PT-role patrons with a current, confirmed active CareAssignment. No caretaker Self profile, admin personal records, pending/future/ended assignments, or unrelated patrons.
- The server derives the caller from the existing session middleware and checks account/subject access on every endpoint. Subject, role and actor fields supplied in payloads are rejected.

Daily check-ins record overall wellbeing, sleep duration/quality, mood, discomfort level/location, and optional notes. There is one entry per person per Indian calendar day. Admins/patrons can add, edit and delete within their authorised scope; deletions require a UI confirmation. Edits retain the original author, record the editor, save a previous-version snapshot, and reject stale versions with HTTP 409.

## Retention

The visible and editable window is today plus the previous six days in Asia/Kolkata. The API filters older records immediately. Cleanup runs at server startup and Indian midnight, deleting expired check-ins and their cascading edit snapshots. Editing does not reset the original check-in date or retention period.

Assistance requests are manual in-app records: open, acknowledged, resolved. Open/acknowledged records remain until resolution; resolved records expire seven full days after resolution. Resolution cannot be repeated to extend retention. Cleanup also removes records for deactivated/deleted subjects.

Wellness sends no push notifications, SMS, or email. It does not call the existing medicine, daily-activity, doctor-appointment, care-notice or notification schedulers.

## Database and API

The additive migration is `migrations/20261123_wellness.sql`, mirrored in the ELDARADB repository. Apply it to the intended database before a future backend deployment. It creates WellnessCheckIn, WellnessCheckInEdit, and WellnessAssistance; it does not alter existing tables.

Authenticated endpoints under `/api/wellness`:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /patrons | Authorised people and current retention dates |
| GET | /patrons/:patronId | Seven-day check-ins and assistance overview |
| POST | /patrons/:patronId/check-ins | Create a daily entry |
| PATCH | /patrons/:patronId/check-ins/:id | Edit with current version |
| DELETE | /patrons/:patronId/check-ins/:id | Delete with current version |
| GET | /patrons/:patronId/requests?before=:id | Paginated assistance history |
| POST | /patrons/:patronId/requests | Save manual assistance request |
| PATCH | /patrons/:patronId/requests/:id | Acknowledge/resolve with current version |

Check-in timestamps and request timestamps are stored as UTC and returned as ISO timestamps. CheckInDate is an IST calendar date. Responses use Cache-Control: no-store. The mobile UI clears loaded details on backgrounding and rechecks access on focus/resume; caretaker views also refresh every 30 seconds.

## Simulator testing on this Mac

`node scripts/wellness-simulator.cjs` starts a loopback-only API on port 3001. It uses the private network-disabled MySQL socket `/private/tmp/eldara-wellness.sock`, restricts the socket to the current user, and creates/runs the migration in the separate `eldara_wellness_local` database. Existing account/session/assignment checks use the existing identity pool in transaction-read-only mode. Wellness writes and cleanup affect only the local database. This runner starts no existing notification workers.

The private MySQL data directory is `/Users/Applw/Desktop/ELDARA/private-backups/wellness-simulator/mysql`. Keep it outside Git. Start that existing instance with `--no-defaults`, the data directory above, `--socket=/private/tmp/eldara-wellness.sock`, `--skip-networking`, `--mysqlx=0`, and `--event-scheduler=OFF` before starting the API.

The normal mobile entry is used with the external Metro config `/Users/Applw/Desktop/ELDARA/output/caretaker-style-2026-11-23/metro.simulator-login.config.cjs`; only the Wellness endpoint is redirected to port 3001. All normal sign-in flows remain unchanged. Android needs adb reverse for ports 8081 and 3001. The production mobile endpoint continues to use the configured API base URL and has no localhost override.

Internal layout-only sample data lives behind `qa/metro.wellness.config.js` and `qa/wellness.entry.js`; these are debug-only and are never imported by the production entry. Finish layout verification by stopping that Metro instance and restarting the normal simulator config. Do not leave the sample-data entry active for user review.

## Verification

`node --test test/wellness.test.js` checks payload/retention boundaries. With the isolated database running, `WELLNESS_TEST_SOCKET=/private/tmp/eldara-wellness.sock node --test test/wellness*.test.js` also exercises real SQL, roles, concurrent duplicate saves, stale edits, cascade deletion, assistance retention, and immediate loss of access after an assignment ends. It creates and drops a separate temporary test database. No production records are used for these tests.

The mobile Wellness tests cover navigation, caretaker read-only/deep-link handling, validation, stale-edit draft preservation, and delete confirmation. No native dependency was added, and no APK/AAB or distribution archive is needed to test these JavaScript changes using the installed development apps.

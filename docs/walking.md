# Personal walking and activity tracking

Status: release 1.9.8 source. The additive production database migration was applied and verified on 23 November 2026. Deployment and Android artifact evidence are recorded in ELDARADOCS document 20. Physical-phone sensor, permission and accuracy acceptance still require a device test.

## Account boundary

Walking is independent of the family/patron management system. PT, PTA, PTASelf and PTAFamily may read and write only their own activity and goals. CT is denied on all routes and has no dashboard entry. A Patron Admin cannot select, view or manage any patron's walking records, including patrons in the same member group. Every endpoint derives UserID from the existing authenticated session, verifies an active account, and uses that ID in every query. There is no endpoint accepting a patron or owner ID. POST/PUT reject additional identity or notification fields.

The dashboard entry is Health Insights → My Walking. The page contains Today, My goals and 7-day history. Daily and weekly step goals are independently optional; a week is Monday through today in Indian Standard Time. Step length is configurable (starting value 65 cm) for estimated distance where the sensor supplies only steps. Goals are personal settings, not clinical recommendations.

## Motion implementation

There is no new library subscription, Firebase data connection, HealthKit/Health Connect integration, GPS tracking or notification worker. Small native bridges use Apple's CMPedometer/Core Motion and Android SensorManager's step detector, falling back to its step counter. Motion permission is requested only after Start walk. The Android sensor can be absent, and both OS/device errors and denied permission have an explicit fallback to manual entry.

This version tracks explicit foreground walking sessions, not an automatic all-day total. Active time is the walk timer excluding pauses, not a measurement of metabolic activity. Leaving the page, backgrounding or locking the phone pauses the session; the user resumes manually. Each new sensor segment starts with a new counter baseline and never imports earlier device history or another login's steps. The bridge cleans up listeners on lifecycle pause, React teardown and reload.

Distance is clearly an estimate for sensor walks: Core Motion's distance estimate where available, otherwise steps × configured step length. Manual distance is labelled manual; a missing distance remains null, and daily totals indicate incomplete distances. There is no invented sensor data in the simulator. The already-installed simulator apps do not contain the newly added native bridge; the screen detects that safely. An updated phone build is required later for physical sensor testing, after UI approval.

Session operations are serialized to avoid permission/read/pause races. A paused per-account draft is saved locally; reload does not count time spent outside the app. Unsaved activity is labelled in the Today totals and is added to history only by Finish & save. An Indian-midnight boundary pauses the draft and does not assign new-day readings to the prior day. Failed saves preserve the draft and retry identifier.

## Persistence and retention

Apply `migrations/20261123_walking.sql` before a future production API deployment. The migration is mirrored in ELDARADB/MIGRATIONS and creates only WalkingGoal and WalkingLog. It does not change the existing Wellness or reminder tables.

WalkingLog stores one row per saved walk, with manual/sensor provenance, UTC creation time and an IST WalkDate. Unique (UserID, ClientID) makes retries idempotent; reusing the identifier with changed details is rejected. Goal versions reject stale overwrites. History is paginated, and deleting a walk removes it from personal totals after a UI confirmation.

The visible window is today plus the previous six IST dates. Startup and Indian-midnight cleanup purge earlier walks and remove records/settings for inactive or deleted accounts. Goal settings remain while the account is active. No activity is sent to family, caretakers, Firebase, SMS or email. Existing medicine, appointment and daily-activity notifications are unchanged.

## API

All routes are authenticated under `/api/walking`, with Cache-Control: no-store:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /me | Own profile, seven-day aggregates and goals |
| PUT | /me/goals | Save own versioned goals and step length |
| POST | /me/walks | Save own manual/sensor walk, retry-safe |
| GET | /me/days/:date?before=:id | Own paginated walks for a retained day |
| DELETE | /me/walks/:id | Delete own retained walk |

The mobile request helper binds requests to the session that opened the screen and rejects a changed login. Draft keys are scoped to the server-authorised owner ID. No record selector is exposed.

## Local simulator review

The existing `scripts/wellness-simulator.cjs` also mounts Walking at `127.0.0.1:3001/api/walking` and applies the migration to `eldara_wellness_local`, the private network-disabled MySQL database on this Mac. Existing accounts, assignments and sessions are read through the existing identity pool in transaction-read-only mode; all new-feature writes and cleanup stay local. The local runner remains available for isolated review. Production migration evidence is recorded separately in document 20.

The external normal-app Metro config in `output/caretaker-style-2026-11-23/metro.simulator-login.config.cjs` redirects only the Wellness/Walking endpoint modules to the local API. All normal sign-in flows are unchanged. Android needs adb reverse for ports 8081 and 3001. The checked-in Walking endpoint uses the configured production API base URL; it contains no localhost or demo overrides.

## Verification

Backend tests: `WELLNESS_TEST_SOCKET=/private/tmp/eldara-wellness.sock node --test test/walking*.test.js`. These create/drop their own temporary database with synthetic identities, checking same-family isolation, CT denial, inactive accounts, no managed-patron routes, validation, concurrent retry behaviour, goal conflicts, pagination, null-distance aggregates and retention.

Mobile tests cover session pause/resume accounting, stop latency, Indian midnight, permission denial, sensor reset, paused draft restoration, manual validation, caretaker UI denial, personal-only navigation, retry identity and versioned goal saving. Kotlin is checked with `:app:compileDebugKotlin` only, without assemble/bundle tasks; the Objective-C bridge is syntax-checked against the installed simulator SDK. These checks do not establish physical-phone sensor accuracy or background delivery.

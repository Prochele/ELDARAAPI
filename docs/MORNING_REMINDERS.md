# Morning Schedule Reminders

Implementation date: 2026-10-26. Release candidate: Android/iOS 1.9.6.

## Deployment State

This source change includes the migration, but does not execute it on Railway.
No production SQL migration, Railway variable change, Firebase credential change or
store upload was performed for this update. Pushing this repository's connected `main`
branch may trigger Railway's existing automatic API deployment; that is not a DB migration.
The new job is disabled unless `ENABLE_MORNING_REMINDERS=true`.

## Behaviour

- Keep the existing medicine cron job, procedure, recipients, preference and FCM sender.
- A separate minute job starts checking at 08:00 in `Asia/Kolkata`, independent of the
  server timezone. It also checks on process startup to recover after a restart.
- Query today's scheduled/rescheduled doctor appointments and daily activities.
- Notify only the assigned user: `DoctorAppointment.PatronId` or `DailyActivity.UserId`.
  Do not automatically copy the creator, linked Patron Admins or other group members.
- Include doctor name or activity description and 12-hour AM/PM time.
- Items added after 08:00 are picked up by the next minute tick if still upcoming.
- No items means no morning message. A daily activity is for its stored date, not an
  automatically recurring activity on every future day.
- Completed, cancelled, deleted, previous-day and future-day appointments are excluded.
  Events earlier than the current scheduled minute are not sent late. Consequently,
  an appointment before 08:00 is not covered by this morning-only reminder job.
- The event's scheduled minute is allowed to finish before the alert expires, avoiding
  losing an 08:00 appointment when the cron callback starts a few seconds late.

## Additive Database Migration

Run `migrations/20261026_morning_reminders.sql` using the existing database's secure
SQL connection, after the normal backup/checkpoint. It creates three tables only:

1. `ScheduleNotificationPreferences`: independent appointment and activity switches.
2. `ScheduleReminderDevices`: explicit client capability registration, current device
   owner, hashed FCM token and hashed registering session token. No raw tokens here.
3. `MorningReminderDeliveries`: per-event, date, assignee and device claim/send history.

The migration is repeatable. It does not alter medicine, appointment, activity or user
records, and does not change any stored procedure. The existing DB repository's unrelated
uncommitted SQL/data files were not modified.

The device query requires an active user, an active registering session, a matching token
hash and explicit new-client support. Existing users are registered when the updated app
opens; they do not need to sign out and sign in again. Client capability prevents an old
app from receiving the new payload and incorrectly routing it to the medicine screen.
Device registration records one current owner for a physical device. Online logout
removes schedule registration without removing the existing medicine token.

## API

- Existing authenticated `POST /api/device/token` accepts `supportsScheduleReminders: true`.
  The response includes the authenticated `userId` and `scheduleRemindersRegistered`.
  The backend obtains user/session identity from authentication, not client-supplied IDs.
- `GET /api/device/schedule-reminder-notifications` returns
  `{ appointmentRemindersEnabled: boolean, activityRemindersEnabled: boolean }`.
- `PUT` to that path requires both boolean fields and updates only the caller's settings.
- `DELETE /api/device/schedule-reminder-devices/:deviceUUID` removes only the caller's
  schedule registration for that device.

If the migration is not installed, medicine token registration still succeeds. Schedule
settings show an unavailable/retry state rather than pretending a change was saved.

## Delivery and Retries

Claims use a unique event/date/user/device key and an atomic conditional update, with a
five-minute lease. Concurrent API replicas cannot normally own the same delivery.
Successful FCM acceptance marks it sent. Transient failures retry after two minutes,
with at most five claims. Invalid/unregistered FCM tokens are permanent failures.
Expired leases can recover after a process crash. Source events and preferences are
queried again on each tick, so deleted/cancelled/disabled items leave the candidate set.

There is no atomic transaction spanning MySQL and Firebase. If FCM accepts a message but
the process dies before recording success, a retry is possible. Stable Android notification
IDs avoid duplicate visible entries while an entry remains displayed. APNs uses a stable
collapse ID for queued retries. These are safeguards, not an exactly-once delivery guarantee.
`sent` means FCM accepted the message, not proof the phone displayed it.

Android receives high-priority data-only messages; Notifee owns display and grouped inbox
construction. The new channel is `daily-schedule`, with default sound and a monochrome
calendar icon. Medicine continues using `medicine-reminders`. iOS receives an APNs alert
with sound, expiry, collapse ID and thread grouping; its background JS handler does not
create a duplicate local alert. Android and iOS show their normal platform-specific UI.

## Rollout Order

1. Review the changes and take the normal database backup/checkpoint.
2. Apply the additive migration to the intended environment.
3. Deploy API code with the new job still disabled. Do not change existing Firebase or
   database credentials. The earlier Firebase logging commit was reviewed with this update;
   diagnostics now omit token fragments and raw Firebase error messages.
4. Install the compatible 1.9.6 app on test phones. Confirm preferences and registration.
5. Verify a real FCM notification on Android and on a properly provisioned iPhone, including
   foreground, background, cold launch, permission-denied and offline/reconnect cases.
6. After those checks, enable `ENABLE_MORNING_REMINDERS=true` in the intended API environment.
   Test an actual 08:00 India-time schedule and verify medicine reminders still arrive.
7. Publish the mobile release only after the release checks are accepted.

Disabling the new flag and restarting/redeploying the API stops this job without disabling
medicine reminders. Keep the additive tables and delivery history for a later retry.

## Verification

- `npm test`: unit/regression tests; the MySQL test is skipped unless a QA socket is set.
- `MORNING_REMINDER_TEST_SOCKET=/tmp/eldara-morning-qa.sock npm test` runs the SQL tests too.
  The socket-only test instance must be a disposable local MySQL server. The test creates
  and drops its own `eldara_morning_test_<pid>` database, never the application database.
- Verified 34 backend tests, including actual MySQL migration rerun, preference filtering,
  assignee/device ownership, inactive sessions, concurrent claims and lease recovery.
- The full suite was also run with `TZ=America/Los_Angeles` to check timezone independence.
- Actual Firebase sends were subsequently verified using only the newly created QA emulator:
  two fixture messages while backgrounded, then two after ending its background process
  without force-stopping the package. Android displayed both message types and their summary.
  A clean install confirmed the channel's default notification sound URI. No real user account
  was targeted and no application production data or Firebase settings were changed.
- Physical Android phone testing, a real 08:00 production run and iPhone delivery remain
  outstanding. A force-stopped Android package is not equivalent to a normally ended process.

## iPhone Prerequisites Still To Verify

The project now declares push entitlements and remote-notification background mode.
Firebase project/credentials are unchanged. Verify APNs authentication in the existing
Firebase project's Apple app configuration and regenerate provisioning profiles with push
enabled as needed. Do not replace working Android credentials.

The installed Xcode's iOS 18.5 SDK cannot compile the existing Vision Camera dependency:
`kCVPixelFormatType_96VersatileBayerPacked12` is unavailable in that SDK. The simulator build
was attempted and failed in that unchanged dependency. A compatible Xcode/SDK or a separately
reviewed camera compatibility fix is needed before an iOS build can be called ready.
Real iPhone delivery has not been verified.

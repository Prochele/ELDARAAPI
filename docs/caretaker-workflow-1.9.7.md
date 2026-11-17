# ELDARA caretaker workflow

Version 1.9.7. Updated 17 November 2026.

This guide explains the caretaker workflow for caretakers, Patron Admins and the development team. The latest source changes are committed to GitHub. Release APK, AAB and signed iPhone files have not been regenerated after the latest UI updates, so the existing release files must not be treated as the latest reviewed version.

## Caretaker account and working hours

Caretakers use their existing ELDARA registration and OTP login. Registration has not been replaced. Under Caretaker connections, they can open My availability, Private inbox, Assignments and My reviews.

In My availability, the caretaker selects whether they are accepting new work and whether they prefer full-time, part-time or either. The caretaker provides their regular working days and hours; the Patron Admin does not enter these on the caretaker's behalf.

1. Select a working day or All days. All days means Sunday through Saturday.
2. Choose From time and To time. Times use Indian Standard Time.
3. Tap Add working hours. A message confirms that the range was added to the draft and reminds the caretaker to save.
4. Add another non-overlapping range if needed, for example a separate evening range.
5. Tap Save availability. Review the work preference, grouped days and times, and unavailable dates in the confirmation.
6. Choose Save to submit, or Go back to keep editing. A success message appears only after the API saves successfully. A failed save keeps the entered hours for retry.

Identical hours are grouped into one card. For example, seven daily entries display as All days with the time range. Repeated taps do not add the same hours twice. All days fills missing days while retaining matching existing hours. An overlap on any selected day prevents the whole addition; the app identifies the affected days. Adjacent ranges are allowed. The limit is 28 individual day/time ranges across the week. Removing a grouped range removes those hours from every day listed in that group.

Hours remain a local draft until saved. Working-day/time picker values must be added using Add working hours before they form part of the saved schedule. Confirmed assignments are checked by the backend before availability changes are accepted; the caretaker cannot remove hours needed by existing confirmed work.

## Unavailable dates

The previous label Leave has been replaced with Unavailable dates. These are whole dates when the caretaker cannot work for any patron, even during their usual weekly hours. Both the start date and end date are included.

The caretaker selects Unavailable from and Unavailable until, taps Add unavailable dates, then saves availability. This records unavailability; it is not an employer-approved leave request. An empty list means no unavailable dates were entered, not a promise that the caretaker can work at every time.

## Finding caretakers and understanding status

Patron Admins see all active registered caretakers by default, with pagination. They can search by name or caretaker code and filter by city, gender and minimum/maximum age. Clear resets these fields, returns to page 1 and reloads all caretakers.

Phone numbers and email addresses are excluded from search API responses and profile display. Search and profiles show Assignment with your patrons, derived from the same assignment records used by the Assignments tab.

| Display | Meaning |
| --- | --- |
| Currently assigned in green | A confirmed assignment to one of your patrons is active today. The patron names are shown. |
| Currently unassigned in gray | No current confirmed assignment to your patrons was found in the complete returned history. This does not disclose work for other Patron Admins. |
| Scheduled assignment in blue | A confirmed assignment starts on a future date. |
| Proposal awaiting confirmation in amber | A proposal exists but is not yet a confirmed assignment. |
| Assignment ended in gray | A historical assignment was ended. Its actual end date and time are shown. |
| Proposal declined in red | The caretaker declined that proposal. |

An ended assignment remains in history for reviews. It does not count as a current assignment. Assignment status is scoped to your patrons; it does not mean globally available or globally employed. The app no longer displays New work preference not confirmed as the main search status. Working hours and unavailable dates remain separate scheduling information.

Profiles include your assignment history with that caretaker, weekly hours, unavailable dates, reviews and caretaker replies. Other Patron Admins' patron identities and assignment details remain private. The current history endpoint returns at most 200 records; if a full 200-record response cannot establish an unassigned status, the UI directs the user to earlier assignment history rather than asserting unassignment.

## Contact requests and private inbox

The Patron Admin taps Contact caretaker and sends a short introduction. The caretaker receives the request and may accept or decline. After acceptance, the pair can exchange text messages in their private inbox. The inbox shows only the signed-in participant's conversations, with the other participant, latest message/request, time and unread count.

One conversation is maintained per Patron Admin/caretaker pair. Up to five new requests may be sent per Indian calendar day. Declined requests cannot be repeatedly resent. Either participant can block/unblock or report a conversation. Blocking stops further messages and new proposals; ending an active assignment is a separate action. Reporting does not automatically ban an account. Authorised ELDARA administrators can inspect reported conversations, and report review actions are audited.

Messages are stored in MySQL and fetched over authenticated HTTPS. They are not end-to-end encrypted. No new chat database or Firebase subscription was added by this implementation; existing hosting and storage usage billing still applies.

## Assigning and unassigning

After discussing the arrangement in the inbox, the Patron Admin selects an owned patron, work type, one-day or weekly schedule, dates, working days and hours. The caretaker confirms or declines. The backend checks ownership, working hours, unavailable dates and overlapping confirmed assignments transactionally.

The same caretaker may serve different patrons at non-overlapping times. Care access starts only for confirmed assignments within their dates. Pending proposals do not grant care access.

Unassign caretaker opens a confirmation explaining which patron's assignment will end. Go back cancels; Unassign ends that assignment. Existing health records remain. The end timestamp is recorded and displayed. Access from another valid assignment is evaluated separately. Older assignments migrated without invented hours and show Working hours not recorded; agreed hours must be established before new conflicting scheduled work can be confirmed.

## Ratings feedback and replies

After a confirmed assignment ends or completes, its original Patron Admin can optionally write or edit a review. The rating uses five selectable stars, with an optional short feedback message. A separate review belongs to each assignment period, with its dates and review timestamp. Historical reviews remain visible without invented assignment dates.

The caretaker can add or edit a reply to each new dated review under My reviews. Replies appear with the review in the profile/search review view. Reviews and replies are not private inbox messages.

## Database and stored programs

The additive caretaker migration introduced ten tables: CareWorkPreferences, CareAvailability, CareLeave, CareContact, CareMessage, CareBlock, CareReport, CareAssignment, CareReview and CareNotice. The database has 56 tables and 46 stored procedures at the verified caretaker checkpoint. The latest UI updates require no new tables, schema alterations or stored procedure replacements.

The existing assignment/rating stored procedures do not implement confirmed dated assignments and period reviews. The caretaker API uses transactions with the new tables; legacy assignment/rating write endpoints return an update-required response. Existing medicine, appointment and activity stored procedures were retained.

A missing saved work preference is distinguished from an explicitly saved acceptance/refusal in API metadata. It must not be interpreted as proof that a caretaker is assigned elsewhere or personally declined new requests.

For the latest full backup, schema snapshot and restore evidence, see Database Backup and Restore, document 17. Full data exports remain under the private-backups folder on this Mac and are not suitable for GitHub.

## Notifications

Medicine schedules, daily activities and doctor appointment notifications retain their existing reminder logic, timing, preferences and recipients. Caretaker updates use a separate generic Firebase notification type and channel, without putting message text or patron details in the notification preview. Care notification delivery retries run independently of reminder schedulers.

Phone notification permission and the appropriate reminder switches must be enabled. Local tests do not prove delivery to a physical phone. Physical Android/iPhone push delivery was not retested during this UI review.

## GitHub and validation

Latest mobile commit: a0f036a9aa6d7584d9e623fd7fcb8bb5f4e5dfc5 in Prochele/ELDARA.

Latest API commit: 6ee5e40fc68179d9fcc0f3aa2c85d607db39fcd2 in Prochele/ELDARAAPI.

All 88 mobile tests passed, TypeScript noEmit passed, and targeted ESLint reported zero errors with one existing inline-style warning. Backend checks passed 34 tests; two opt-in isolated MySQL integration tests were skipped in that final source check. Earlier caretaker migration integration tests and backup restore rehearsals are separately recorded in the readiness evidence.

Android emulator checks covered navigation visibility, the Clear action, five-star ratings, assignment status and actual end dates. iPhone simulator checks covered tab visibility, star selection/display, modal safe-area spacing, All days, duplicate prevention and save-confirmation display. Component tests cover Android and iOS save confirmation, cancellation, success and failure. Do not interpret simulator checks as production-store publication or signed iPhone validation.

## Builds and remaining release checks

Existing files under RELEASES/1.9.7/Android predate the latest reviewed UI changes. They must be rebuilt and verified after the owner approves a build. No APK, AAB or IPA was built or uploaded during the latest GitHub commit or this documentation refresh.

The selected developer tools still report Xcode 16.4 and iOS SDK 18.5. Earlier full iPhone compilation was blocked by camera-library references to newer iOS APIs; Apple signing credentials and a push-enabled provisioning profile also needed correction. No new signed archive was attempted, so those release requirements are not marked resolved. The running iPhone development simulator is not a signed App Store IPA.

See output/caretaker-2026-11-17/READINESS.md for current source status, historical artifact evidence and outstanding publication checks.

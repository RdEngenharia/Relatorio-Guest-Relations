# Security Specification for Guest Occurrence App

This specification details the security policy and verification checks for Firestore databases on the Guest Occurrence Report system.

## 1. Data Invariants

1. **Verification Required:** Standard operators (the "guest relation" staff) must be authenticated and, if they are modifying data, have verified sessions.
2. **Identification Integrity:** The author of any write or update must not be able to forge or impersonate other users' UIDs.
3. **Data Type and Size Safety:**
   - Booking Number and Apartment rooms must be short strings (length <= 32).
   - `occurrenceType` must belong to a predefined set: `Reclamação`, `Feedback positivo`, `Outro`, etc.
   - `sector` must contain valid identifiers such as `AeB`, `Estrutura`, `TI`, `Lazer`, `Manutenção`, `Governança`, `Recepção`, `All inclusive`, `Wifi`, `Programações`, or other general categories.
   - Observation size must not exceed 5000 characters to prevent database resource exhaustion.
4. **Timestamp Immutability:** `createdAt` must match the actual server time at inception and remain unchanged thereafter.

## 2. The "Dirty Dozen" Vulnerability Payloads

This suite verifies that the security rules reject unauthorized behaviors:

1. **Unauthenticated Read:** Get occurrences without signing in (Expected: DENIED).
2. **Unauthenticated Write:** Insert a new occurrence without credentials (Expected: DENIED).
3. **Identity Spoofing:** Create an occurrence where the logged-in user is `userB` but writes `userId: "userA"` (Expected: DENIED).
4. **Extreme ID Poisoning:** Attempt to write `occurrences/SOME_MONSTROUS_ID_OF_100KB_DATA_JUNK` (Expected: DENIED).
5. **System Field Escalation during Create:** Set a user role or override system statuses (Expected: DENIED).
6. **Immutable Override:** Modify `createdAt` after the document is established (Expected: DENIED).
7. **Type Mismatch - Numeric Booking Number:** Passing a number instead of string for `bookingNumber` (Expected: DENIED).
8. **Malicious Content Injection:** Save an observation that exceeds 5000 chars (Expected: DENIED).
9. **Sector Forgery:** Writing a non-string or junk value for `sector` (Expected: DENIED).
10. **State Corruption on Report Collection:** Insert a Report without the required array of sectorSummaries (Expected: DENIED).
11. **Malicious Update Shift:** Change the `bookingNumber` or `date` on an existing occurrence after it has been finalized (Expected: DENIED).
12. **Blanket Query Abuse:** Query list of all reports without passing standard filters or while unauthenticated (Expected: DENIED).

## 3. Test Schema

A standard test script (`firestore.rules.test.ts`) would execute simulation runs for each scenario above. Our active security rule structure is detailed below in `/firestore.rules` and conforms to these gates.

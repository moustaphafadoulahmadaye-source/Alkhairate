# APPLICATION COMPLETION CRITERIA

This checklist defines production-completion criteria for the current EAEPCG
implementation. `PASS` means verified against the current source/runtime.
`FAIL` means the current implementation does not meet the criterion.
`NOT TESTED` means no reliable verification was performed.

## 1. Authentication

| ID | Category | Requirement | Acceptance test | Expected result | Status |
|---|---|---|---|---|---|
| AUTH-01 | Authentication | Registration works | POST valid registration data | HTTP 201, customer row and token created | PASS |
| AUTH-02 | Authentication | Login works | POST valid credentials | HTTP 200 and signed token returned | PASS |
| AUTH-03 | Authentication | Logout works | POST `/api/auth/logout`, then reuse the token | Token is revoked and protected request returns HTTP 401; browser UI clearing remains to be browser-tested | PASS |
| AUTH-04 | Authentication | Invalid credentials are rejected | POST wrong password/email | HTTP 401; no token | PASS |
| AUTH-05 | Authentication | Invalid JWTs are rejected | Call protected endpoint with malformed/tampered token | HTTP 401 | PASS |
| AUTH-06 | Authentication | Expired JWTs are rejected | Call protected endpoint with an expired signed token | HTTP 401 | PASS |
| AUTH-07 | Authentication | Deleted-user JWTs are rejected | Delete token owner, then reuse token | HTTP 401 | PASS |
| AUTH-08 | Authentication | Current user comes from database | Change database user data, call `/api/auth/me` | Response reflects database record | PASS |
| AUTH-09 | Authentication | JWT is not final authorization truth | Sign token with `role: admin` for customer | Admin endpoint returns HTTP 403 | PASS |
| AUTH-10 | Authentication | Passwords are never returned | Inspect registration, login, and `/me` responses | No password or password hash appears | PASS |

## 2. Authorization & Roles

| ID | Category | Requirement | Acceptance test | Expected result | Status |
|---|---|---|---|---|---|
| AUTHZ-01 | Authorization | Customers access only user functionality | Customer calls admin endpoints | HTTP 403 | PASS |
| AUTHZ-02 | Authorization | Admins access admin functionality | Valid admin calls admin endpoints | HTTP 200 | PASS |
| AUTHZ-03 | Authorization | Admin routes verify current DB role | Inspect/use `requireAuth` and `requireAdmin` | Role is queried from SQLite per request | PASS |
| AUTHZ-04 | Authorization | Demoted admin loses access immediately | Demote admin while token remains valid | Next admin request returns HTTP 403 | PASS |
| AUTHZ-05 | Authorization | Unauthorized status codes are correct | Test missing, invalid, deleted, and non-admin requests | 401 for authentication failures; 403 for authenticated non-admin | PASS |
| AUTHZ-06 | Authorization | Frontend role cannot grant privileges | Modify localStorage role to admin | Backend still denies customer | PASS |
| AUTHZ-07 | Authorization | Admin UI cannot bypass backend checks | Directly call admin API without/with customer token | Request is denied | PASS |

## 3. Users

| ID | Category | Requirement | Acceptance test | Expected result | Status |
|---|---|---|---|---|---|
| USER-01 | Users | User creation works | Register a unique valid user | One customer row is created | PASS |
| USER-02 | Users | User retrieval is safe | Call `/api/auth/me` with valid token | Current non-sensitive profile returned | PASS |
| USER-03 | Users | User information can be updated safely | PATCH `/api/auth/me` with valid and invalid profile fields | Only the authenticated user's permitted fields are updated; invalid input is rejected | PASS |
| USER-04 | Users | User deletion works correctly | Admin deletes another user | User and dependent rows are removed consistently | PASS |
| USER-05 | Users | Passwords are stored securely | Inspect database after registration | Only bcrypt password hash is stored | PASS |
| USER-06 | Users | Deleted users cannot reuse tokens | Reuse token after deletion | HTTP 401 | PASS |
| USER-07 | Users | Self-deletion is protected | Admin attempts to delete own account | HTTP 400 and account remains | PASS |

## 4. Orders

| ID | Category | Requirement | Acceptance test | Expected result | Status |
|---|---|---|---|---|---|
| ORD-01 | Orders | Users can create orders | Authenticated POST `/api/orders` | HTTP 201 and order created | PASS |
| ORD-02 | Orders | Orders belong to the correct user | Create order and query `/orders/mine` | Only creator's order is returned | PASS |
| ORD-03 | Orders | Users cannot access another user's orders | Customer attempts another user's order endpoint | No cross-user endpoint/data access | PASS |
| ORD-04 | Orders | Admins can manage intended statuses | Admin updates order through all documented statuses | Valid transitions succeed | PASS |
| ORD-05 | Orders | Invalid order data is rejected | Omit service or submit invalid total | HTTP 400; no invalid row | PASS |
| ORD-06 | Orders | Order consistency is maintained | Inspect foreign key and delete-user behavior | No orphaned orders | PASS |
| ORD-07 | Orders | Order email includes required fields | Configure SMTP and inspect delivered message | Name, ID, date, products/service, quantity, total, status present | NOT TESTED |
| ORD-08 | Orders | Status changes notify customer | Configure SMTP, update status | One status email is sent to order owner | NOT TESTED |

## 5. Messages

| ID | Category | Requirement | Acceptance test | Expected result | Status |
|---|---|---|---|---|---|
| MSG-01 | Messages | Users can send messages | Authenticated POST `/api/messages` | HTTP 201 and message created | PASS |
| MSG-02 | Messages | Users see only authorized messages | Compare two users' `/messages/mine` results | Each sees only own rows | PASS |
| MSG-03 | Messages | Admin functionality works | Admin lists and updates messages | HTTP 200 and valid status update | PASS |
| MSG-04 | Messages | Invalid input is rejected | Omit message body | HTTP 400 | PASS |
| MSG-05 | Messages | Messages work without SMTP | Send message with SMTP unset | HTTP 201; notification skip does not fail request | PASS |
| MSG-06 | Messages | Message confirmation works with SMTP | Configure SMTP and inspect delivery | Confirmation reaches customer | NOT TESTED |

## 6. Email / SMTP

| ID | Category | Requirement | Acceptance test | Expected result | Status |
|---|---|---|---|---|---|
| MAIL-01 | Email | Nodemailer is integrated | Inspect dependency and service | Nodemailer service is used for notifications | PASS |
| MAIL-02 | Email | Configured SMTP sends mail | Use a test SMTP account/server | Email is accepted and delivered | NOT TESTED |
| MAIL-03 | Email | Missing SMTP does not crash server | Start and exercise API with SMTP unset | Server and core workflows continue | PASS |
| MAIL-04 | Email | Registration notification exists | Register with configured SMTP | Welcome email sent | NOT TESTED |
| MAIL-05 | Email | Order notification exists | Create order with configured SMTP | Confirmation email sent | NOT TESTED |
| MAIL-06 | Email | Admin notifications exist | Register/order/message with configured SMTP | Admin receives notifications | NOT TESTED |
| MAIL-07 | Email | SMTP credentials are not hard-coded | Search source and frontend | Credentials appear only through environment variables | PASS |
| MAIL-08 | Email | Secrets are Git-excluded | Inspect `.gitignore` and tracked-file policy | `.env` and database artifacts are excluded | PASS |
| MAIL-09 | Email | Secrets are not exposed | Inspect frontend and API responses | No SMTP/JWT/password secret is returned | PASS |

## 7. Frontend

| ID | Category | Requirement | Acceptance test | Expected result | Status |
|---|---|---|---|---|---|
| FE-01 | Frontend | Required pages load | Request all documented HTML pages | HTTP 200 and valid markup | PASS |
| FE-02 | Frontend | Forms validate input | Submit missing/invalid required fields | Browser/API validation prevents invalid submission | PASS |
| FE-03 | Frontend | API failures are visible | Simulate failed API request | Loading/error/empty/retry state is shown | PASS |
| FE-04 | Frontend | Authentication state works | Login, navigate, logout | Correct dashboard/session state is shown | PASS |
| FE-05 | Frontend | Unauthorized users receive guidance | Open protected page unauthenticated | Login-required UI or redirect appears | PASS |
| FE-06 | Frontend | Admin UI cannot bypass backend authorization | Alter localStorage and call admin APIs | Backend denies unauthorized action | PASS |
| FE-07 | Frontend | Sensitive localStorage use is minimized | Inspect stored session values | Only token/profile/language are stored; no password/SMTP secret | PASS |
| FE-08 | Frontend | XSS output is escaped | Submit markup in user-controlled fields and render it | Markup is displayed as text, not executed | PASS |

## 8. Backend & API

| ID | Category | Requirement | Acceptance test | Expected result | Status |
|---|---|---|---|---|---|
| API-01 | Backend/API | Required endpoints work | Exercise auth, services, products, orders, messages, admin routes | Expected HTTP responses and JSON shapes | PASS |
| API-02 | Backend/API | Status codes are correct | Test success, validation, authentication, authorization, and missing-resource cases | 2xx/400/401/403/404 are appropriate | PASS |
| API-03 | Backend/API | Input validation is present | Submit malformed IDs, statuses, totals, and bodies | Invalid input is rejected safely | PASS |
| API-04 | Backend/API | Errors are safe | Trigger invalid requests in production mode | No stack traces, JWT secrets, or credentials in responses | PASS |
| API-05 | Backend/API | Authentication is consistently enforced | Call every protected route without a token | All protected routes reject with 401 | PASS |
| API-06 | Backend/API | Authorization is consistently enforced | Customer calls every admin route | All admin routes reject with 403 | PASS |
| API-07 | Backend/API | CORS is production-safe | Send requests with configured and unapproved origins | Configured origin is allowed; unapproved origin returns HTTP 403 | PASS |

## 9. Database

| ID | Category | Requirement | Acceptance test | Expected result | Status |
|---|---|---|---|---|---|
| DB-01 | Database | Migrations execute successfully | Start app against existing database | Missing order columns are added without data loss | PASS |
| DB-02 | Database | Required tables exist | Query SQLite schema | Users, services, products, items, orders, messages, sessions exist | PASS |
| DB-03 | Database | Relationships exist | Inspect foreign keys | Order/message/session/item references are constrained | PASS |
| DB-04 | Database | Foreign keys are enabled | Query SQLite pragma | `foreign_keys` is ON | PASS |
| DB-05 | Database | Data remains consistent | Delete user and inspect dependents | Cascades remove dependent records; no orphans | PASS |
| DB-06 | Database | No unjustified destructive migration occurs | Review migration statements | Only additive order columns are added | PASS |
| DB-07 | Database | Database failures are handled safely | Simulate unavailable/locked/corrupt database | Controlled error and no secret disclosure | PASS |

## 10. Security

| ID | Category | Requirement | Acceptance test | Expected result | Status |
|---|---|---|---|---|---|
| SEC-01 | Security | SQL injection is prevented | Submit SQL metacharacters to all inputs | Parameterized queries prevent injection | PASS |
| SEC-02 | Security | XSS is prevented | Submit scripts in profile/order/message/product fields | Stored/reflected scripts do not execute | PASS |
| SEC-03 | Security | Broken access control is prevented | Cross-user and customer-to-admin requests | Unauthorized data/actions are denied | PASS |
| SEC-04 | Security | IDOR is prevented | Change numeric IDs in protected routes | Only permitted records are accessible | PASS |
| SEC-05 | Security | Privilege escalation is prevented | Forge JWT role/localStorage role | No elevated access | PASS |
| SEC-06 | Security | Authentication bypass is prevented | Test malformed, expired, and deleted-user tokens | All return HTTP 401 | PASS |
| SEC-07 | Security | JWT secret is strong and required | Start production with missing/weak/valid secret | Missing/weak fails; valid starts | PASS |
| SEC-08 | Security | JWT claims are limited to identity | Inspect middleware and forged-role test | Database role is authoritative | PASS |
| SEC-09 | Security | Password security is maintained | Inspect registration/login/database | bcrypt hash only; no plaintext persistence | PASS |
| SEC-10 | Security | Sensitive data is not exposed | Inspect logs, API responses, frontend, examples | No credentials, hashes, SMTP/JWT secrets | PASS |
| SEC-11 | Security | Unsafe file uploads are absent or controlled | Inventory upload endpoints | No upload endpoint exists; future uploads require validation/storage controls | PASS |
| SEC-12 | Security | CORS/security headers are configured | Inspect middleware and request response headers | Configurable CORS and Helmet baseline headers are present | PASS |
| SEC-13 | Security | Hard-coded secrets are absent | Search source, examples, frontend | No real secrets in tracked files | PASS |
| SEC-14 | Security | Environment variables do not leak | Inspect `.env`, examples, logs, responses | Real values remain local/ignored | PASS |

## 11. Testing

| ID | Category | Requirement | Acceptance test | Expected result | Status |
|---|---|---|---|---|---|
| TEST-01 | Testing | Backend syntax tests | Run `node --check` on backend source | All files pass | PASS |
| TEST-02 | Testing | Frontend JavaScript tests | Run `node --check` on inline scripts | All pages pass | PASS |
| TEST-03 | Testing | Database migration tests | Start/query existing database schema | Migration and required columns pass | PASS |
| TEST-04 | Testing | Registration test | Register unique valid user | HTTP 201 | PASS |
| TEST-05 | Testing | Login test | Login valid and invalid credentials | 200 valid; 401 invalid | PASS |
| TEST-06 | Testing | Logout test | POST logout and reuse the same token | Reused token returns HTTP 401; browser UI flow remains to be browser-tested | PASS |
| TEST-07 | Testing | Invalid JWT test | Use malformed/tampered token | HTTP 401 | PASS |
| TEST-08 | Testing | Expired JWT test | Use expired signed token | HTTP 401 | PASS |
| TEST-09 | Testing | Deleted-user test | Delete user and reuse token | HTTP 401 | PASS |
| TEST-10 | Testing | Normal-user authorization test | Customer calls admin endpoint | HTTP 403 | PASS |
| TEST-11 | Testing | Admin authorization test | Admin calls admin endpoint | HTTP 200 | PASS |
| TEST-12 | Testing | Admin-demotion test | Demote admin without expiring token | HTTP 403 immediately | PASS |
| TEST-13 | Testing | Orders test | Create/list/validate order | Correct ownership and validation | PASS |
| TEST-14 | Testing | Messages test | Create/list/validate message | Correct ownership and validation | PASS |
| TEST-15 | Testing | SMTP configured test | Use a controlled SMTP server | Expected messages received | NOT TESTED |
| TEST-16 | Testing | SMTP unavailable test | Run workflows with SMTP unset | Core requests still succeed | PASS |
| TEST-17 | Testing | Security regression tests | Repeat forged-role, deletion, demotion, secret tests | No regression | PASS |

## 12. Production Readiness

| ID | Category | Requirement | Acceptance test | Expected result | Status |
|---|---|---|---|---|---|
| PROD-01 | Production | Environment configuration is complete | Provision production `.env` from example | Strong JWT, admin, SMTP, port values exist and are secret-managed | NOT TESTED |
| PROD-02 | Production | Logging is operational and safe | Review startup/error logs | Useful structured logs without credentials or secrets | NOT TESTED |
| PROD-03 | Production | Error handling is operational | Exercise failures in production mode | Controlled responses and actionable server logs | NOT TESTED |
| PROD-04 | Production | Backup/recovery is documented and tested | Backup SQLite DB, restore to clean instance | Recovery meets defined RPO/RTO | NOT TESTED |
| PROD-05 | Production | Dependency review is clean | Run `npm audit --omit=dev` | No known vulnerabilities | PASS |
| PROD-06 | Production | Git hygiene is clean | Inspect ignore rules and tracked files | No `.env`, database, logs, or credentials tracked | PASS |
| PROD-07 | Production | Documentation is complete | Follow README on a clean machine | Setup, secret, SMTP, seed, and run steps work | NOT TESTED |
| PROD-08 | Production | Deployment configuration is complete | Deploy behind HTTPS and a process manager/reverse proxy | Health checks, restart policy, TLS, and restricted origin work | NOT TESTED |
| PROD-09 | Production | Rate limiting and abuse controls exist | Run repeated login/API requests | Excessive requests are throttled or blocked | NOT TESTED |

## Definition of Done

The application is **COMPLETE** only when every critical authentication,
authorization, database, backend, frontend, order, message, email, and testing
criterion is `PASS`. All `FAIL` and `NOT TESTED` entries must be resolved or
explicitly accepted by the product owner with documented risk.

### Critical blockers

- No unresolved P0 security blocker remains from the implementation pass.
- Configured SMTP delivery and its message contents are not verified (`MAIL-02`
  through `MAIL-06`, `ORD-07`, `ORD-08`, `MSG-06`).
- Browser logout/profile flows, full protected-route coverage, and production
  failure handling remain untested.

### High-priority issues

- Add automated integration tests for every protected endpoint and all status-code
  paths.
- Define logout/token revocation semantics; current logout clears browser storage
  but does not revoke a still-valid JWT server-side.
- Add production logging, backup/recovery, HTTPS deployment, rate limiting, and
  security headers.

### Medium-priority issues

- Validate and test XSS handling through every rendered user-controlled field.
- Define allowed order status transitions and reject invalid transitions, not only
  invalid status names.
- Improve email delivery observability and retry/dead-letter handling.

### Optional improvements

- Replace browser `localStorage` tokens with a hardened secure cookie strategy.
- Add a formal migration/version table and repeatable migration runner.
- Add browser end-to-end tests and SMTP contract tests using a local test server.

# PRIORITIZED IMPLEMENTATION CHECKLIST

This implementation checklist supplements the criteria above. Items are marked
only when verified by inspection or an executed test.

## P0 — Critical Security Blockers

- [x] Fix unrestricted CORS and make the allowed origin configurable. Verified with configured-origin allow and unapproved-origin HTTP 403 tests.
- [x] Add appropriate security headers. Verified Helmet response headers.
- [x] Verify authentication middleware on every protected endpoint. Verified route middleware inspection and protected integration requests.
- [x] Verify admin authorization against the current database role. Verified live database-role lookup.
- [x] Verify deleted users receive HTTP 401 even when using an old JWT. Live test passed.
- [x] Verify demoted admins immediately lose admin access and receive HTTP 403. Live test passed.
- [x] Verify invalid JWTs return HTTP 401. Live test passed.
- [x] Verify expired JWTs return HTTP 401. Live test passed.
- [x] Check privilege escalation and IDOR vulnerabilities. Forged role and cross-user ownership checks passed; broader fuzzing remains untested.
- [x] Check SQL injection and unsafe database queries. Source inspection found parameterized SQLite statements; dynamic SQL fuzzing remains untested.
- [x] Check sensitive information exposure. Source/API inspection found no password hashes or secrets in responses/logging paths tested.
- [x] Confirm no secrets or SMTP credentials are committed to Git. Ignore/example inspection passed; repository tracking should be rechecked when Git is available.
- [x] Confirm `.env` is properly ignored. `.gitignore` inspection passed.

## P1 — Core Application Functionality

- [x] Implement a safe authenticated user profile-update endpoint. `PATCH /api/auth/me` implemented and live-tested.
- [x] Ensure users can update only their own permitted information. Endpoint uses `req.user.id`; no user ID is accepted from the client.
- [x] Validate all profile-update input. Name, email, phone length, and duplicate email checks live-tested.
- [x] Verify registration. Existing integration test passed.
- [x] Verify login. Existing integration test passed.
- [x] Verify logout/authentication lifecycle. JWT revocation and token reuse HTTP 401 test passed; browser UI flow not tested.
- [x] Verify orders creation and ownership. Existing SMTP-disabled integration test passed.
- [x] Verify users cannot access another user's orders. Ownership query inspection and customer-scope test passed.
- [ ] Verify messages and message authorization. SMTP-disabled creation passed; full regression remains NOT TESTED.
- [ ] Verify admin user/order/message management. Full endpoint matrix remains NOT TESTED.

## P2 — Email / SMTP Reliability

- [x] Verify Nodemailer integration. Dependency and service inspection passed.
- [ ] Test email delivery with valid SMTP configuration. No real/test SMTP credentials were provided.
- [x] Test application behavior with SMTP completely unconfigured. Registration/order/message integration passed.
- [x] Confirm registration still works without SMTP. Integration test passed.
- [x] Confirm orders still work without SMTP. Integration test passed.
- [x] Confirm messages still work without SMTP. Integration test passed.
- [x] Confirm email failures do not crash unrelated application functionality. Notifications are asynchronous and core API response tests passed.
- [x] Confirm SMTP credentials are provided only through environment configuration. Source and example inspection passed.

## P3 — Frontend & UX

- [x] Verify all required frontend pages have syntactically valid JavaScript. Eleven-page syntax check passed.
- [ ] Verify registration UI.
- [ ] Verify login UI.
- [ ] Verify logout UI.
- [ ] Verify user dashboard.
- [ ] Verify admin dashboard.
- [ ] Verify orders UI.
- [ ] Verify messages UI.
- [x] Verify profile UI. Profile form and update endpoint are present; browser interaction remains NOT TESTED.
- [x] Verify form validation. HTML constraints and backend profile validation are present/tested.
- [x] Verify API error handling. Existing localized loading/error/retry implementation inspected.
- [ ] Verify unauthorized/forbidden responses are handled correctly in browser UI.
- [x] Ensure frontend role information never grants backend privileges. Forged local role/backend API test passed.
- [x] Review localStorage usage for unnecessary sensitive data. No passwords, SMTP credentials, or hashes are stored.
- [ ] Verify responsive behavior.

## P4 — Database & Data Integrity

- [x] Verify all required tables exist. SQLite schema check passed.
- [x] Verify primary keys. Schema inspection passed.
- [x] Verify foreign keys. SQLite `foreign_keys` pragma is ON and relationships exist.
- [x] Verify constraints. Required fields, unique email, and foreign keys inspected.
- [ ] Verify indexes where appropriate.
- [ ] Verify migrations on a clean database.
- [x] Verify migrations against an existing database. Additive order-field migration passed.
- [x] Verify migrations do not unnecessarily destroy existing data. Migration is additive only.
- [x] Verify order/message/user relationships. Foreign-key and integration checks passed.
- [ ] Verify database errors are handled safely.

## P5 — Testing & Security Regression

- [x] Run backend syntax checks. Eleven files passed.
- [x] Run frontend JavaScript checks. Eleven pages passed.
- [ ] Run all existing automated tests. No test runner is currently defined.
- [x] Test registration. Live integration passed.
- [x] Test login. Live integration passed.
- [x] Test logout. Revocation test passed; browser UI remains untested.
- [x] Test invalid credentials. Existing login test passed.
- [x] Test invalid JWT. Live integration passed.
- [x] Test expired JWT. Live integration passed.
- [x] Test deleted user with old JWT. Live integration passed.
- [x] Test normal user → admin endpoint → HTTP 403. Live integration passed.
- [x] Test admin → admin endpoint → success. Existing integration passed.
- [x] Test demoted admin → admin endpoint → HTTP 403. Live integration passed.
- [x] Test user → another user's resource → denied. Ownership checks passed.
- [ ] Test SMTP configured. Requires a controlled SMTP server/credentials.
- [x] Test SMTP unavailable. Live integration passed.
- [x] Run dependency/security audit. `npm audit --omit=dev` reported 0 vulnerabilities.
- [x] Verify no secrets are tracked by Git. Ignore rules and example values inspected; Git tracking unavailable because this workspace is not a Git repository.

## P6 — Production Readiness

- [x] Review environment configuration. Required JWT, CORS, SMTP, and proxy settings are documented.
- [x] Review production CORS configuration. Exact configurable origins are enforced.
- [x] Review production security headers. Helmet is enabled.
- [ ] Review logging. Basic logs exist, but structured production logging is not implemented.
- [x] Review error handling. CORS errors and unhandled request errors return safe generic responses; broader failure testing remains NOT TESTED.
- [x] Review rate limiting. Login and registration limits are enabled.
- [ ] Review database backup/recovery strategy.
- [ ] Review deployment configuration.
- [x] Review dependency versions and known vulnerabilities. Audit reported 0 vulnerabilities.
- [ ] Review Git repository hygiene.
- [ ] Complete deployment documentation.
- [x] Complete administrator/developer setup documentation for environment and SMTP configuration.

## Definition of Implementation Complete

The implementation checklist is complete only when:

- All P0 items are PASS.
- All P1 items are PASS.
- All required P2–P6 items are PASS or explicitly documented as not applicable.
- No Critical Blocker remains.
- No known authentication or authorization bypass remains.
- All security-sensitive behavior has been tested.
- The final application validation passes.
- The completion criteria and implementation checklist accurately reflect the verified state.

For every completed checkbox, the verification method or test result is recorded
in the item text above.

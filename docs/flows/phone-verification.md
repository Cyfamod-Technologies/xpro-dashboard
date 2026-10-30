# Phone verification

The provider profile retains its phone input. `PhoneVerificationField` uses the
account phone and verification status returned by `GET /auth/me`. Clicking Verify
number starts SMS verification and opens `PhoneVerificationDialog`. The dialog
uses the existing `AppTextField` code-entry pattern, supports SMS autofill and
paste, shows a resend countdown, and handles incorrect and expired codes.

The same field is available from Account. Phone verification is distinct from
XPro's profile approval. Existing Vuetify components and semantic theme colours
are used throughout; no additional UI package is needed.

API calls live in `services/xpro-api.ts`:

- `POST /me/phone/verify/start` with `{ phone }` sends or resends a code.
- `POST /me/phone/verify/confirm` with `{ verificationId, code }` confirms it.
- `GET /auth/me` returns `phone`, `phoneVerified` and `phoneVerifiedAt`.

Verification is valid only while the input matches the normalized account number.
The UI never persists a verification flag in form drafts. The profile can be filled
and autosaved before verification. Admin Settings has a **Require provider phone
verification** switch, disabled by default, saved through the existing settings
API with a reason and history. Only staff with `settings.manage` can change it.
When enabled, all providers must verify their phone before submitting or saving
their profile. When disabled, verification is optional and the phone checklist
does not block submission.

`GET /providers/me/onboarding-policy` exposes only the requirement flags
(`phoneVerificationRequired`, `emailVerificationRequired`) to a provider. The email flag
comes from the separate admin setting `provider.requireEmailVerification` (default on);
when it is on the form shows an **Email verified** checklist item and blocks submission
until `GET /auth/me` reports `emailVerified`. The form refreshes it on load and before submitting. If loading fails,
the form offers Retry and blocks submission until the current requirement is
known. The API independently rechecks the setting and the exact verified number
under locks before saving. No schema migration is needed for this registry setting.

Changing the form input requires verification for that number. Starting a code
request for a different number clears the account verification. Confirming the
code refreshes the trusted phone fields in the auth store. Demo mode retains the
existing onboarding behavior and does not call SMS endpoints.

The API deployment needs the phone-verification migration and SMS gateway
configuration. With delivery disabled, the form shows the server's unavailable
message and preserves the provider's draft. See the server repository's
`docs/phone-verification.md` for setup and limits.

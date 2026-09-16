# Alex’s admin guide

Use fictional data while the local-test banner is displayed. Create a unique admin with the terminal command in the README; there are no shared default credentials. Sign in with your password and TOTP authenticator code. Ordinary signup cannot create administrators.

## Coaching

- Open Requests. Move a submitted request to **under review**.
- Reply with any questions and choose **awaiting client response**. A client reply returns the request to **under review**.
- Approve or decline after reviewing. Approval alone does not activate service or imply payment.
- For an approved coaching request, record the agreed package/onboarding note, choose **Activate service**, and save.
- In Plan studio create a template. Training guidance should include exercises, sets/reps, weekly structure and appropriate instructions. Meal guidance should include meals, portions, ingredients and preparation, with a shopping list and substitutions. Recipes can be created separately and included in templates.
- Choose the active request, a template and any client adjustments, then **Publish new client version**. Repeat for other clients as needed. Published copies include recipe snapshots. Changing a template or recipe does not change prior assignments.
- Check-ins are one per Monday-based week for clients with active services. Feedback is private to that client. Optional measurements may be omitted.
- Client admin notes are private and excluded from client API responses and exports. Do not copy private notes into replies or plans.

## Services

Create, edit, publish, unpublish or archive a service. Leave price empty for enquiry-only pricing. Record only confirmed prices. Archive preserves request history. No prices or client success claims are invented.

## Private dining

1. Review date, named time zone, location, guest count, occasion, indicative budget, currency, dietary requirements and notes.
2. Review and approve the request. Send a proposal describing menu, event/date/location, travel and total price.
3. The client accepts in their portal. Accepted proposals cannot be silently edited. For revisions, cancel and begin a new enquiry/proposal.
4. If full payment is required, create an invoice matching the accepted proposal's exact currency and amount, then record the payment.
5. Confirm the booking separately. Cancellation does not automatically issue a refund; record refunds explicitly.

## Money

Invoices are created against approved requests. Use a descriptive agreed package and correct currency. Amounts in forms are major currency units (for example 25.00); the server stores whole minor units.

Record manual payments or refunds with the bank/provider reference. A repeated submission key cannot double-count. You cannot record more than the invoice balance or refund more than payments received. Paid revenue, refunds, net receipts and current outstanding invoices are separate. Net receipts are **not profit**. Currencies are never combined.

A refund does not automatically reopen an invoice balance: the report retains original amount, gross payments and refunds separately. If further payment is agreed, create a new invoice. Period reports use UTC transaction dates. Proposed work is excluded. Hosted checkout/payment links are not configured.

## Test accounts and recovery

`form-fire admin outbox` reads verification and reset messages locally. No message is sent externally. Use the reset screen for password recovery; resetting invalidates existing sessions but does not remove admin TOTP.

An expired verification code can be reissued from the **Resend verification** action on the verification screen. Recovery codes can be reissued on Forgot password. Outbox records are removed when their code is redeemed. Never expose the outbox or CLI over a public web route.

## Export and deletion

Clients can download their own JSON export from My profile and submit a deletion request. Account requests are listed in admin Clients.

For fictional local test data, process a requested deletion:

```bash
~/.local/bin/form-fire admin delete-requested-account client@example.test
```

This requires an existing deletion request, creates a backup, then removes that client's records, including invoices and payments. The backup retains the old data: remove it according to your testing needs. Do not use this test deletion flow for real financial records. Agree legal retention and identity-verification procedures before live use.

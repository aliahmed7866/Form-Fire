# Contact options and review — 30 September 2026

## Alex’s setup

Sign in normally as Alex, then open **Contact options** in the admin workspace. Add an international WhatsApp number (with `+` and country code) or a clean `https://wa.me/…` link. For Instagram, enter a username, `@username`, or a clean HTTPS profile link. Post/reel links, tracking parameters, misleading domains and executable URLs are rejected. Saving normalises the addresses.

Each channel has its own audience:

| Choice | Who receives the address/link |
| --- | --- |
| Hidden | Nobody through the Contact API; Alex can still edit the saved value |
| Signed-in clients | Any signed-in account in this workspace, including clients without an active paid service |
| Everyone (public) | All visitors; the address must be suitable for public disclosure |

Both start hidden, with no fabricated contact details. Add an optional reply-hours note, then save. Saved visitor/client previews show the exact visibility result. Settings use version checks to prevent one tab silently overwriting another. Changing settings records the admin actor and action without copying addresses into the audit trail. Hiding does not erase a saved address; clear the field and save to remove it. Someone who previously saw an address may retain it.

Clients find **Contact Alex** in their workspace and from a request conversation. The public header/footer also lead to Contact. In-app conversations and enquiries remain available even when no social channel is enabled. Instagram opens a profile; whether DMs are available depends on the recipient’s platform settings.

Links are plain HTTPS navigation opened only on a user click. No provider widget, tracking pixel or SDK is loaded. No client identifier, health detail, enquiry text or payment information is placed in a URL or prefilled message. The page explains the external service boundary, possible disclosure of the sender’s phone number/profile, and that messages are not synchronised into the app. Opening a link does not send a message or grant marketing consent. Link-format validation cannot verify account ownership or delivery: Alex must inspect his saved links himself.

## Changes from the wider review

- The privacy draft now covers metrics, goal history, food diaries, adaptations, habits, movement, bookings, browser drafts and external conversations, rather than only the original coaching records.
- API responses distinguish actual email confirmation (`email_verified`) from the legacy local access flag (`verified`). Client/admin badges now report email ownership honestly. Password-only testing remains available.
- Check-in Monday defaults now use the client’s profile timezone; Sunday/Monday boundary tests cover Los Angeles, London and Auckland.
- Service terms and published-plan copy distinguish nutrition estimates and dietary labels from allergen guarantees.
- The recording tour now includes four contact steps, for 104 total: Alex saves settings and previews them, visitors see the fallback, and Sam sees the client-only options. No external provider is contacted.

Migration 013 adds one settings row and preserves existing users, requests and plan/history records. There is no new runtime dependency or change to the normal ports.

## Compliance scope and remaining launch decisions

This is a UK-oriented engineering review because the current product uses British defaults. The operating jurisdiction is still unconfirmed. These changes support privacy and access controls; they are not certification of GDPR, PECR, food-law or WCAG compliance. The app remains a local test edition using fictional client information.

Before real clients, Alex and the responsible reviewer need to confirm the business/controller identity and contact/address, relevant jurisdictions, purposes and lawful bases, the additional condition for health-related special-category data where applicable, retention/deletion (including backups and external messages), recipients/transfers, rights-request handling, and any required impact assessment. Do not assume that submitting an enquiry supplies valid consent for every purpose. The ICO’s privacy guidance is under review following the Data (Use and Access) Act; recheck it before launch.

If marketing is later introduced, assess PECR separately for social direct messages as well as email/text. This release sends no outbound messages and creates no marketing list. Agree business-specific prices, cancellation/refund terms and required pre-contract information before taking actual bookings. Food service also requires reviewed allergen information and handling processes; vegan labelling is not an allergy assurance.

| Existing area reviewed | Evidence or remaining limit |
| --- | --- |
| Authentication, roles and client ownership | Existing integration/security tests plus two-client contact-denial tests; local verification policy preserved |
| Plans, activity, recipes, diary, adaptations, metrics and habits | Full existing regression suite and actual DOM/server recording journeys rerun; no claim of every input combination |
| Chef booking and manual payment/refund records | Existing state/idempotency tests and fictional recording journey; hosted payments remain disconnected |
| Export, deletion and privacy | Own-data export and deletion-request regression coverage; real retention decisions and external-provider deletion remain owner work |
| Backups, migrations and Termux scripts | Existing migration/backup/recovery tests and shell syntax checks; no new physical phone restore drill |
| Responsive/accessibility behaviour | Labelled forms, fieldsets, external-link notice and flexible contact cards; rendered mobile, keyboard/screen-reader and WCAG audit remain outstanding |

## Evidence register

Checked 30 September 2026. The sources support the narrow principles below, not approval of the whole app. Implementation review: Codex; business/legal/qualified food review remains pending.

| Source | Product use |
| --- | --- |
| [WhatsApp: click to chat](https://faq.whatsapp.com/5913398998672934) | Canonical `wa.me` international-number links; no automatic send or prefilled personal data |
| [ICO: electronic-mail marketing concepts](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-direct-marketing-using-electronic-mail/key-concepts-for-direct-marketing-using-electronic-mail/) | Social private messages fall within electronic mail; distinguish service contact from promotional messaging |
| [ICO: privacy information](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-privacy-information-should-we-provide/) | Explicit purposes, controller contact, recipients, retention and rights decisions are still needed |
| [ICO: special-category rules](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-are-the-rules-on-special-category-data/) | Health-related data can require an Article 9 condition as well as an Article 6 lawful basis; minimise data and assess risk |
| [GOV.UK: distance selling](https://www.gov.uk/online-and-distance-selling-for-businesses) | Review applicable pre-contract information and cancellation rules for the actual services/jurisdiction |
| [GOV.UK: vegan food labelling](https://www.gov.uk/understanding-food-labelling/vegan-food-labelling) | Dietary labels do not guarantee absence of allergens or cross-contamination |
| [FSA: allergen guidance](https://www.gov.uk/government/publications/allergen-guidance-for-food-businesses/allergen-guidance-for-food-businesses) | Catering needs appropriate allergen information and handling; scope includes England, Northern Ireland and Wales |
| [W3C: target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | Comfortable contact controls and spacing; full accessibility conformance requires broader testing |

## Pull this feature

```bash
cd "$HOME/Form-Fire"
git fetch origin
git switch feature/contact-settings
git pull --ff-only origin feature/contact-settings
```

For an isolated preview, run `bash termux/record.sh`; the contact settings are demonstrated near the end. To use the feature in the installed local app, restart that instance after pulling. Migrations apply at startup. Once merged, the normal `form-fire update` command can install it from `main`.

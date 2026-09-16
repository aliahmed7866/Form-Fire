# Optional Google sign-in

Google client sign-in is implemented, but stays disabled until you configure your own OAuth credentials. Email/password sign-in remains available. Alex’s admin always uses password plus TOTP; Google cannot grant or bypass administrator access.

## Connect it on Termux

1. In Google Cloud, configure your consent screen and create an OAuth client of type **Web application**. If the project is in Testing, add the Google account you intend to test with.
2. Register this exact authorised redirect URI for the default port:

   ```text
   http://127.0.0.1:8085/api/auth/google/callback
   ```

3. Edit `~/.config/form-fire/env` privately on the device and add:

   ```bash
   export FF_GOOGLE_CLIENT_ID='YOUR_WEB_CLIENT_ID'
   export FF_GOOGLE_CLIENT_SECRET='YOUR_CLIENT_SECRET'
   ```

4. Run `~/.local/bin/form-fire restart`, refresh the browser, and choose **Continue with Google**. Complete the flow in the same browser on the Android device running Termux.

For a changed port/origin, use the exact callback shown at **Setup & testing → Connection setup**. Do not mix `localhost` with `127.0.0.1`. Desktop development uses the same variables in a private `.env` loaded with `node --env-file=.env src/server.ts`.

Google documents the client/consent setup and exact redirect matching in its [OpenID Connect guide](https://developers.google.com/identity/openid-connect/openid-connect), and permits localhost IP addresses for local redirect testing in its [web-server OAuth guide](https://developers.google.com/identity/protocols/oauth2/web-server#uri-validation).

## Account behaviour

Only basic identity scopes are requested. New verified Google identities create client accounts. The stable provider subject identifies returning clients; a matching email never automatically links an existing password account. Use that account’s password instead. Provider email changes do not overwrite local records. No Google access, refresh or ID tokens are retained. Account deletion also removes the identity mapping.

The server uses browser-bound, expiring single-use state, PKCE, nonce and signed-token verification. Credentials stay server-side. Cancellation, expired attempts and provider failures return a helpful sign-in message. Google credentials, consent and a real provider round trip were not available for live verification in the build environment. Google login does not connect email delivery, online payments or production hosting.

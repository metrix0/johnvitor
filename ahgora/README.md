# Ahgora punch automation

Direct HTTP implementation for the current My Ahgora / Batida Online flow. It is intentionally fail-closed and does **not** punch unless run with `--execute` inside an allowed local time window.

## Known captured request

Successful web punch fields:

```text
account=96
password=<RSA ciphertext>
identity=6c41cd1f9f6a06d7d77f203b598f0339
origin=pw2
app_version=2.0
key=
enc=true
```

The exact current Request URL and current RSA public-key source still need to be copied from DevTools. Do not assume the old `https://www.ahgora.com.br/batidaonline/verifyIdentification` URL is still the production endpoint.

## Setup

Use Node.js 20+ and define the variables from `.env.example` in Windows environment variables or another local secret mechanism. Do not commit the password or private session material.

Required before any execution:

- `AHGORA_PUNCH_URL`: exact URL from DevTools.
- `AHGORA_PUBLIC_KEY_PEM`: current public key used by the web collector.
- `AHGORA_PASSWORD`: account password.
- `AHGORA_ALLOWED_WINDOWS`: explicit permitted local punch windows.

`AHGORA_RSA_PADDING` currently defaults to `pkcs1`, matching the common browser/JSEncrypt RSA mode, but this is provisional until the collector JavaScript is captured and verified. Set `oaep` only if DevTools/source inspection proves OAEP is used.

## Safe verification

A dry run performs local config, time-window and RSA encryption checks but sends no request:

```powershell
node src/punch.js
```

A real request requires both a matching allowed window and the explicit execution flag:

```powershell
node src/punch.js --execute
```

Do not use `--execute` until the current endpoint, content type, RSA key source/padding and a legitimate punch time have been verified.

## Idempotency behavior

Before sending, the script atomically creates one lock file per local date + configured time window. If a request times out, errors, returns malformed JSON, or has an unvalidated response, the lock remains in `uncertain_or_failed` state. Automatic retries are therefore blocked until the situation is manually inspected. A validated success requires `result === true`, an NSR, and valid returned day/time.

Successful and uncertain attempts are appended to `punches.ndjson`. Passwords/ciphertext are never logged.

## `batidas_dia` normalization

Ahgora may return times in both `HHMM` and `HHMMSS`. The captured `1245` and `124500` both normalize to `12:45:00`, so they are treated as one logical time, not automatically as duplicate punches.

## Next capture needed

In Chrome DevTools, open Network, select the request whose Response contains `"result": true`, then copy:

1. Request URL
2. Request Method
3. `Content-Type`
4. Request headers if any appear authentication/session-specific
5. The JavaScript call stack / Initiator for the request, or the script/function that creates the encrypted `password`

From that initiator we can identify the public-key source and exact RSA scheme, then remove the provisional encryption assumption and validate the direct request.

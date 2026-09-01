# Ahgora punch automation

Direct HTTP implementation for My Ahgora / Batida Online. It is intentionally fail-closed and sends **no request** unless explicitly run with `--execute` after all captured transport/RSA details are marked confirmed.

## Captured successful request fields

```text
account=96
password=<RSA ciphertext>
identity=6c41cd1f9f6a06d7d77f203b598f0339
origin=pw2
app_version=2.0
key=
enc=true
```

The exact current Request URL, Content-Type, required headers, public-key source and RSA scheme must come from the successful DevTools request/current collector code. The old `https://www.ahgora.com.br/batidaonline/verifyIdentification` endpoint is historical evidence only and is not hard-coded.

## Safety model

A real punch is treated as non-retryable:

- normal invocation is preflight-only and never sends HTTP;
- `--execute` requires `AHGORA_CAPTURE_CONFIRMED=true` and `AHGORA_RSA_CONFIRMED=true`;
- endpoint must be HTTPS, method must be captured as POST, and Content-Type must be explicitly configured;
- RSA public key is parsed and SHA-256 fingerprinted; execution is blocked if the configured fingerprint does not exactly match;
- execution is blocked outside explicit local punch windows;
- an atomic date+window lock is created **before** the HTTP request;
- if the request times out or the response cannot be validated, the lock remains and prevents an automatic retry;
- success requires `result === true`, NSR, and valid returned date/time;
- passwords and ciphertext are never logged.

This means an ambiguous network failure can leave a punch in `uncertain_or_failed`; that is deliberate, because blindly retrying could create a duplicate.

## Setup

Use Node.js 20+. Put secrets/config in Windows environment variables or another local secret store; do not commit them. See `.env.example`.

Before enabling execution, copy from Chrome DevTools for the request whose Response contains `"result": true`:

1. Request URL
2. Request Method
3. `Content-Type`
4. any session/auth-specific request headers that are actually required
5. Initiator/call stack or source function that creates the encrypted `password`
6. the public key/key endpoint and exact RSA padding scheme used by that code

Then populate the corresponding variables. `AHGORA_PUBLIC_KEY_SHA256` should be the SHA-256 fingerprint printed by a successful preflight after the current public key has been captured and independently checked.

## Preflight — no HTTP request

```powershell
node src/punch.js
```

Preflight validates configuration, parses the RSA key, verifies its fingerprint, and performs the password encryption locally. It prints `requestSent: false`.

## Real execution

Only at a legitimate punch time, after capture/RSA verification:

```powershell
node src/punch.js --execute
```

## `batidas_dia` normalization

Ahgora can return `HHMM` and `HHMMSS`. The captured values `1245` and `124500` both normalize to `12:45:00`; the client deduplicates them as one logical time rather than assuming they are two punches.

## Tests

```powershell
npm test
```

The current unit tests verify mixed `HHMM`/`HHMMSS` normalization without contacting Ahgora.

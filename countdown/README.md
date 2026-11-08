# Rinoplastia Countdown

URL: https://johnvitor.com/countdown/

Small, horizontally arranged widget for a private Notion embed. The Netlify
Function serves a surgery-date countdown and a savings-goal calculation.

## Investments, not checking accounts
The widget uses Pluggy's GET /investments?itemId=... endpoint, adds together
the net current "balance" of ACTIVE BRL investments (and positions with missing
status), and ignores pending/fully withdrawn positions and non-BRL positions.
It **does not** read bank checking, credit card, or account balances. If the
C6 connection lacks investment permissions or coverage, the widget displays
"R$ —" and an informative message, not a fabricated zero. The displayed
"Investimento atual" includes ALL active investments in the configured item,
not only assets reserved for rhinoplasty. Confirm the C6 connector consent
grants investments access.

## Netlify environment variables
- COUNTDOWN_VIEW_KEY: private random text at least 20 characters
- RHINO_DATE: your surgery date in YYYY-MM-DD
- RHINO_GOAL_BRL: goal in BRL, e.g. 15000
- PLUGGY_CLIENT_ID: Pluggy app Client ID
- PLUGGY_CLIENT_SECRET: Pluggy app Client Secret
- PLUGGY_ITEM_ID: C6's Pluggy Item ID with investments permissions

PLUGGY_ACCOUNT_ID is no longer used; this widget now reads investment
positions directly from the Pluggy item.

Add variables in Netlify for Functions, then redeploy.

## Embed in private Notion
Embed https://johnvitor.com/countdown/#key=YOUR_COUNTDOWN_VIEW_KEY
(replace placeholder with your actual key, URL encoded if necessary).
The URL fragment is handled in the browser; the key is sent only as an
Authorization header when fetching the Netlify Function. Anyone with the full
embed URL can access your financial values: keep the Notion page private.

Frontend updates countdown daily and reloads invested assets every 30 minutes
while open. Pluggy bank data itself may refresh only periodically.

Tests: node --test tests/countdown-function.test.cjs

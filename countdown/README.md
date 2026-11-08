# Contagem regressiva · Rinoplastia

Public URL: https://johnvitor.com/countdown

This static HTML page fetches a private serverless Netlify Function at
/.netlify/functions/countdown. The C6 Bank balance is read from the free
personal-use Meu Pluggy integration. No banking credentials are sent to the
browser. The widget requires a private access key to see any goal/date or
financial data. You can use a private URL fragment for automatic Notion embeds; the access key
is read in the browser and is not sent with the page URL to the server. The
widget forwards it only in the Authorization request header to the Netlify
Function. Manual unlock remains available and only uses tab sessionStorage.

## Netlify environment variables (site settings; Functions scope)

Required:
- COUNTDOWN_VIEW_KEY: a randomly generated private string of at least 20 characters. This is the private unlock key in the widget.
- RHINO_DATE: scheduled surgery date in YYYY-MM-DD format (use your real date).
- RHINO_GOAL_BRL: cost/target in BRL using a dot for decimals.
- PLUGGY_CLIENT_ID: the Client ID of your Meu Pluggy personal-use application.
- PLUGGY_CLIENT_SECRET: its Client Secret (store server side ONLY).
- PLUGGY_ITEM_ID: the item ID corresponding to your C6 connection through MeuPluggy.

Optional:
- PLUGGY_ACCOUNT_ID: required if the C6 item returns multiple BRL bank
  accounts; use the exact account ID whose balance should count toward the
  goal. Credit card balances are never counted.

To configure Pluggy:
1. Connect C6 Bank at https://meu.pluggy.ai/.
2. In https://dashboard.pluggy.ai/, use the **MeuPluggy** connector
   in Applications > Demo > Connect Account. Do not choose C6 directly in
   the dashboard: choose MeuPluggy and authorize access to your Meu Pluggy.
3. Copy the specific C6 item ID from Connected Items, plus Client ID and
   Client Secret from the application details.
4. Add all required environment variables to the **Netlify site settings**,
   with Functions access, and redeploy the site.
5. To view manually, open the countdown and unlock it with COUNTDOWN_VIEW_KEY.
6. To embed in a private Notion page **without repeated unlocks**, use /embed
   with this URL (replace the placeholder with your private key, URL encoded):
   https://johnvitor.com/countdown/#key=YOUR_COUNTDOWN_VIEW_KEY
   Example: for a hex-generated key, paste the hex string as-is after #key=.
7. After setting Netlify variables redeploy. The widget will fetch the balance
   on page load and retry every 30 minutes while open.

Meu Pluggy personal-use balance typically syncs every ~24h, not instantly.
Your Pluggy personal-use authorization expires after one year; you may also
need to renew the bank's Open Finance consent separately.

Security notes: never put the Client Secret in GitHub or browser code, and
do not use the key-bearing embed URL in a publicly shared Notion page, or
anywhere others can read the Notion embed link. The fragment isn't sent to
Netlify in the initial page request but is still stored by Notion and visible
to anyone who can view/edit the embed or inspect its browser frame. This is a private personal widget, not a multi-user login system.
The bank's *available balance* is treated as money saved toward this goal,
which may not be the same as funds actually earmarked for surgery.

Tests:
  node --test tests/countdown-function.test.cjs

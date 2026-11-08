# Contagem regressiva · Rinoplastia

Public URL: https://johnvitor.com/countdown

This static HTML page fetches a private serverless Netlify Function at
/.netlify/functions/countdown. The C6 Bank balance is read from the free
personal-use Meu Pluggy integration. No banking credentials are sent to the
browser. The widget requires a private access key to see any goal/date or
financial data. The access key is kept only in tab sessionStorage so Notion
embeds can re-load within the same browser tab.

## Netlify environment variables (site settings; Functions scope)

Required:
- COUNTDOWN_VIEW_KEY: a randomly generated private string of at least 20 characters. This is the private unlock key in the widget.
- RHINO_DATE: scheduled surgery date in YYYY-MM-DD format (e.g. 2027-02-10).
- RHINO_GOAL_BRL: cost/target in BRL with dot as decimal separator (e.g. 12000 or 12000.50).
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
5. Open the countdown and unlock it with COUNTDOWN_VIEW_KEY.
6. In Notion Free use /embed with https://johnvitor.com/countdown.

Meu Pluggy personal-use balance typically syncs every ~24h, not instantly.
Your Pluggy personal-use authorization expires after one year; you may also
need to renew the bank's Open Finance consent separately.

Security notes: never put the Client Secret in GitHub or browser code, and
never put COUNTDOWN_VIEW_KEY in a Notion embed URL or on a publicly shared
Notion page. This is a private personal widget, not a multi-user login system.
The bank's *available balance* is treated as money saved toward this goal,
which may not be the same as funds actually earmarked for surgery.

Tests:
  node --test tests/countdown-function.test.cjs

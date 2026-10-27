# iMenu environment panel

Open https://johnvitor.com/merge and use the **iMenu environments** section at the bottom. This has a separate server-verified password. The existing merge-page password does not authorize environment access.

## Netlify setup

Set these private variables in the johnvitor Netlify site's environment settings, available to Functions:

- `IMENU_ENV_PASSWORD`: choose a unique, randomly generated password of at least 32 characters. Type this into the panel. Do not reuse the existing merge password.
- `IMENU_VPS_PASSWORD`: the existing VPS operations MCP password, for username `imenu_deploy`. An authorized VPS administrator can obtain it from `/opt/imenu-migration/ops/deploy-mcp/auth-password`. Do not put it into browser code or GitHub.

Redeploy the Netlify site after setting the variables. Until configured, the API fails closed. Neither credential is returned by the API, stored in browser storage, or logged by this function.

## Operations

Scopes: staging runtime, staging build, production runtime, production build. Keys load only after successful password verification. Existing values are never fetched. Add/replace and delete require explicit confirmation. Lock clears the password and displayed keys.

The VPS handler uses file locking, atomic replacement, mode 0600 and private backups in `/opt/imenu-migration/secrets/.env-panel-backups`. Values are single quoted to prevent shell expansion when build env files are sourced. Newline, NUL, carriage return and apostrophe values are rejected because these files are shared by Bash and Compose. Empty values are supported by the API.

Edits affect the selected file only. Runtime and build files are separate. Changes apply on the next deployment; the panel does not deploy or restart applications. Deleting required keys can prevent the next deployment.

The `manage_environment` handler is installed on the VPS alongside the existing operations MCP. Its source is preserved in `merge/vps-env-handler.py`. No actual application variables were modified while implementing or testing this feature.

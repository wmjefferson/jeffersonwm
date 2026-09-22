# DNS Standardization Plan

Use this as the baseline when standardizing JeffersonWM domains in Cloudflare and Network Solutions.

## Goal

Make the public sites work on the broadest range of networks while keeping publishing, mail, cPanel, and direct-origin tools from accidentally going through the Cloudflare web proxy.

## Domains In Scope

- `jeffersonwm.com`
- `wmjefferson.com`
- `dookydetective.com`
- `jeffershizzle.com`

## Standard Pattern

### Registrar

- Nameservers should point to Cloudflare only.
- For the current Cloudflare account, confirmed nameservers are:
  - `magnolia.ns.cloudflare.com`
  - `ray.ns.cloudflare.com`
- Do not leave registrar-side DNS active unless the registrar is intentionally authoritative.

### Cloudflare Zone

- Keep apex and `www` web records proxied.
- Use Cloudflare proxy only for browser-facing HTTP/HTTPS sites.
- Keep service/origin records DNS-only.
- Do not add apex `NS` records inside Cloudflare unless delegating a real subzone.

### Public Web Records

- Apex `@`: proxied web target.
- `www`: proxied web target.
- Prefer keeping both apex and `www` working instead of forcing all traffic to one host.
- Avoid forced `www` redirects for `wmjefferson.com`; some public networks may handle one hostname better than the other.

### Origin / Publishing Records

- Add `origin.<domain>` when direct server access is useful.
- `origin.<domain>` should be `A 143.95.39.115`, DNS-only.
- Publish scripts should use an origin/DNS-only host, not a proxied public hostname.

### FTP / cPanel / Mail Records

- `ftp.<domain>` should be DNS-only.
- `mail.<domain>` should be DNS-only.
- `cpanel.<domain>`, `webmail.<domain>`, `webdisk.<domain>`, and `whm.<domain>` should be DNS-only if used.
- If any of these are currently CNAMEs to a proxied apex, replace them with direct DNS-only origin records when possible.

### Mail Records

- Domains with active mail should have:
  - DNS-only `mail.<domain>` target.
  - `MX @ -> mail.<domain>` or provider-issued MX target.
  - SPF TXT.
  - DKIM TXT when provided by the mail host.
  - DMARC TXT when ready.
- Domains without mail can omit MX/TXT mail records.

### App / API Records

- Cloudflare Tunnel app records should remain proxied.
- Standard app naming under `jeffersonwm.com`:
  - `auth.jeffersonwm.com`
  - `api-<site>.jeffersonwm.com`
  - `<site>.jeffersonwm.com` when an app has its own frontend tunnel.
- Standalone domains may use `api.<domain>` if they are not part of the shared `jeffersonwm.com` app family.

## Current Audit Notes

### `jeffersonwm.com`

- Registrar and public DNS are clean: Cloudflare nameservers only.
- Cloudflare apex `NS` records for Network Solutions were removed.
- `origin.jeffersonwm.com` exists and is DNS-only.
- `mail.jeffersonwm.com` exists and is DNS-only.
- Public apex and `www` resolve through Cloudflare.

### `wmjefferson.com`

- Registrar and public DNS are clean: Cloudflare nameservers only.
- Cloudflare apex `NS` records for A Small Orange were removed.
- Public apex and `www` resolve through Cloudflare.
- `origin.wmjefferson.com` is not currently present.
- `ftp`, `mail`, `cpanel`, and `webmail` currently resolve through Cloudflare-proxied records and should be reviewed.

### `dookydetective.com`

- Registrar and public DNS are clean: Cloudflare nameservers only.
- Public apex and `www` resolve through Cloudflare.
- No `origin`, `ftp`, `mail`, `cpanel`, or `webmail` records were visible in the public audit.

### `jeffershizzle.com`

- Registrar and public DNS are clean: Cloudflare nameservers only.
- Public apex and `www` resolve through Cloudflare.
- `ftp`, `mail`, `cpanel`, and `webmail` currently resolve through Cloudflare-proxied records and should be reviewed.
- No `origin.jeffershizzle.com` record was visible in the public audit.

## Recommended Order

1. Keep the completed nameserver cleanup.
2. Add missing `origin.<domain>` records as DNS-only where publishing or direct server access is needed.
3. Convert FTP/cPanel/mail service hostnames to DNS-only.
4. Leave public apex and `www` proxied.
5. Retest public network access after DNS has had time to settle.
6. Only after Monday testing, decide whether to add alternate aliases or mirrored landing pages.

## Safe First Manual Changes

For `wmjefferson.com`:

- Add `origin.wmjefferson.com` as `A 143.95.39.115`, DNS-only.
- Change or recreate `ftp.wmjefferson.com` as `A 143.95.39.115`, DNS-only if FTP is needed.
- Change `mail.wmjefferson.com`, `cpanel.wmjefferson.com`, and `webmail.wmjefferson.com` to DNS-only if those services are used.

For `jeffershizzle.com`:

- Add `origin.jeffershizzle.com` as `A 143.95.39.115`, DNS-only.
- Change or recreate `ftp.jeffershizzle.com` as `A 143.95.39.115`, DNS-only if FTP is needed.
- Change `mail.jeffershizzle.com`, `cpanel.jeffershizzle.com`, and `webmail.jeffershizzle.com` to DNS-only if those services are used.

## Verification Commands

```powershell
Resolve-DnsName jeffersonwm.com -Type NS -Server 1.1.1.1
Resolve-DnsName wmjefferson.com -Type NS -Server 1.1.1.1
Resolve-DnsName origin.wmjefferson.com -Server 1.1.1.1
Resolve-DnsName ftp.wmjefferson.com -Server 1.1.1.1
Resolve-DnsName mail.wmjefferson.com -Server 1.1.1.1
Resolve-DnsName origin.jeffershizzle.com -Server 1.1.1.1
Resolve-DnsName ftp.jeffershizzle.com -Server 1.1.1.1
Resolve-DnsName mail.jeffershizzle.com -Server 1.1.1.1
```

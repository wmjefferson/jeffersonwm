# Public Network Access Checklist

Use this when `jeffersonwm.com` or `wmjefferson.com` fails on school, library, hotel, work, or other filtered public networks while other project domains still work.

## Current Goal

Keep both personal/experimental and professional sites reachable from as many normal networks as possible.

Primary domains:

- `https://jeffersonwm.com`
- `https://www.jeffersonwm.com`
- `https://wmjefferson.com`
- `https://www.wmjefferson.com`

Known alternate project domains:

- `https://dookydetective.com`
- `https://jeffershizzle.com`

## Repo-Side Changes Already Made

- `wmjefferson/public/.htaccess` no longer forces the apex domain to `www.wmjefferson.com`.
- It now only forces HTTPS while preserving whichever hostname resolved successfully.
- Reason: if a restrictive network resolves `wmjefferson.com` but blocks or mishandles `www.wmjefferson.com`, the site should no longer redirect into the failing hostname.

## DNS / Cloudflare Changes To Check

For both `jeffersonwm.com` and `wmjefferson.com`:

1. Confirm apex and `www` exist.
   - `@` should resolve.
   - `www` should resolve.

2. Confirm both are proxied through Cloudflare unless there is a specific reason not to.
   - Orange cloud is usually preferred for public web traffic.
   - Keep FTP/origin hostnames DNS-only, not the public site hostnames.

3. Confirm DNSSEC is either correctly enabled end-to-end or disabled.
   - A broken DS record at the registrar can produce resolver-specific failures.
   - This is one of the most common reasons a domain works on some networks and fails on others.

4. Confirm Cloudflare nameservers match the registrar exactly.
   - Mismatched stale nameservers can cause some resolvers to see old/dead records.

5. Add broad-access aliases if desired.
   - `home.jeffersonwm.com` -> same target as `jeffersonwm.com`
   - `professional.wmjefferson.com` -> same target as `wmjefferson.com`
   - Optional mirrored landing on a domain that already works well, such as `jeffershizzle.com/william-jefferson/`.

6. Avoid security rules that challenge or block whole networks before the page loads.
   - DNS `NXDOMAIN` is usually resolver/filtering, not a web-app rule.
   - But if the browser says blocked, forbidden, or connection reset, then Cloudflare WAF/security settings may be involved.

## Monday Test Matrix

On the affected public network, test these exact URLs:

- `https://jeffersonwm.com`
- `https://www.jeffersonwm.com`
- `https://wmjefferson.com`
- `https://www.wmjefferson.com`
- `https://dookydetective.com`
- `https://jeffershizzle.com`

For each failure, note:

- Browser error text exactly.
- Whether it says `NXDOMAIN`, `DNS_PROBE_FINISHED_NXDOMAIN`, timeout, certificate error, blocked, forbidden, or Cloudflare challenge.
- Whether VPN makes it work immediately.
- Whether mobile hotspot works.
- Whether changing DNS to Cloudflare `1.1.1.1` or Google `8.8.8.8` changes the result.

## How To Interpret Results

- If VPN fixes it: the public network DNS/filter is blocking or misclassifying the domain.
- If only `www` fails: keep apex available and avoid forced `www` redirects.
- If only apex fails: redirecting to `www` may help, but only after confirming `www` works on the affected network.
- If both apex and `www` fail but `dookydetective.com` and `jeffershizzle.com` work: consider adding a mirrored professional landing page on one of the working domains.
- If public DNS like `1.1.1.1` and `8.8.8.8` works but network DNS fails: this is network filtering or DNS reputation, not the site code.

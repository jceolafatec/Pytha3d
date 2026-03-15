# GitHub Pages Redirect Loop Troubleshooting

This site is configured to use a custom domain through [CNAME](CNAME):

```text
jceola.com
```

If `jceolafatec.github.io` shows `ERR_TOO_MANY_REDIRECTS`, the problem is usually outside the frontend code. GitHub Pages is trying to hand traffic over to the custom domain, but the domain itself is not resolving cleanly back to GitHub Pages.

## What To Check First

1. In GitHub repository Settings -> Pages:
   - Confirm the site is publishing from the correct branch/folder.
   - Confirm the custom domain is set to `jceola.com`.
   - Confirm there is no DNS warning or HTTPS certificate warning.

2. In the DNS provider for `jceola.com`:
   - Remove any registrar-level URL forwarding rules for `jceola.com`.
   - For the apex/root domain, point to GitHub Pages with these A records:

```text
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```

3. If `www.jceola.com` is also used, point it to the GitHub Pages host with a CNAME:

```text
www -> jceolafatec.github.io
```

## Typical Failure Pattern

```text
jceolafatec.github.io
-> GitHub Pages redirects to jceola.com
-> jceola.com is forwarded or mis-resolved
-> browser is sent back into another redirect
-> ERR_TOO_MANY_REDIRECTS
```

## Workspace Diagnostic

Use the local checker from the website root:

```powershell
python .\tools\check_pages_domain.py --github-host jceolafatec.github.io
```

The script reads [CNAME](CNAME), checks basic DNS resolution, and prints the redirect chain for both the custom domain and the GitHub Pages host.

## Expected Healthy Result

1. `https://jceola.com` loads directly.
2. `https://jceolafatec.github.io` redirects once to `https://jceola.com`.
3. GitHub Pages shows no domain or certificate warnings.

## Repo Notes

- Keep [CNAME](CNAME) if `jceola.com` remains the primary site.
- Do not remove `CNAME` unless you intend to serve the site directly from `jceolafatec.github.io`.
- Hardcoded metadata in [index.html](index.html), [project-detail.html](project-detail.html), [viewer.html](viewer.html), [robots.txt](robots.txt), and [sitemap.xml](sitemap.xml) assumes `jceola.com` is the canonical domain.
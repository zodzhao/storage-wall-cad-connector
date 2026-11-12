# Publish the source and host the static app

This repository is prepared for a **public** GitHub repository and a static Caddy site at `connector.mutsumimi.com`. Replace the shell variables below with your actual VPS SSH user and IP/hostname. Work from your Mac's copy of this folder (`~/Projects/storage-wall-cad-connector`); no credentials should be committed or sent in chat.

## 1. Review and publish the source

The app code is MIT-licensed (`LICENSE`). The vendored HSW source, geometry libraries and self-hosted IBM font retain their own license notices in `vendor/` and `public/`. `references/insert+M5.stl` is a user-supplied local reference and **must not be published**; `.gitignore` excludes it. `dist/`, `node_modules/` and `design-previews/` are also ignored.

```sh
cd ~/Projects/storage-wall-cad-connector
npm ci
npm test
npm run build
# Optional first-time browser setup:
npx playwright install chromium
npm run test:browser

git status --short
git check-ignore references/insert+M5.stl
git add -A
git diff --cached --check
git diff --cached --name-only   # review: no private STL, secrets, or dist/
git commit -m "Open-source connector workspace"
```

If needed, install GitHub CLI (`brew install gh`) and sign in on your Mac with `gh auth login`. From the project folder, publish to your account (change the repository name if desired):

```sh
gh repo create storage-wall-cad-connector --public --source=. --remote=origin --push
```

Verify the new repository is public and inspect its file list online before sharing it. If the repository name already exists, create an empty public repo on GitHub and add its URL as `origin`, then `git push -u origin main`. Do not paste credentials into Git remote URLs.

## 2. Build locally and transfer only `dist/`

This is a browser-only static app. **Do not run Vite or Node on the VPS** for production, and do not put the Git checkout, reference STL, or secrets under the web root.

```sh
cd ~/Projects/storage-wall-cad-connector
npm ci
npm run build
VPS_USER=your-ssh-user
VPS_HOST=your-vps-ip-or-hostname
ssh "$VPS_USER@$VPS_HOST" 'mkdir -p ~/connector-dist'
rsync -av --delete dist/ "$VPS_USER@$VPS_HOST:~/connector-dist/"
ssh "$VPS_USER@$VPS_HOST" 'sudo mkdir -p /var/www/connector.mutsumimi.com && sudo rsync -a --delete ~/connector-dist/ /var/www/connector.mutsumimi.com/ && sudo chmod -R a+rX /var/www/connector.mutsumimi.com'
```

The server needs `rsync`, Caddy, and SSH access. If the SSH user cannot use `sudo`, arrange a writable web root with your VPS administrator instead. `--delete` is limited to the dedicated connector directories above; do not point it at another site's root.

## 3. Add a Caddy site block without replacing existing sites

On the VPS, inspect `/etc/caddy/Caddyfile` first. Append this **new** block; keep the existing `mutsumimi.com` and other sites unchanged:

```caddyfile
connector.mutsumimi.com {
    root * /var/www/connector.mutsumimi.com
    encode zstd gzip
    file_server
}
```

Then validate and reload:

```sh
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo systemctl status caddy --no-pager
```

Your existing web service likely already uses TCP 80/443. If not, permit those ports in the VPS firewall/provider rules **without changing the working SSH access**.

## 4. Add only the subdomain DNS record

In Cloudflare DNS for `mutsumimi.com`, create an **A** record named `connector` pointing to the VPS public IPv4. Use **DNS only** while checking Caddy HTTPS. If an `AAAA` record for `connector` exists, ensure it points to a working IPv6 listener or remove that subdomain-only record. Do not alter the apex website records or iCloud+ MX/SPF/DKIM/verification records.

After DNS and HTTPS are ready, test from your Mac:

```sh
curl -fsSI https://connector.mutsumimi.com/
curl -fsS https://connector.mutsumimi.com/ | grep -F '/assets/'
```

Open the site in a browser, upload a small STL, select a face, fuse, and verify download. Confirm that font files, the geometry worker, and WASM assets load without 404 errors. A successful Caddy config check alone does not prove the site or certificate works.

## Updates

Repeat `npm ci`, `npm test`, `npm run build`, and the `rsync` transfer after source changes. If you use GitHub on the Mac, commit and push reviewed changes separately. Static file changes do not require a Caddy reload unless the Caddyfile changes.

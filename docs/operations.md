# Operations

Production runs on the Render free tier, with the all-time count in Upstash Redis.

## One-time setup

### Upstash

1. Create a Redis database.
2. Keep eviction off, so the count is never dropped.
3. Copy the `rediss://` URL. Treat it as a secret.

### Render

1. Create a web service from this GitHub repository, branch `main`.
2. Select the Docker runtime and the Free instance type.
3. Turn Auto-Deploy off. Deploys come only from `deploy.yml`.
4. Set the health check path to `/healthz`.
5. Set the environment variable `Counting__Redis` to the Upstash URL.
6. Copy the service's deploy hook URL. Treat it as a secret: anyone with it can deploy.

### GitHub

Run these from your own terminal, so the secret is never pasted anywhere else:

```bash
gh secret set RENDER_DEPLOY_HOOK_URL                               # paste the deploy hook URL when asked
gh variable set PRODUCTION_URL --body https://cheddar-zlf1.onrender.com   # no trailing slash
```

## Release

1. Merge the changes to `main`.
2. Push a SemVer tag on a `main` commit:

   ```bash
   git tag v1.0.2 && git push origin v1.0.2
   ```

`release.yml` runs CI on the tag, checks that the tag is on `main`, and creates a GitHub Release with generated notes. Nothing deploys yet.

## Deploy

```bash
gh workflow run deploy.yml -f tag=v1.0.2
gh run watch
```

`deploy.yml` does these steps:

1. Checks that the tag has a GitHub Release and is on `main`.
2. Calls the Render deploy hook for the tag's commit.
3. Waits up to 15 minutes until `/healthz` reports that commit.
4. Fails unless `/healthz` reports `"counter": "redis"`, the count API returns a number, and `/` returns 200.

Only one deploy runs at a time. To roll back, deploy an earlier tag.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| The all-time count shows 0 or `–` on every reload, and `/api/counts/global` returns 500 after about 5 seconds. | The app cannot reach Redis. | Check `Counting__Redis` on Render. Upstash needs TLS: the app forces TLS for `*.upstash.io`, but other hosts need a `rediss://` URL. |
| `/healthz` reports `"counter": "file"`. | `Counting__Redis` is not set or is misnamed. The container cannot keep the file. | Set `Counting__Redis` on Render with two underscores, then deploy again. |
| The first load after a quiet period takes up to a minute. | The Render free tier stops the service after 15 minutes with no traffic. | Expected on the free tier. |
| The count suddenly fails after a long quiet period. | Upstash archived the database after 30 or more days with no traffic. Restoring it creates a new URL. | Restore the database and update `Counting__Redis` on Render. |
| The deploy times out waiting for the commit. | The Render build failed, or the deploy hook is wrong. | Read the deploy log in the Render dashboard. |
| Render logs a DataProtection key warning at startup. | The container has no persistent key store. | Harmless. The keys only protect forms, and the page has none. A restart makes new keys. |

# Cheddar

A one-page clicker starring Cheddar, my fat male cat. Click him and he sniffs.

## Assets

All assets live in `public/`:

- `cat_normal.JPG`: Cheddar at rest.
- `cat_sniff.JPG`: Cheddar mid-sniff. Use this as the reference for the sniff pose.
- `Augustine St.m4a`: the meow sound.

## Behavior

1. **Press.** Cheddar's head reaches toward the viewer, from the normal pose into the sniff pose, with a slight springy overshoot. The meow plays at the same moment, with no silence before it. Only the head moves. The body, paws, and background must not change, and no part of the normal-pose head (such as an ear) may show in the sniff pose. This is critical.
2. **Hold.** While the press is held, Cheddar stays frozen in the sniff pose. The counters do not change.
3. **Release.** The head settles back to the normal pose and both counters go up by one. A quick click is a short hold, so it shows the full sniff. Releasing away from Cheddar, or a touch that turns into a scroll, cancels without counting.

## Counters

- **Session count.** Counts this visitor's clicks. Survives reloading the page and closing the tab. Resets when the browser quits.
- **All-time count.** One shared total of every click from every visitor since launch. Never resets.

## Scope for v1

A single working web page served by a local dev server.

## Done when

- The dev server starts. Show the real command output.
- A screenshot shows Cheddar at rest and mid-sniff, with only the head different.

## Tech stack

- .NET 10 with ASP.NET Core. The backend serves the page and stores the shared all-time count.
- Start the dev server with `dotnet run` (or `dotnet watch` for hot reload).
- Front end: Blazor. 
- Architecture: modular monolith

## Run locally

```bash
dotnet run --project src/Cheddar.Host
```

The all-time count is stored in `src/Cheddar.Host/App_Data/global-count.json`. To use Redis instead, as production does:

```bash
docker run -d --rm -p 6379:6379 --name cheddar-redis redis:7-alpine
Counting__Redis=localhost:6379 dotnet run --project src/Cheddar.Host
```

`Counting__Redis` accepts an Upstash URL (`rediss://default:PASSWORD@HOST:PORT`) or a StackExchange.Redis connection string. `GET /healthz` reports which store is active.

## Release and deploy

Releases are SemVer tags `vX.Y.Z` on `main`. CI runs the build, the tests and the browser driver on every pull request.

1. Push a tag: `git tag v1.0.0 && git push origin v1.0.0`. CI runs again, then a GitHub Release is created.
2. Deploy that exact commit to Render: `gh workflow run deploy.yml -f tag=v1.0.0`. The workflow waits until `/healthz` reports the tag's commit, then smoke-tests the site.

Nothing deploys until you run step 2.

### One-time setup

- Render: create a web service from this GitHub repo, branch `main`, with the Docker runtime and the Free instance type. Turn Auto-Deploy off and set the health check path to `/healthz`. Set the env var `Counting__Redis` to your Upstash URL. Copy the service's deploy hook URL. Treat it as a secret: anyone with it can deploy.
- Upstash: keep eviction off, so the count is never dropped. Upstash archives a free database after 30 or more days with no traffic. Restoring creates a new database with a new URL, so update `Counting__Redis` on Render.
- GitHub: add the secret `RENDER_DEPLOY_HOOK_URL` (the deploy hook URL) and the variable `PRODUCTION_URL` (for example `https://cheddar.onrender.com`, no trailing slash).

The deploy fails unless `/healthz` reports `"counter": "redis"`. That catches a missing or misnamed `Counting__Redis`, which would otherwise fall back to a file the container cannot write.

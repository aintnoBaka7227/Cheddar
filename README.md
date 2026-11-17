# Cheddar

A one-page clicker starring Cheddar, my fat male cat. Press him and he sniffs toward you and meows. Every press counts toward your session total and toward one all-time total shared by every visitor.

**Live:** https://cheddar-zlf1.onrender.com

## How it works

```text
Browser                                Server (one ASP.NET Core process)
┌──────────────────────────┐           ┌─────────────────────────────────────┐
│ Blazor WebAssembly page  │           │ Cheddar.Host                        │
│  └─ cheddar.js           │  /api/... │  ├─ serves the page and /assets     │
│     press, sniff, meow,  │ ────────▶ │  ├─ /healthz                        │
│     session cookie       │           │  └─ Counting module                 │
└──────────────────────────┘           │      IGlobalCounter                 │
                                       │      ├─ Redis   (production)        │
                                       │      └─ JSON file (local default)   │
                                       └─────────────────────────────────────┘
```

- Blazor renders the page shell. The JavaScript module `cheddar.js` owns the interaction: the press, hold and release state, the sniff animation, the meow, and the session cookie.
- The Counting module stores the all-time count. With `Counting__Redis` set it uses Redis `INCR`. Without it, it writes a JSON file.
- The rules for the sniff and the counters are in [docs/spec.md](docs/spec.md). Read them before you change the page.

## Run locally

Requires the .NET 10 SDK.

```bash
dotnet run --project src/Cheddar.Host
```

Open http://localhost:5080. The all-time count is stored in `src/Cheddar.Host/App_Data/global-count.json`.

To use Redis, as production does:

```bash
docker run -d --rm -p 6379:6379 --name cheddar-redis redis:7-alpine
Counting__Redis=localhost:6379 dotnet run --project src/Cheddar.Host
```

## Test

```bash
dotnet test
```

This runs the Counting module tests against the file store and a real Redis. The Redis tests start a container with Testcontainers, so Docker must be running.

To check the page itself, start the app and run the browser driver. It needs Node and Google Chrome:

```bash
node .claude/skills/verify/scripts/drive.mjs --url http://localhost:5080/ --out .verify-evidence
```

The driver presses the cat in headless Chrome, checks the sniff, the meow and both counters, and prints one `PASS` or `FAIL` line per check. Screenshots go to `.verify-evidence/`. The checks are described in [.claude/skills/verify/](.claude/skills/verify/SKILL.md).

CI runs the build, `dotnet test`, the browser driver and a Docker build on every pull request.

## Configuration

| Environment variable | Default | Purpose |
|---|---|---|
| `Counting__Redis` | not set | Redis for the all-time count. Accepts `rediss://default:PASSWORD@HOST:PORT` or a StackExchange.Redis connection string such as `localhost:6379`. When not set, the file store is used. |
| `Counting__FilePath` | `App_Data/global-count.json` | The file store's path, relative to the host's content root. |
| `Assets__Path` | `../../public` (`/app/public` in Docker) | The folder with the photos and the meow, served at `/assets`. |
| `PORT` | `8080` | The port the Docker image listens on. Render sets it. |

`GET /healthz` returns the running commit and `"counter": "redis"` or `"file"`. It does not call Redis.

## Release and deploy

Releases are SemVer tags `vX.Y.Z` on `main`. Deploys are manual.

```bash
git tag v1.0.2 && git push origin v1.0.2        # CI runs, then a GitHub Release is created
gh workflow run deploy.yml -f tag=v1.0.2         # deploys that commit to Render and smoke-tests it
```

Setup, the deploy checks and troubleshooting are in [docs/operations.md](docs/operations.md).

## Project layout

```text
public/                          photos and the meow
src/Cheddar.Host/                ASP.NET Core host: endpoints, static files
src/Cheddar.Host.Client/         Blazor WebAssembly page, CSS, cheddar.js, head mask
src/Modules/Counting/            all-time count: file and Redis stores, API
tests/Cheddar.Counting.Tests/    Counting module tests
.claude/skills/verify/           browser driver and what each check proves
.github/workflows/               ci.yml, release.yml, deploy.yml
docs/                            spec and operations
```

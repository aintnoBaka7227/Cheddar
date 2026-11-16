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
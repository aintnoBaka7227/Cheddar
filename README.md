# Cheddar

A one-page clicker starring Cheddar, my fat male cat. Click him and he sniffs.

## Assets

All assets live in `public/`:

- `cat_normal.JPG`: Cheddar at rest.
- `cat_sniff.JPG`: Cheddar mid-sniff. Use this as the reference for the sniff pose.
- `Augustine St.m4a`: the meow sound.

## Behavior

On each click, three things happen at the same moment:

1. **Sniff.** Cheddar's head moves from the normal pose to the sniff pose and back, very quickly. Only the head moves. The body, paws, and background must not change. This is critical.
2. **Meow.** The meow sound plays.
3. **Count.** Both counters go up by one.

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
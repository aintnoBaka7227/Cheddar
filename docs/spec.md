# Cheddar behavior spec

This is the contract for the page. The browser driver in `.claude/skills/verify/` checks each rule. Change this file in the same pull request as any change to the behavior.

## Assets

All assets are in `public/`:

- `cat_normal.JPG`: Cheddar at rest.
- `cat_sniff.JPG`: Cheddar mid-sniff. This is the reference for the sniff pose.
- `Augustine St.m4a`: the meow.

## Press, hold and release

1. **Press.** Cheddar's head reaches toward the viewer, from the normal pose into the sniff pose, with a slight springy overshoot. The meow plays at the same moment, with no silence before it.
2. **Hold.** While the press is held, Cheddar stays in the sniff pose. The counters do not change.
3. **Release.** The head settles back to the normal pose and both counters go up by one. A quick click is a short hold, so it shows the full sniff.

A press does not count when:

- the pointer is released away from Cheddar,
- a touch turns into a scroll, or the browser cancels the pointer,
- the page loses focus during a key press.

Enter and Space work like a press: key down presses, key up releases. A held key does not repeat.

## Only the head moves

- The body, paws and background must not change.
- No part of the normal-pose head, such as an ear, may show in the sniff pose.

This is critical. The sniff head is cut from `cat_sniff.JPG` by the mask `src/Cheddar.Host.Client/wwwroot/img/sniff-head-mask.svg`.

## Counters

- **Session count.** Counts this visitor's clicks. It survives a reload and closing the tab. It resets when the browser quits, because it is a browser-session cookie.
- **All-time count.** One shared total of every click from every visitor since launch. It never resets.

The all-time count shows `–` until the server returns it. If an increment fails, the page fetches the count again.

## Touch

Holding the cat must not select the heading text or open the iPhone callout menu.

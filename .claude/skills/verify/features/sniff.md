# Hold-to-sniff

Pressing Cheddar makes the head from `cat_sniff.JPG`, cut out along its outline by `src/Cheddar.Host.Client/wwwroot/img/sniff-head-mask.svg`, grow from resting-head size (scale 0.6) to the peak (scale 1.05) over 190ms with a springy overshoot. It holds at the peak while the press lasts. Release settles it back over 160ms and counts the click.

## Sub-features

- Mouse or touch press: the sniff starts on pointerdown. Release over the cat counts; release elsewhere, pointercancel (a touch that scrolls) or lost capture cancels without counting.
- Enter or Space: keydown presses, keyup completes. Auto-repeat is ignored. Blur while held cancels.
- A bare click event (detail 0, assistive tech) runs a full sniff and counts once.
- A quick tap still plays the full reach, a 70ms minimum hold, and the settle. Only the newest press may settle the head, so taps in quick succession never cut each other's reach.
- A mouse press ends a key press whose keyup never arrived, without counting it.

## How to get to it (user POV)

Open http://localhost:5080/ and press and hold the cat, then let go.

## Driving it with drive.mjs

The driver presses the mouse and holds it for 600ms. It checks that the head is fully shown with nothing animating, that no count changed, and that the normal photo has no animation or transform. It screenshots the held frame, then renders a matte (head image as white, everything else black) to find the cut-out. Pixels that changed by more than 2 levels outside the cut-out must be 0. Points from tip to base of both normal-pose ears must be fully covered. The cut-out must end above 65% of the frame height so the paws never change. The head region must match `reference/held-sniff-frame.png`. Then it checks release counts once and settles, a quick tap shows the sniff, and release away from the cat counts nothing. A per-frame recorder (opacity and scale of the head on every animation frame) proves the reach passes through in-between sizes before the peak, and that 8 taps at about 4 per second never pop the head in at full size. A cancelled touch, blur during a held Enter, and a keyup that never came are each checked to count nothing and not block the next click.

## Gotchas

- The ear points are in the normal photo's 1200x1600 pixel space. They sample up to the left ear tip, because a smaller peak covers the middle of the ear but not its tip.
- Changing the mask, the scales, or the photo needs a new reference. Approve `held-sniff.png` by eye, then rerun with `--update-reference`.
- Images in the button need `inset: 0`. Without it they sit at their static position and the frame shows a cropped corner. The frame-fit check catches this.

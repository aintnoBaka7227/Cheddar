# Head-only sniff

Clicking Cheddar shows the head from `cat_sniff.JPG` inside a soft oval over the normal photo for 220ms. Nothing outside the head may change.

## Sub-features

- Pointer press (left button) starts the sniff.
- Enter or Space on the focused button starts the sniff, with no repeat while the key is held.
- Rapid clicks restart the animation each time.

## How to get to it (user POV)

Open http://localhost:5080/ and click the cat.

## Driving it with drive.mjs

The driver presses the mouse at the button center, pauses all animations at 100ms, and screenshots. It compares the at-rest and mid-sniff frames inside the button. Pixels outside the oval (rx 32%, ry 26% at 52.5%, 27% of the button, same as the CSS mask) must not change at all. More than 80% of pixels inside it must change. It also checks that `img.base` is loaded and exactly fills the button.

## Gotchas

- The oval in the driver mirrors the CSS mask in `src/Cheddar.Host.Client/Pages/Home.razor.css`. Change both together.
- Images in the button need `inset: 0`. Without it they sit at their static position and the frame shows a cropped corner. The frame-fit check catches this.

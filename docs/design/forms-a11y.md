# Form accessibility (Step 20)

- Visible labels; placeholders do not replace labels.
- Required fields include a visible asterisk and screen-reader text “required”.
- Optional fields include “(optional)”.
- `FormControl` sets `aria-invalid` and `aria-describedby` (description + message).
- Date fields pass the same attributes to the calendar trigger button.
- Errors use maroon semantic text (`text-status-critical-fg`), not color alone.
- Submit uses `aria-busy` while `isSubmitting`.
- Form-level failures use `role="alert"`.

Keyboard, 320/375/768/1280, and screen-reader passes are **manual** unless recorded in the Step 20 review. This is not a full WCAG certification.

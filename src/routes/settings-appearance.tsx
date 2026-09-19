<button
  type="button"
  role="switch"
  aria-checked={animations}
  onClick={() =>
    setAnimations(!animations)
  }
  className={`relative h-6 w-11 shrink-0 overflow-hidden rounded-full transition-colors ${
    animations
      ? "bg-green-500"
      : "bg-elevated"
  }`}
>
  <span
    className={`absolute left-1 top-1 size-4 rounded-full bg-white transition-transform ${
      animations
        ? "translate-x-5"
        : "translate-x-0"
    }`}
  />
</button>
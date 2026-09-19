<button
  type="button"
  role="switch"
  aria-checked={animations}
  onClick={() =>
    setAnimations(!animations)
  }
  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
    animations
      ? "bg-green-500"
      : "bg-elevated"
  }`}
>
  <span
    className={`absolute top-1 size-4 rounded-full transition-transform ${
      animations
        ? "translate-x-6 bg-white"
        : "translate-x-1 bg-muted"
    }`}
  />
</button>
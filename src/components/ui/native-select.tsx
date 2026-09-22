import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";

import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

type NativeSelectProps =
  SelectHTMLAttributes<HTMLSelectElement>;

export const NativeSelect = forwardRef<
  HTMLSelectElement,
  NativeSelectProps
>(
  (
    {
      className,
      children,
      value,
      defaultValue,
      onChange,
      disabled,
      ...props
    },
    ref,
  ) => {
    const containerRef =
      useRef<HTMLDivElement>(null);

    const optionRefs =
      useRef<Array<HTMLButtonElement | null>>([]);

    const [open, setOpen] =
      useState(false);

    const options = useMemo(() => {
      const list: Array<{
        value: string;
        label: string;
        disabled?: boolean;
      }> = [];

      const items = Array.isArray(children)
        ? children
        : [children];

      for (const child of items) {
        if (
          child &&
          typeof child === "object" &&
          "type" in child &&
          child.type === "option"
        ) {
          const option =
            child as React.ReactElement<{
              value?: string | number;
              disabled?: boolean;
              children?: ReactNode;
            }>;

          list.push({
            value: String(
              option.props.value ?? "",
            ),
            label: String(
              option.props.children ?? "",
            ),
            disabled:
              option.props.disabled,
          });
        }
      }

      return list;
    }, [children]);

    const controlledValue =
      value != null
        ? String(value)
        : undefined;

    const initialValue =
      controlledValue ??
      (defaultValue != null
        ? String(defaultValue)
        : options[0]?.value ?? "");

    const [selectedValue, setSelectedValue] =
      useState(initialValue);

    useEffect(() => {
      if (controlledValue != null) {
        setSelectedValue(controlledValue);
      }
    }, [controlledValue]);

    const selectedOption =
      options.find(
        (option) =>
          option.value === selectedValue,
      ) ?? options[0];

    useEffect(() => {
      if (!open) return;

      const selectedIndex =
        options.findIndex(
          (option) =>
            option.value === selectedValue,
        );

      if (selectedIndex < 0) return;

      const timer =
        window.setTimeout(() => {
          optionRefs.current[
            selectedIndex
          ]?.scrollIntoView({
            block: "center",
            behavior: "instant",
          });
        }, 0);

      return () =>
        window.clearTimeout(timer);
    }, [
      open,
      options,
      selectedValue,
    ]);

    useEffect(() => {
      if (!open) return;

      function handleOutside(
        event: MouseEvent | TouchEvent,
      ) {
        if (
          containerRef.current &&
          !containerRef.current.contains(
            event.target as Node,
          )
        ) {
          setOpen(false);
        }
      }

      document.addEventListener(
        "mousedown",
        handleOutside,
      );

      document.addEventListener(
        "touchstart",
        handleOutside,
      );

      return () => {
        document.removeEventListener(
          "mousedown",
          handleOutside,
        );

        document.removeEventListener(
          "touchstart",
          handleOutside,
        );
      };
    }, [open]);

    function selectOption(
      nextValue: string,
    ) {
      const nextOption =
        options.find(
          (option) =>
            option.value === nextValue,
        );

      if (
        !nextOption ||
        nextOption.disabled
      ) {
        return;
      }

      setSelectedValue(nextValue);
      setOpen(false);

      if (onChange) {
        const event = {
          target: {
            value: nextValue,
          },
          currentTarget: {
            value: nextValue,
          },
        } as unknown as ChangeEvent<HTMLSelectElement>;

        onChange(event);
      }
    }

    return (
      <div
        ref={containerRef}
        className="relative w-full"
      >
        <select
          ref={ref}
          value={selectedValue}
          onChange={onChange}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute size-0 opacity-0"
          {...props}
        >
          {children}
        </select>

        <button
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={props["aria-label"]}
          onClick={() =>
            setOpen((current) => !current)
          }
          className={cn(
            "flex h-11 w-full items-center justify-between rounded-md bg-elevated px-3 text-sm text-fg shadow-[var(--shadow-border)]",
            "focus:outline-none focus:shadow-[var(--shadow-border-hover)]",
            disabled &&
              "cursor-not-allowed opacity-50",
            className,
          )}
        >
          <span className="truncate">
            {selectedOption?.label ?? ""}
          </span>

          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted transition-transform",
              open && "rotate-180",
            )}
          />
        </button>

        {open && (
          <div
            role="listbox"
            aria-label={
              props["aria-label"]
            }
            className="
              absolute
              inset-x-0
              top-[calc(100%+0.5rem)]
              z-[100]
              max-h-72
              overflow-y-auto
              rounded-2xl
              border
              border-border
              bg-elevated
              p-1.5
              shadow-2xl
            "
          >
            {options.map(
              (option, index) => {
                const active =
                  option.value ===
                  selectedValue;

                return (
                  <button
                    key={option.value}
                    ref={(element) => {
                      optionRefs.current[
                        index
                      ] = element;
                    }}
                    type="button"
                    role="option"
                    aria-selected={active}
                    disabled={
                      option.disabled
                    }
                    onClick={() =>
                      selectOption(
                        option.value,
                      )
                    }
                    className={cn(
                      "flex min-h-11 w-full items-center justify-between rounded-xl px-4 text-left text-sm text-fg transition-colors",
                      active
                        ? "bg-bg font-semibold"
                        : "hover:bg-bg/60",
                      option.disabled &&
                        "cursor-not-allowed opacity-40",
                    )}
                  >
                    <span>
                      {option.label}
                    </span>

                    {active && (
                      <span className="text-xs text-muted">
                        Selecionado
                      </span>
                    )}
                  </button>
                );
              },
            )}
          </div>
        )}
      </div>
    );
  },
);

NativeSelect.displayName =
  "NativeSelect";

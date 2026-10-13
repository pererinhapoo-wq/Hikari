import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { t as cn } from "./utils-Cws_m9jY.mjs";
import { ft as ChevronDown } from "../_libs/lucide-react.mjs";
import { t as require_jsx_dev_runtime } from "../_libs/react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/native-select-DtoSTrFt.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/app/applet/src/components/ui/native-select.tsx";
var NativeSelect = (0, import_react.forwardRef)(({ className, children, value, defaultValue, onChange, disabled, ...props }, ref) => {
	const containerRef = (0, import_react.useRef)(null);
	const optionRefs = (0, import_react.useRef)([]);
	const [open, setOpen] = (0, import_react.useState)(false);
	const options = (0, import_react.useMemo)(() => {
		const list = [];
		const items = Array.isArray(children) ? children : [children];
		for (const child of items) if (child && typeof child === "object" && "type" in child && child.type === "option") {
			const option = child;
			list.push({
				value: String(option.props.value ?? ""),
				label: String(option.props.children ?? ""),
				disabled: option.props.disabled
			});
		}
		return list;
	}, [children]);
	const controlledValue = value != null ? String(value) : void 0;
	const initialValue = controlledValue ?? (defaultValue != null ? String(defaultValue) : options[0]?.value ?? "");
	const [selectedValue, setSelectedValue] = (0, import_react.useState)(initialValue);
	(0, import_react.useEffect)(() => {
		if (controlledValue != null) setSelectedValue(controlledValue);
	}, [controlledValue]);
	const selectedOption = options.find((option) => option.value === selectedValue) ?? options[0];
	(0, import_react.useEffect)(() => {
		if (!open) return;
		const selectedIndex = options.findIndex((option) => option.value === selectedValue);
		if (selectedIndex < 0) return;
		const timer = window.setTimeout(() => {
			optionRefs.current[selectedIndex]?.scrollIntoView({
				block: "center",
				behavior: "instant"
			});
		}, 0);
		return () => window.clearTimeout(timer);
	}, [
		open,
		options,
		selectedValue
	]);
	(0, import_react.useEffect)(() => {
		if (!open) return;
		function handleOutside(event) {
			if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false);
		}
		document.addEventListener("mousedown", handleOutside);
		document.addEventListener("touchstart", handleOutside);
		return () => {
			document.removeEventListener("mousedown", handleOutside);
			document.removeEventListener("touchstart", handleOutside);
		};
	}, [open]);
	function selectOption(nextValue) {
		const nextOption = options.find((option) => option.value === nextValue);
		if (!nextOption || nextOption.disabled) return;
		setSelectedValue(nextValue);
		setOpen(false);
		if (onChange) onChange({
			target: { value: nextValue },
			currentTarget: { value: nextValue }
		});
	}
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		ref: containerRef,
		className: "relative w-full",
		children: [
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("select", {
				ref,
				value: selectedValue,
				onChange,
				disabled,
				tabIndex: -1,
				"aria-hidden": "true",
				className: "pointer-events-none absolute size-0 opacity-0",
				...props,
				children
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 217,
				columnNumber: 9
			}, void 0),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
				type: "button",
				disabled,
				"aria-haspopup": "listbox",
				"aria-expanded": open,
				"aria-label": props["aria-label"],
				onClick: () => setOpen((current) => !current),
				className: cn("flex h-11 w-full items-center justify-between rounded-md bg-elevated px-3 text-sm text-fg shadow-[var(--shadow-border)]", "focus:outline-none focus:shadow-[var(--shadow-border-hover)]", disabled && "cursor-not-allowed opacity-50", className),
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
					className: "truncate",
					children: selectedOption?.label ?? ""
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 247,
					columnNumber: 11
				}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ChevronDown, { className: cn("size-4 shrink-0 text-muted transition-transform", open && "rotate-180") }, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 251,
					columnNumber: 11
				}, void 0)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 230,
				columnNumber: 9
			}, void 0),
			open && /* @__PURE__ */ (void 0)("div", {
				role: "listbox",
				"aria-label": props["aria-label"],
				className: "\n              absolute\n              inset-x-0\n              top-[calc(100%+0.5rem)]\n              z-[100]\n              max-h-72\n              overflow-y-auto\n              rounded-2xl\n              border\n              border-border\n              bg-elevated\n              p-1.5\n              shadow-2xl\n            ",
				children: options.map((option, index) => {
					const active = option.value === selectedValue;
					return /* @__PURE__ */ (void 0)("button", {
						ref: (element) => {
							optionRefs.current[index] = element;
						},
						type: "button",
						role: "option",
						"aria-selected": active,
						disabled: option.disabled,
						onClick: () => selectOption(option.value),
						className: cn("flex min-h-11 w-full items-center justify-between rounded-xl px-4 text-left text-sm text-fg transition-colors", active ? "bg-bg font-semibold" : "hover:bg-bg/60", option.disabled && "cursor-not-allowed opacity-40"),
						children: [/* @__PURE__ */ (void 0)("span", { children: option.label }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 314,
							columnNumber: 21
						}, void 0), active && /* @__PURE__ */ (void 0)("span", {
							className: "text-xs text-muted",
							children: "Selecionado"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 319,
							columnNumber: 23
						}, void 0)]
					}, option.value, true, {
						fileName: _jsxFileName,
						lineNumber: 287,
						columnNumber: 19
					}, void 0);
				})
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 260,
				columnNumber: 11
			}, void 0)
		]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 213,
		columnNumber: 7
	}, void 0);
});
NativeSelect.displayName = "NativeSelect";
//#endregion
export { NativeSelect as t };

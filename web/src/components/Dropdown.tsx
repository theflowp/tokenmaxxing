import * as stylex from "@stylexjs/stylex";
import { Select } from "@lenso/ui/select";

export interface DropdownItem<T extends string> {
  value: T;
  label: string;
}

const x = stylex.create({
  // Matches the height and fill of the Lenso SegmentedControl next to it.
  pill: {
    height: 32,
    minHeight: 32,
    paddingBlock: 0,
    paddingInline: 14,
    gap: 6,
    borderRadius: 1000,
    backgroundColor: "var(--lenso-control-fill)",
    color: "var(--lenso-label-primary)",
    fontSize: 13,
    fontWeight: 500,
  },
  small: { height: 26, minHeight: 26, paddingInline: 10, fontSize: 12 },
});

interface Props<T extends string> {
  label: string;
  items: readonly DropdownItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** "title" reads as part of the breadcrumb, "pill" sits among the controls. */
  appearance?: "title" | "pill";
  size?: "md" | "sm";
}

/** Single-choice menu built on the Lenso Select. */
export function Dropdown<T extends string>({
  label,
  items,
  value,
  onChange,
  appearance = "pill",
  size = "md",
}: Props<T>) {
  return (
    <Select
      items={items as DropdownItem<T>[]}
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      variant="secondary"
    >
      <Select.Trigger
        aria-label={label}
        xstyle={appearance === "pill" ? [x.pill, size === "sm" && x.small] : undefined}
      >
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Content>
        <Select.List>
          {items.map((item) => (
            <Select.Item key={item.value} value={item.value} label={item.label}>
              <Select.ItemText>{item.label}</Select.ItemText>
              <Select.ItemIndicator />
            </Select.Item>
          ))}
        </Select.List>
      </Select.Content>
    </Select>
  );
}

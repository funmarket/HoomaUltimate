import { useEffect, useMemo, useRef, useState } from "react";

export interface AdminSelectOption {
  readonly value: string;
  readonly label: string;
  readonly description?: string;
}

export function AdminSelect({
  label,
  value,
  options,
  disabled = false,
  placeholder,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly options: readonly AdminSelectOption[];
  readonly disabled?: boolean;
  readonly placeholder: string;
  readonly onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  useEffect(() => {
    if (disabled) setIsOpen(false);
  }, [disabled]);

  function choose(nextValue: string) {
    onChange(nextValue);
    setIsOpen(false);
  }

  return (
    <div className="admin-select-field" ref={rootRef}>
      <span className="admin-select-label">{label}</span>
      <button
        type="button"
        className="admin-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span>{selected?.label ?? placeholder}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {isOpen ? (
        <div className="admin-select-menu" role="listbox" aria-label={label}>
          <button
            type="button"
            role="option"
            aria-selected={value === ""}
            className="admin-select-option"
            onClick={() => choose("")}
          >
            {placeholder}
          </button>
          {options.map((option) => (
            <button
              type="button"
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              className="admin-select-option"
              onClick={() => choose(option.value)}
            >
              <span>{option.label}</span>
              {option.description ? <small>{option.description}</small> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

"use client";

/*
 * Les reglages du panneau lateral de l'affiche : groupes, choix exclusifs et
 * curseurs, dans le style de la barre d'outils de la galerie.
 */

export function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5">
      <h2 className="border-b border-line pb-2 text-xs font-semibold uppercase tracking-[0.25em] text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Label({
  children,
  aside,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <span className="mb-2 flex items-baseline justify-between gap-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
      {children}
      {aside && (
        <span className="font-normal normal-case tracking-normal tabular-nums text-ink-soft">
          {aside}
        </span>
      )}
    </span>
  );
}

export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
  columns = options.length,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  columns?: number;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div
        role="radiogroup"
        aria-label={label}
        className={`grid gap-1 border border-line bg-surface/70 p-1 ${
          options.length > columns ? "rounded-2xl" : "rounded-full"
        }`}
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.value)}
              className={`whitespace-nowrap rounded-full px-2 py-1.5 text-xs font-medium transition-colors ${
                active ? "bg-ink text-canvas" : "text-ink-soft hover:text-ink"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Slider({
  label,
  display,
  value,
  min,
  max,
  step,
  onChange,
  disabled,
}: {
  label: string;
  display: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`block ${disabled ? "opacity-40" : ""}`}>
      <Label aside={display}>{label}</Label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-ink"
      />
    </label>
  );
}

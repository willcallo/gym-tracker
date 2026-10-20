'use client';

export default function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-11 w-[4.75rem] shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        checked ? 'bg-brand' : 'bg-gray-300'
      }`}
    >
      <span
        className={`absolute top-1 left-1 h-9 w-9 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-8' : ''
        }`}
      />
    </button>
  );
}

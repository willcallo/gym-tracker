'use client';

import { useState } from 'react';
import { btn } from './ui';
import type { ButtonVariant } from './ui';

// Two-step button for destructive or costly actions: first tap asks, second tap does it.
export default function ConfirmButton({
  label,
  confirmLabel,
  message,
  onConfirm,
  variant = 'danger',
  disabled,
  className = '',
}: {
  label: string;
  confirmLabel: string;
  message?: string;
  onConfirm: () => void | Promise<void>;
  variant?: ButtonVariant;
  disabled?: boolean;
  className?: string;
}) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!asking) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setAsking(true)}
        className={`${btn(variant)} ${className}`}
      >
        {label}
      </button>
    );
  }

  return (
    <div role="alertdialog" className={`rounded-2xl border border-gray-300 bg-gray-50 p-3 ${className}`}>
      {message && <p className="mb-3 text-sm text-gray-800">{message}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setAsking(false)} disabled={busy} className={btn('secondary')}>
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
            } finally {
              setBusy(false);
              setAsking(false);
            }
          }}
          className={btn(variant === 'danger' ? 'danger' : 'primary')}
        >
          {busy ? 'Working...' : confirmLabel}
        </button>
      </div>
    </div>
  );
}

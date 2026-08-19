import { useEffect, type ReactNode } from 'react';
import { IconAuto, IconChevronLeft, IconMoon, IconSun } from './Icons';
import { useTheme, type ThemePref } from '../state/theme';
import stegoArt from '../../assets/images/stego.png';

export function TopBar({
  title,
  onBack,
  backLabel = 'Back',
  actions,
}: {
  title: string;
  onBack?: () => void;
  backLabel?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="topbar">
      {onBack && (
        <button className="btn btn--quiet btn--sm" onClick={onBack} aria-label={backLabel}>
          <IconChevronLeft className="btn__icon" />
          <span className="topbar__back-text">{backLabel}</span>
        </button>
      )}
      <h1 className="topbar__title">{title}</h1>
      {actions}
    </header>
  );
}

export function ThemeToggle() {
  const [pref, setPref] = useTheme();
  const options: { value: ThemePref; label: ReactNode; title: string }[] = [
    { value: 'auto', label: <IconAuto />, title: 'Match the system' },
    { value: 'light', label: <IconSun />, title: 'Light' },
    { value: 'dark', label: <IconMoon />, title: 'Dark' },
  ];

  return (
    <div className="theme-toggle">
      <div className="segmented" role="group" aria-label="Colour theme">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className="segmented__opt"
            aria-pressed={pref === opt.value}
            aria-label={opt.title}
            title={opt.title}
            onClick={() => setPref(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Slider({
  value,
  min,
  max,
  onChange,
  label,
  suffix,
  disabled,
  note,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  label: string;
  suffix?: string;
  disabled?: boolean;
  note?: string;
}) {
  const span = Math.max(1, max - min);
  const fill = `${((Math.min(Math.max(value, min), max) - min) / span) * 100}%`;

  return (
    <div className="slider-row">
      <div className="slider-row__head">
        <span className="field__label">{label}</span>
        <span className="slider-row__value">
          {value}
          {suffix ? ` ${suffix}` : ''}
        </span>
      </div>
      <input
        className="slider"
        type="range"
        min={min}
        max={max}
        step={1}
        value={Math.min(Math.max(value, min), max)}
        disabled={disabled || max <= min}
        style={{ ['--fill' as string]: fill }}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
      {note && <p className="hint">{note}</p>}
    </div>
  );
}

export function Stepper({
  label,
  sub,
  value,
  min,
  max,
  onChange,
  icon,
  disabled,
}: {
  label: string;
  sub?: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  icon?: ReactNode;
  disabled?: boolean;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <div className={disabled ? 'stepper is-disabled' : 'stepper'}>
      {icon && <span className="stepper__icon">{icon}</span>}
      <span className="stepper__text">
        <span className="stepper__label">{label}</span>
        {sub && <span className="stepper__sub">{sub}</span>}
      </span>
      <span className="stepper__controls">
        <button
          type="button"
          className="btn btn--quiet btn--icon"
          onClick={() => onChange(clamp(value - 1))}
          disabled={disabled || value <= min}
          aria-label={`Fewer ${label}`}
        >
          −
        </button>
        <span className="stepper__value" aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          className="btn btn--quiet btn--icon"
          onClick={() => onChange(clamp(value + 1))}
          disabled={disabled || value >= max}
          aria-label={`More ${label}`}
        >
          +
        </button>
      </span>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div className="field">
      {label && <span className="field__label">{label}</span>}
      <div className="segmented" role="group" aria-label={label}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className="segmented__opt"
            aria-pressed={value === opt.value}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Dialog({
  title,
  children,
  onClose,
  footer,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="scrim" onClick={onClose} role="presentation">
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="dialog__title">{title}</h2>
        <div className="stack">{children}</div>
        {footer && <div className="row dialog__footer">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog
      title={title}
      onClose={onCancel}
      footer={
        <>
          <span className="spacer" />
          <button className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn--danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="muted">{body}</p>
    </Dialog>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <img className="empty__art" src={stegoArt} alt="" />
      <div>
        <p className="empty__title">{title}</p>
        <p className="muted">{body}</p>
      </div>
      {action}
    </div>
  );
}

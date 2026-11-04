export interface DateSelectorProps { value: string; onChange: (value: string) => void; onBlur: () => void; max: string; error?: string }
export function DateSelector({ value, onChange, onBlur, max, error }: DateSelectorProps): React.JSX.Element {
  return <div>
    <label className="mb-2 block text-sm font-medium" htmlFor="message-date">Select date</label>
    <input id="message-date" className="date-input w-full" type="date" value={value} min="1000-01-01" max={max} required onChange={(event) => onChange(event.target.value)} onBlur={onBlur} aria-invalid={error ? true : undefined} aria-describedby={error ? 'date-error' : 'date-hint'} />
    <p id="date-hint" className="mt-2 text-xs leading-5 text-muted">Choose today or an earlier date.</p>
    {error && <p id="date-error" className="mt-2 text-xs leading-5 text-error" role="alert">{error}</p>}
  </div>;
}

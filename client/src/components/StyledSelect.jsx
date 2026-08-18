import { PRIORITY_STYLES, STATUS_STYLES } from './Badge';

function StyledSelect({ type, value, options, disabled, onChange }) {
  const styles = type === 'status' ? STATUS_STYLES : PRIORITY_STYLES;
  const colorClass = styles[value] || 'bg-gray-100 text-gray-600 ring-gray-500/20';

  return (
    <div className="relative inline-block">
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`appearance-none rounded-full py-1 pl-3 pr-8 text-xs font-medium capitalize ring-1 ring-inset focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:cursor-not-allowed disabled:opacity-60 ${colorClass}`}
      >
        {options.map((option) => (
          <option key={option} value={option} className="bg-white text-gray-900">
            {option}
          </option>
        ))}
      </select>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 opacity-60"
      >
        <path
          fillRule="evenodd"
          d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  );
}

export default StyledSelect;

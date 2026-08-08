import { SCHEDULE_CONSULTANTS } from './appointmentRequestsShared';

interface ConsultantPickerProps {
  selected: string[];
  onToggle: (name: string) => void;
}

export function ConsultantPicker({ selected, onToggle }: ConsultantPickerProps) {
  return (
    <div className="space-y-1.5">
      <span id="consultant-picker-label" className="text-sm font-medium text-gray-700">
        Consultora(s) responsável(is)
      </span>
      <div className="flex flex-wrap gap-2" role="group" aria-labelledby="consultant-picker-label">
        {SCHEDULE_CONSULTANTS.map((name) => {
          const active = selected.includes(name);
          return (
            <button
              key={name}
              type="button"
              onClick={() => onToggle(name)}
              aria-pressed={active}
              className={`min-h-11 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                active
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-gray-500">A inspeção criada a partir desta visita herda quem você marcar.</p>
    </div>
  );
}

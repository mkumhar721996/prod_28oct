import { dayLabel, type Slot, type SlotDay } from "@/lib/appointments";

export type SlotsStatus = "loading" | "ready" | "error";

type Props = {
  /** False until a clinic is chosen. */
  clinicChosen: boolean;
  status: SlotsStatus;
  days: SlotDay[];
  selected: Slot | null;
  onSelect: (slot: Slot) => void;
};

/** Free times as one chip group per day; the chosen chip is `aria-pressed`. */
export function ClinicSlotPicker({ clinicChosen, status, days, selected, onSelect }: Props) {
  let body;
  if (!clinicChosen) {
    body = <p className="text-muted">Choose a clinic to see free times.</p>;
  } else if (status === "loading") {
    body = (
      <div className="stack stack-2" role="status" aria-label="Loading free times">
        <span className="skeleton" />
        <span className="skeleton" />
        <span className="skeleton" />
      </div>
    );
  } else if (status === "error") {
    body = <p className="text-muted">We couldn&apos;t load free times. Choose the clinic again to retry.</p>;
  } else if (days.length === 0) {
    body = <p className="text-muted">No free times in the next 14 days.</p>;
  } else {
    body = (
      <>
        {days.map((day) => (
          <div className="day-group" role="group" aria-labelledby={`day-${day.date}`} key={day.date}>
            <span className="day-label" id={`day-${day.date}`}>
              {dayLabel(day.date)}
            </span>
            <div className="slot-list">
              {day.times.map((time) => (
                <button
                  type="button"
                  className="chip"
                  key={time}
                  aria-pressed={selected?.date === day.date && selected.time === time}
                  onClick={() => onSelect({ date: day.date, time })}
                >
                  {time}
                </button>
              ))}
            </div>
          </div>
        ))}
        <p className="text-sm text-muted">Times already taken are not shown.</p>
      </>
    );
  }
  return (
    <div className="field" role="group" aria-labelledby="time-label">
      <span className="field-label" id="time-label">
        Time
      </span>
      <div className="slots-box" aria-live="polite">
        {body}
      </div>
    </div>
  );
}

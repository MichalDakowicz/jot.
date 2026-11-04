import React, { useState } from 'react';

import { parseClassTime } from '@jot/core/graph';
import { useStore } from '@jot/core/store';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEK = [1, 2, 3, 4, 5, 6, 0];

/** When a notebook's class meets; Today reads its timetable from these. */
export function ClassTimes({ notebookId }: { notebookId: string }) {
  const { classesOf, addClasses, deleteClass } = useStore();
  const [days, setDays] = useState<number[]>([]);
  const [time, setTime] = useState('');
  const [room, setRoom] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const slots = classesOf(notebookId);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const starts_at = parseClassTime(time);
    if (!starts_at) return setProblem('Write the time as 9, 9:30 or 14:05.');
    if (!days.length) return setProblem('Pick at least one day.');
    setProblem(null);
    await addClasses({ notebookId, weekdays: days, starts_at, room: room.trim() });
    setDays([]);
    setTime('');
    setRoom('');
  }

  return (
    <section className="section">
      <h2 className="label">class times</h2>
      {slots.length ? (
        <ul className="rows">
          {slots.map((s) => (
            <li key={s.id} className="row-static">
              <span className="time">{DAYS[s.weekday]} {s.starts_at.slice(0, 5)}</span>
              <span className="grow muted">{s.room}</span>
              <button className="chip" aria-label={`Remove ${DAYS[s.weekday]} ${s.starts_at.slice(0, 5)}`} onClick={() => deleteClass(s.id)}>remove</button>
            </li>
          ))}
        </ul>
      ) : <p className="muted">no class times yet</p>}
      <form className="form" onSubmit={add}>
        <div className="day-picks" role="group" aria-label="Days">
          {WEEK.map((d) => (
            <button type="button" key={d} aria-pressed={days.includes(d)} className={'chip' + (days.includes(d) ? ' on' : '')}
              onClick={() => setDays((xs) => (xs.includes(d) ? xs.filter((x) => x !== d) : [...xs, d]))}>{DAYS[d]}</button>
          ))}
        </div>
        <div className="field-row">
          <input className="field" placeholder="Time, e.g. 9:30" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Time" />
          <input className="field" placeholder="Room" value={room} onChange={(e) => setRoom(e.target.value)} aria-label="Room" />
          <button className="button">Add this time</button>
        </div>
        {problem ? <p className="error">{problem}</p> : null}
      </form>
    </section>
  );
}

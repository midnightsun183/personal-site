"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { LAUREL, PALMA, dayLabel, dayLength, dayOfYear, formatHours, minutesApart } from "@/lib/daylight";
import s from "./margins.module.css";

const W = 600;
const H = 220;
const PAD = 28;
const MIN = 9;
const MAX = 15.4;
const SOLSTICE = 172;

const x = (d: number) => PAD + ((d - 1) / 364) * (W - PAD * 2);
const y = (h: number) => H - PAD - ((h - MIN) / (MAX - MIN)) * (H - PAD * 2);

function curve(lat: number): string {
  let d = "";
  for (let i = 1; i <= 365; i += 2) {
    d += `${i === 1 ? "M" : "L"}${x(i).toFixed(1)} ${y(dayLength(lat, i)).toFixed(1)}`;
  }
  return d;
}

const PALMA_PATH = curve(PALMA.lat);
const LAUREL_PATH = curve(LAUREL.lat);

const noSubscribe = () => () => {};

type Props = {
  /** Smaller padding and no difference line, for use in the margin. */
  compact?: boolean;
};

/** Hours of daylight through the year in Palma and Laurel, with a slider to pick a day. Opens on today. */
export default function DaylightChart({ compact = false }: Props) {
  const inputId = useId();
  // Today on the client, the summer solstice on the server; no effect needed.
  const today = useSyncExternalStore(noSubscribe, () => dayOfYear(new Date()), () => SOLSTICE);
  const [picked, setPicked] = useState<number | null>(null);
  const doy = picked ?? today;

  const palma = dayLength(PALMA.lat, doy);
  const laurel = dayLength(LAUREL.lat, doy);
  const { minutes, longer } = minutesApart(doy);

  return (
    <div className={`${s.daylight} ${compact ? s.compact : ""}`}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Hours of daylight through the year in Palma and Laurel. The two lines almost overlap.">
        <path className={s.dlA} d={PALMA_PATH} />
        <path className={s.dlB} d={LAUREL_PATH} />
        {[10, 12, 14].map((h) => (
          <text key={h} className={s.dlTick} x={2} y={y(h) + 4}>
            {h}h
          </text>
        ))}
        <line className={s.dlMarker} x1={x(doy)} x2={x(doy)} y1={PAD - 8} y2={H - PAD + 8} />
        <circle className={s.dlDot} r={4.5} cx={x(doy)} cy={y(palma)} />
      </svg>
      <label htmlFor={inputId}>
        {compact ? "Day" : "Pick a day"}: <strong>{dayLabel(doy)}</strong>
      </label>
      <input
        id={inputId}
        type="range"
        min={1}
        max={365}
        step={1}
        value={doy}
        aria-valuetext={dayLabel(doy)}
        onChange={(e) => setPicked(Number(e.target.value))}
      />
      <p className={s.readout} aria-live="polite">
        <span className={s.legendA}>
          Palma <strong>{formatHours(palma)}</strong>
        </span>
        <span>
          Laurel <strong>{formatHours(laurel)}</strong>
        </span>
      </p>
      {!compact && (
        <p className={s.diff}>
          Difference: {minutes === 0 ? "the same, to the minute" : `${minutes} ${minutes === 1 ? "minute" : "minutes"} more in ${longer.name}`}
        </p>
      )}
    </div>
  );
}

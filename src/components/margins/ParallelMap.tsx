import s from "./margins.module.css";

/** Freehand sketch of the 39th parallel from the Chesapeake to Mallorca. Not to scale. */
export default function ParallelMap() {
  return (
    <svg viewBox="0 0 760 210" role="img" aria-labelledby="parallel-map-title">
      <title id="parallel-map-title">
        A sketch of the 39th parallel running from the Chesapeake Bay across the Atlantic to Mallorca.
      </title>
      <path className={s.coast} d="M40 20 C 60 50, 48 70, 70 92 C 88 110, 76 130, 96 150 C 110 166, 100 182, 118 200" />
      <path className={s.coast} d="M78 40 C 92 62, 84 84, 102 96 M98 118 C 112 128, 106 140, 120 150" />
      <path className={s.coast} d="M600 18 C 610 40, 596 60, 616 70 M650 190 C 640 170, 660 156, 646 138" />
      <path className={s.island} d="M688 92 C 700 80, 724 82, 732 94 C 740 106, 728 122, 712 120 C 698 118, 680 108, 688 92 Z" />
      <line className={s.parallel} x1={20} y1={100} x2={752} y2={100} />
      <circle className={s.pin} cx={88} cy={104} r={5} />
      <circle className={s.pin} cx={708} cy={100} r={5} />
      <text className={s.big} x={24} y={140}>Laurel</text>
      <text x={24} y={176}>39.10° N</text>
      <text className={s.big} x={748} y={148} textAnchor="end">Palma</text>
      <text x={748} y={184} textAnchor="end">39.57° N</text>
      <text className={s.ocean} x={380} y={80} textAnchor="middle">ATLANTIC</text>
      <text className={s.mid} x={380} y={124} textAnchor="middle">about 4,100 miles, due east-ish</text>
    </svg>
  );
}

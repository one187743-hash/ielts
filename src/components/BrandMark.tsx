import React from 'react';

export function MeridianLogoMark({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="36" height="36" rx="8" fill="#0B1F3A" />
      <circle cx="18" cy="18" r="10.5" stroke="#FFFFFF" strokeWidth="1.75" />
      <ellipse cx="18" cy="18" rx="5.2" ry="10.5" stroke="#93C5FD" strokeWidth="1.5" />
      <path d="M7.5 18H28.5" stroke="#FFFFFF" strokeWidth="1.5" />
      <path d="M18 7.5V28.5" stroke="#93C5FD" strokeWidth="1.3" />
    </svg>
  );
}

export function ExamDiagramGraphic({ kind }: { kind: string }) {
  if (kind === 'svg:campus_map') {
    return (
      <div className="border border-slate-200 rounded-lg bg-slate-50 p-4 my-3">
        <div className="text-xs font-medium text-slate-600 mb-2">
          Northgate University Campus Library Plan (Schematic)
        </div>
        <svg viewBox="0 0 440 220" className="w-full max-w-md h-auto bg-white border border-slate-200 rounded">
          {/* Compass */}
          <text x="408" y="24" fontSize="11" fontWeight="700" fill="#0B1F3A">N</text>
          <path d="M412 28 L412 46 M407 34 L412 28 L417 34" stroke="#0B1F3A" strokeWidth="1.5" fill="none" />
          {/* Central Courtyard */}
          <rect x="160" y="75" width="120" height="75" fill="#EFF6FF" stroke="#1D4ED8" strokeWidth="1.5" />
          <text x="220" y="116" textAnchor="middle" fontSize="11" fontWeight="600" fill="#1E3A8A">
            Central Courtyard
          </text>
          {/* Zones */}
          <rect x="40" y="155" width="100" height="45" fill="#F8FAFC" stroke="#475569" strokeWidth="1.2" />
          <text x="90" y="181" textAnchor="middle" fontSize="10.5" fill="#0F172A">Zone A (South-West)</text>

          <rect x="295" y="25" width="100" height="45" fill="#F8FAFC" stroke="#475569" strokeWidth="1.2" />
          <text x="345" y="51" textAnchor="middle" fontSize="10.5" fill="#0F172A">Zone B (North-East)</text>

          <rect x="295" y="88" width="100" height="42" fill="#F1F5F9" stroke="#64748B" strokeDasharray="3 3" />
          <text x="345" y="113" textAnchor="middle" fontSize="9.5" fill="#334155">Acoustic Media Lab</text>

          <rect x="160" y="165" width="120" height="35" fill="#F8FAFC" stroke="#475569" strokeWidth="1.2" />
          <text x="220" y="186" textAnchor="middle" fontSize="10.5" fill="#0F172A">Zone C (Lower Annex)</text>

          <rect x="40" y="75" width="95" height="55" fill="#F8FAFC" stroke="#475569" strokeWidth="1.2" />
          <text x="87" y="106" textAnchor="middle" fontSize="10.5" fill="#0F172A">Zone D (West)</text>
        </svg>
      </div>
    );
  }

  // svg:ielts_task1_chart
  return (
    <div className="border border-slate-200 rounded-lg bg-slate-50 p-4 my-3">
      <div className="text-xs font-medium text-slate-600 mb-2">
        Postgraduate Enrollment by Faculty (Thousands, 2018–2024)
      </div>
      <svg viewBox="0 0 460 220" className="w-full max-w-lg h-auto bg-white border border-slate-200 rounded">
        {/* Axes */}
        <line x1="50" y1="25" x2="50" y2="175" stroke="#94A3B8" strokeWidth="1" />
        <line x1="50" y1="175" x2="430" y2="175" stroke="#94A3B8" strokeWidth="1" />
        {/* Grid labels */}
        {[0, 20, 40, 60].map((val, idx) => {
          const y = 175 - idx * 45;
          return (
            <g key={val}>
              <line x1="46" y1={y} x2="430" y2={y} stroke="#E2E8F0" strokeWidth="1" />
              <text x="40" y={y + 4} textAnchor="end" fontSize="10" fill="#475569">{val}k</text>
            </g>
          );
        })}
        {/* Bars: 2018 vs 2024 across 4 faculties */}
        {[
          { label: 'Data Sci', v18: 18, v24: 54, x: 75 },
          { label: 'Engineering', v18: 34, v24: 46, x: 165 },
          { label: 'Economics', v18: 28, v24: 33, x: 255 },
          { label: 'Humanities', v18: 31, v24: 24, x: 345 },
        ].map((d) => {
          const h18 = (d.v18 / 60) * 135;
          const h24 = (d.v24 / 60) * 135;
          return (
            <g key={d.label}>
              <rect x={d.x} y={175 - h18} width="22" height={h18} fill="#0B1F3A" />
              <rect x={d.x + 26} y={175 - h24} width="22" height={h24} fill="#1D4ED8" />
              <text x={d.x + 24} y="192" textAnchor="middle" fontSize="10" fill="#0F172A">{d.label}</text>
            </g>
          );
        })}
        {/* Legend */}
        <rect x="295" y="14" width="10" height="10" fill="#0B1F3A" />
        <text x="310" y="23" fontSize="10" fill="#334155">2018</text>
        <rect x="355" y="14" width="10" height="10" fill="#1D4ED8" />
        <text x="370" y="23" fontSize="10" fill="#334155">2024</text>
      </svg>
    </div>
  );
}

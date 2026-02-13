import React, { useEffect, useMemo, useState } from 'react';

type ThemeMode = 'light' | 'dark';
type HouseholdType = 'solo' | 'familia';
type EmploymentStatus =
  | 'funcionario'
  | 'cuenta_ajena_con_paro'
  | 'cuenta_ajena_sin_paro'
  | 'autonomo_sin_paro';

type CoverageTone = 'red' | 'amber' | 'green' | 'blue';

const THEME_STORAGE_KEY = 'finanzas.theme';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getStoredThemeChoice = (): ThemeMode | null => {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : null;
};

const resolveTheme = (themeChoice: ThemeMode | null): ThemeMode => {
  if (themeChoice) return themeChoice;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const formatEUR = (value: number): string =>
  value.toLocaleString('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  });

const statusLabel: Record<EmploymentStatus, string> = {
  funcionario: 'Funcionario/a',
  cuenta_ajena_con_paro: 'Cuenta ajena con paro',
  cuenta_ajena_sin_paro: 'Cuenta ajena sin paro',
  autonomo_sin_paro: 'Autónomo/a o sin prestación',
};

const statusMonthsBase: Record<EmploymentStatus, number> = {
  funcionario: 5,
  cuenta_ajena_con_paro: 6,
  cuenta_ajena_sin_paro: 8,
  autonomo_sin_paro: 10,
};

function computeRecommendedMonths(params: {
  employmentStatus: EmploymentStatus;
  householdType: HouseholdType;
  householdMembers: number;
  dependents: number;
  incomeSources: number;
  cutCapacityPct: number;
  unemploymentBenefitMonths: number;
  housingCost: number;
  loansCost: number;
  totalEssential: number;
}): number {
  const {
    employmentStatus,
    householdType,
    householdMembers,
    dependents,
    incomeSources,
    cutCapacityPct,
    unemploymentBenefitMonths,
    housingCost,
    loansCost,
    totalEssential,
  } = params;

  let months = statusMonthsBase[employmentStatus];

  if (householdType === 'familia') months += 1;
  if (householdMembers >= 4) months += 1;
  if (dependents >= 2) months += 1;

  if (incomeSources >= 2) months -= 1;
  if (incomeSources <= 1) months += 1;

  const debtWeight = totalEssential > 0 ? (housingCost + loansCost) / totalEssential : 0;
  if (debtWeight >= 0.45) months += 1;

  if (employmentStatus === 'cuenta_ajena_con_paro') {
    if (unemploymentBenefitMonths >= 12) months -= 1;
    if (unemploymentBenefitMonths <= 4) months += 1;
  }

  if (cutCapacityPct <= 10) months += 1;
  if (cutCapacityPct >= 30) months -= 1;

  return clamp(Math.round(months), 0, 24);
}

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5V5" />
      <path d="M12 19v2.5" />
      <path d="M4.9 4.9 6.7 6.7" />
      <path d="M17.3 17.3 19.1 19.1" />
      <path d="M2.5 12H5" />
      <path d="M19 12h2.5" />
      <path d="M4.9 19.1 6.7 17.3" />
      <path d="M17.3 6.7 19.1 4.9" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 14.1A8.8 8.8 0 1 1 9.9 3a7 7 0 0 0 11.1 11.1Z" />
    </svg>
  );
}

function EuroInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <div className="relative">
        <input
          type="number"
          min={0}
          step={10}
          value={value}
          onChange={(event) => onChange(clamp(Number(event.target.value) || 0, 0, 999_999))}
          className="w-full rounded-xl border border-gray-300 p-2 pr-10 focus:outline-none focus:ring-2 focus:ring-cyan-500"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-500">€</span>
      </div>
    </div>
  );
}

export default function App() {
  const [themeChoice, setThemeChoice] = useState<ThemeMode | null>(getStoredThemeChoice);
  const activeTheme = resolveTheme(themeChoice);

  const [householdType, setHouseholdType] = useState<HouseholdType>('solo');
  const [householdMembers, setHouseholdMembers] = useState(1);
  const [dependents, setDependents] = useState(0);
  const [incomeSources, setIncomeSources] = useState(1);

  const [employmentStatus, setEmploymentStatus] = useState<EmploymentStatus>('cuenta_ajena_con_paro');
  const [unemploymentBenefitMonths, setUnemploymentBenefitMonths] = useState(12);
  const [cutCapacityPct, setCutCapacityPct] = useState(15);

  const [housingCost, setHousingCost] = useState(900);
  const [foodCost, setFoodCost] = useState(350);
  const [loansCost, setLoansCost] = useState(150);
  const [utilitiesCost, setUtilitiesCost] = useState(150);
  const [transportCost, setTransportCost] = useState(120);
  const [healthEducationCost, setHealthEducationCost] = useState(80);
  const [otherEssentialCost, setOtherEssentialCost] = useState(100);

  const [currentFund, setCurrentFund] = useState(4_000);
  const [isMonthsCustomized, setIsMonthsCustomized] = useState(false);

  useEffect(() => {
    if (householdType === 'solo') {
      setHouseholdMembers(1);
      setDependents(0);
    }
    if (householdType === 'familia' && householdMembers < 2) {
      setHouseholdMembers(2);
    }
  }, [householdType, householdMembers]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const resolved = themeChoice ?? (media.matches ? 'dark' : 'light');
      document.documentElement.dataset.theme = resolved;
      document.documentElement.style.colorScheme = resolved;
    };

    applyTheme();

    if (themeChoice !== null) {
      return;
    }

    media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, [themeChoice]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (themeChoice) {
      window.localStorage.setItem(THEME_STORAGE_KEY, themeChoice);
    } else {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    }
  }, [themeChoice]);

  const totalEssentialMonthly = useMemo(
    () =>
      housingCost +
      foodCost +
      loansCost +
      utilitiesCost +
      transportCost +
      healthEducationCost +
      otherEssentialCost,
    [
      housingCost,
      foodCost,
      loansCost,
      utilitiesCost,
      transportCost,
      healthEducationCost,
      otherEssentialCost,
    ],
  );

  const recommendedMonths = useMemo(
    () =>
      computeRecommendedMonths({
        employmentStatus,
        householdType,
        householdMembers,
        dependents,
        incomeSources,
        cutCapacityPct,
        unemploymentBenefitMonths,
        housingCost,
        loansCost,
        totalEssential: totalEssentialMonthly,
      }),
    [
      employmentStatus,
      householdType,
      householdMembers,
      dependents,
      incomeSources,
      cutCapacityPct,
      unemploymentBenefitMonths,
      housingCost,
      loansCost,
      totalEssentialMonthly,
    ],
  );

  const [selectedMonths, setSelectedMonths] = useState(recommendedMonths);

  useEffect(() => {
    if (!isMonthsCustomized) {
      setSelectedMonths(recommendedMonths);
    }
  }, [recommendedMonths, isMonthsCustomized]);

  const selectedFundTarget = totalEssentialMonthly * selectedMonths;
  const autoFundTarget = totalEssentialMonthly * recommendedMonths;
  const range6To12Min = totalEssentialMonthly * 6;
  const range6To12Max = totalEssentialMonthly * 12;

  const coveredMonths = totalEssentialMonthly > 0 ? currentFund / totalEssentialMonthly : 0;
  const gapToSelected = selectedFundTarget - currentFund;
  const gapToAuto = autoFundTarget - currentFund;

  const coverage = useMemo(() => {
    let title = 'Insuficiente';
    let body = 'Tu fondo actual no cubre los meses recomendados para tu situación actual.';
    let tone: CoverageTone = 'red';

    if (coveredMonths >= selectedMonths && coveredMonths >= 6) {
      title = 'Bien cubierto';
      body = 'Tu fondo cubre el objetivo actual y está en un nivel prudente.';
      tone = coveredMonths > 12 ? 'blue' : 'green';
    } else if (coveredMonths >= recommendedMonths) {
      title = 'Aceptable para tu perfil';
      body = 'Cubres tu recomendación automática, aunque podrías reforzarlo para mayor tranquilidad.';
      tone = 'green';
    } else if (coveredMonths >= 3) {
      title = 'Algo justo';
      body = 'Tienes margen, pero podrías quedarte corto si hay imprevistos largos.';
      tone = 'amber';
    }

    return { title, body, tone };
  }, [coveredMonths, selectedMonths, recommendedMonths]);

  const coverageColorClass: Record<CoverageTone, string> = {
    red: 'border-red-200 bg-red-50 text-red-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    blue: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  };

  const coverageProgress =
    selectedMonths <= 0 ? (coveredMonths > 0 ? 100 : 0) : clamp((coveredMonths / selectedMonths) * 100, 0, 100);

  return (
    <>
      <div className="relative min-h-screen text-gray-900">
        <style>{`
          .landing-bg{position:fixed;inset:0;z-index:-1;background:
            radial-gradient(900px 600px at 10% 0%,rgba(14,165,233,.12),transparent 60%),
            radial-gradient(900px 600px at 90% -10%,rgba(2,132,199,.10),transparent 60%),
            linear-gradient(180deg,#fff 0%,#f8fbff 60%,#fff 100%),
            linear-gradient(to bottom,rgba(15,23,42,.04) 1px,transparent 1px),
            linear-gradient(to right,rgba(15,23,42,.04) 1px,transparent 1px);
            background-size:auto,auto,100% 100%,24px 24px,24px 24px;background-position:center}
          html[data-theme="dark"] .landing-bg{background:
            radial-gradient(900px 600px at 10% 0%, rgba(14,165,233,.20), transparent 62%),
            radial-gradient(900px 600px at 90% -10%, rgba(8,47,73,.55), transparent 62%),
            linear-gradient(180deg,#020617 0%,#0f172a 60%,#020617 100%),
            linear-gradient(to bottom, rgba(148,163,184,.10) 1px, transparent 1px),
            linear-gradient(to right, rgba(148,163,184,.10) 1px, transparent 1px)}
        `}</style>
        <div className="landing-bg" aria-hidden="true" />

        <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
            <a
              href="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-600 hover:text-cyan-700 hover:underline"
            >
              <span aria-hidden="true">&larr;</span> Volver al inicio
            </a>

            <div
              className="inline-flex gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm"
              role="group"
              aria-label="Selector de tema"
            >
              <button
                type="button"
                onClick={() => setThemeChoice('light')}
                aria-label="Tema claro"
                aria-pressed={activeTheme === 'light'}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                  activeTheme === 'light' ? 'bg-cyan-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <SunIcon />
              </button>
              <button
                type="button"
                onClick={() => setThemeChoice('dark')}
                aria-label="Tema oscuro"
                aria-pressed={activeTheme === 'dark'}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                  activeTheme === 'dark' ? 'bg-cyan-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <MoonIcon />
              </button>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-6xl space-y-6 p-6">
          <div>
            <h1 className="text-3xl font-extrabold md:text-4xl">Fondo de Emergencia</h1>
            <p className="mt-2 max-w-4xl text-sm text-gray-700 md:text-base">
              Calcula cuánto dinero deberías tener para cubrir tus gastos esenciales si te quedas sin ingresos. La
              recomendación general suele estar entre 6 y 12 meses, pero puede variar según estabilidad laboral y
              situación familiar.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-4 rounded-2xl bg-white p-4 shadow">
              <h2 className="text-lg font-semibold">Perfil del hogar</h2>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">¿Para quién es?</label>
                <div className="flex gap-2">
                  <label className="flex-1 cursor-pointer">
                    <input
                      type="radio"
                      className="peer sr-only"
                      name="householdType"
                      checked={householdType === 'solo'}
                      onChange={() => setHouseholdType('solo')}
                    />
                    <span className="block select-none rounded-lg border border-gray-300 py-1.5 text-center text-sm peer-checked:border-cyan-600 peer-checked:bg-cyan-600 peer-checked:text-white">
                      Solo yo
                    </span>
                  </label>
                  <label className="flex-1 cursor-pointer">
                    <input
                      type="radio"
                      className="peer sr-only"
                      name="householdType"
                      checked={householdType === 'familia'}
                      onChange={() => setHouseholdType('familia')}
                    />
                    <span className="block select-none rounded-lg border border-gray-300 py-1.5 text-center text-sm peer-checked:border-cyan-600 peer-checked:bg-cyan-600 peer-checked:text-white">
                      Yo y mi familia
                    </span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Personas hogar</label>
                  <input
                    type="number"
                    min={householdType === 'solo' ? 1 : 2}
                    max={10}
                    value={householdMembers}
                    onChange={(event) =>
                      setHouseholdMembers(
                        clamp(
                          Number(event.target.value) || (householdType === 'solo' ? 1 : 2),
                          householdType === 'solo' ? 1 : 2,
                          10,
                        ),
                      )
                    }
                    className="w-full rounded-xl border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Personas a cargo</label>
                  <input
                    type="number"
                    min={0}
                    max={8}
                    disabled={householdType === 'solo'}
                    value={dependents}
                    onChange={(event) => setDependents(clamp(Number(event.target.value) || 0, 0, 8))}
                    className="w-full rounded-xl border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Situación laboral principal</label>
                <select
                  value={employmentStatus}
                  onChange={(event) => setEmploymentStatus(event.target.value as EmploymentStatus)}
                  className="w-full rounded-xl border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="funcionario">Funcionario/a</option>
                  <option value="cuenta_ajena_con_paro">Cuenta ajena con paro</option>
                  <option value="cuenta_ajena_sin_paro">Cuenta ajena sin paro</option>
                  <option value="autonomo_sin_paro">Autónomo/a o sin prestación</option>
                </select>
              </div>

              {employmentStatus === 'cuenta_ajena_con_paro' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Meses de paro estimados</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={24}
                      step={1}
                      value={unemploymentBenefitMonths}
                      onChange={(event) => setUnemploymentBenefitMonths(Number(event.target.value))}
                      className="flex-1 accent-cyan-600"
                    />
                    <span className="w-12 text-right text-sm font-medium">{unemploymentBenefitMonths}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Ingresos en el hogar</label>
                  <input
                    type="number"
                    min={1}
                    max={4}
                    value={incomeSources}
                    onChange={(event) => setIncomeSources(clamp(Number(event.target.value) || 1, 1, 4))}
                    className="w-full rounded-xl border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Capacidad de recorte</label>
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="range"
                      min={0}
                      max={40}
                      step={1}
                      value={cutCapacityPct}
                      onChange={(event) => setCutCapacityPct(Number(event.target.value))}
                      className="flex-1 accent-cyan-600"
                    />
                    <span className="w-12 text-right text-sm font-medium">{cutCapacityPct}%</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Dato extra para precisión: cuánto podrías reducir gastos no esenciales en caso de emergencia.
              </p>
            </div>

            <div className="space-y-3 rounded-2xl bg-white p-4 shadow">
              <h2 className="text-lg font-semibold">Gastos mensuales esenciales</h2>
              <EuroInput label="Vivienda (hipoteca o alquiler)" value={housingCost} onChange={setHousingCost} />
              <EuroInput label="Comida y supermercado" value={foodCost} onChange={setFoodCost} />
              <EuroInput label="Préstamos y deudas" value={loansCost} onChange={setLoansCost} />
              <EuroInput label="Suministros (luz, agua, internet)" value={utilitiesCost} onChange={setUtilitiesCost} />
              <EuroInput label="Transporte" value={transportCost} onChange={setTransportCost} />
              <EuroInput
                label="Salud, educación y seguros"
                value={healthEducationCost}
                onChange={setHealthEducationCost}
              />
              <EuroInput label="Otros gastos necesarios" value={otherEssentialCost} onChange={setOtherEssentialCost} />
            </div>

            <div className="space-y-4 rounded-2xl bg-white p-4 shadow">
              <h2 className="text-lg font-semibold">Objetivo del fondo</h2>

              <EuroInput label="Fondo actual disponible" value={currentFund} onChange={setCurrentFund} />

              <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-cyan-700">Meses automáticos</p>
                <p className="mt-1 text-2xl font-extrabold text-cyan-700">{recommendedMonths} meses</p>
                <p className="mt-1 text-xs text-cyan-700">
                  Calculado según: {statusLabel[employmentStatus]}, tipo de hogar, deudas, ingresos y capacidad de
                  ajuste.
                </p>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <label className="text-sm font-medium text-gray-700">Meses a cubrir (editable)</label>
                  {isMonthsCustomized && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMonthsCustomized(false);
                        setSelectedMonths(recommendedMonths);
                      }}
                      className="rounded-full border border-cyan-600 px-3 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-50"
                    >
                      Usar recomendado
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={24}
                    step={1}
                    value={selectedMonths}
                    onChange={(event) => {
                      setSelectedMonths(Number(event.target.value));
                      setIsMonthsCustomized(true);
                    }}
                    className="flex-1 accent-cyan-600"
                  />
                  <span className="w-14 text-right text-sm font-medium">{selectedMonths}</span>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Recomendación habitual general</p>
                <p className="text-sm font-semibold text-gray-800">Entre 6 y 12 meses</p>
                <p className="mt-1 text-xs text-gray-500">
                  Para perfiles estables (funcionario o con buena cobertura de paro) puede estar por debajo.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-2xl bg-white p-4 shadow">
              <p className="text-xs text-gray-500">Gasto esencial mensual</p>
              <p className="mt-1 text-2xl font-extrabold text-cyan-700">{formatEUR(totalEssentialMonthly)}</p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow">
              <p className="text-xs text-gray-500">Objetivo con meses elegidos</p>
              <p className="mt-1 text-2xl font-extrabold text-cyan-700">{formatEUR(selectedFundTarget)}</p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow">
              <p className="text-xs text-gray-500">Objetivo automático</p>
              <p className="mt-1 text-2xl font-extrabold text-cyan-700">{formatEUR(autoFundTarget)}</p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow">
              <p className="text-xs text-gray-500">Cobertura actual</p>
              <p className="mt-1 text-2xl font-extrabold text-cyan-700">{coveredMonths.toFixed(1)} meses</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className={`rounded-2xl border p-4 ${coverageColorClass[coverage.tone]}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.15em]">Diagnóstico</p>
              <h3 className="mt-1 text-xl font-extrabold">{coverage.title}</h3>
              <p className="mt-1 text-sm">{coverage.body}</p>

              <div className="mt-4">
                <p className="mb-1 text-xs">Cobertura frente a objetivo elegido</p>
                <div className="h-2 overflow-hidden rounded-full bg-white/80">
                  <div className="h-full rounded-full bg-current" style={{ width: `${coverageProgress}%` }} />
                </div>
              </div>

              <p className="mt-3 text-sm">
                {gapToSelected <= 0
                  ? `Ya alcanzas tu objetivo editable (${selectedMonths} meses).`
                  : `Te faltan ${formatEUR(gapToSelected)} para llegar a ${selectedMonths} meses.`}
              </p>

              {gapToAuto > 0 && (
                <p className="mt-1 text-sm">
                  Para tu estado actual ({statusLabel[employmentStatus]}), todavía faltarían {formatEUR(gapToAuto)}.
                </p>
              )}
            </div>

            <div className="rounded-2xl bg-white p-4 shadow">
              <h3 className="text-lg font-semibold">Resumen rápido</h3>
              <ul className="mt-3 space-y-2 text-sm text-gray-700">
                <li>
                  <span className="font-semibold">6 meses:</span> {formatEUR(range6To12Min)}
                </li>
                <li>
                  <span className="font-semibold">12 meses:</span> {formatEUR(range6To12Max)}
                </li>
                <li>
                  <span className="font-semibold">Objetivo editable ({selectedMonths} meses):</span>{' '}
                  {formatEUR(selectedFundTarget)}
                </li>
                <li>
                  <span className="font-semibold">Fondo actual:</span> {formatEUR(currentFund)}
                </li>
              </ul>

              <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                <p className="font-semibold">Cómo mejorar la precisión</p>
                <p className="mt-1">
                  Revisa estos datos cada pocos meses: gastos reales del hogar, si hay más de una fuente de ingresos y
                  el tiempo de cobertura por paro.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

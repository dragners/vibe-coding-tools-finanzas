import React, { useEffect, useId, useMemo, useRef, useState } from 'react';

type ThemeMode = 'light' | 'dark';
type Lang = 'es' | 'en';
type HouseholdType = 'solo' | 'familia';
type EmploymentStatus =
  | 'funcionario'
  | 'cuenta_ajena_con_paro'
  | 'cuenta_ajena_sin_paro'
  | 'autonomo_sin_paro';

const THEME_STORAGE_KEY = 'finanzas.theme';
const LANG_STORAGE_KEY = 'finanzas.lang';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getStoredThemeChoice = (): ThemeMode | null => {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : null;
};

const getStoredLang = (): Lang => {
  if (typeof window === 'undefined') return 'es';
  const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
  return stored === 'en' ? 'en' : 'es';
};

const resolveTheme = (themeChoice: ThemeMode | null): ThemeMode => {
  if (themeChoice) return themeChoice;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const texts = {
  es: {
    back: 'Volver al inicio',
    title: 'Fondo de Emergencia',
    shareLink: 'Link permanente',
    shareCopied: 'Link copiado',
    shareReady: 'Listo para compartir',
    subtitle:
      'Calcula cuánto dinero deberías tener para cubrir tus gastos esenciales si te quedas sin ingresos. La recomendación general suele estar entre 6 y 12 meses, pero puede variar según estabilidad laboral y situación familiar.',
    householdTitle: 'Perfil del hogar',
    forWhom: '¿Para quién es?',
    onlyMe: 'Solo yo',
    withFamily: 'Yo y mi familia',
    incomeCount: 'Número de ingresos',
    incomeCountInfo:
      'Número de personas que aportan ingresos laborales al mes. En "Yo y mi familia" se asumen 2 adultos y puedes indicar si entra 1 o 2 nóminas.',
    dependents: 'Personas a cargo',
    employmentStatus: 'Situación laboral por persona',
    workerPrefix: 'Persona',
    publicWorker: 'Funcionario/a',
    salariedWithBenefit: 'Cuenta ajena con paro',
    salariedNoBenefit: 'Cuenta ajena sin paro',
    selfEmployed: 'Autónomo/a o sin prestación',
    unemploymentMonths: 'Meses de paro estimados',
    expensesTitle: 'Gastos mensuales esenciales',
    housing: 'Vivienda (hipoteca o alquiler)',
    food: 'Comida y supermercado',
    loans: 'Préstamos y deudas',
    utilities: 'Suministros (luz, agua, internet)',
    transport: 'Transporte',
    healthEducation: 'Salud, educación y seguros',
    otherNecessary: 'Otros gastos necesarios',
    targetTitle: 'Objetivo del fondo',
    recommendedMonths: 'Meses recomendados',
    recommendedByProfile:
      'Calculado según estabilidad laboral, meses de paro estimados, tipo de hogar, deudas e ingresos.',
    monthsToCover: 'Meses a cubrir',
    useRecommended: 'Usar recomendado',
    emergencyFundTitle: 'Fondo de Emergencia',
    recommendationsTitle: 'Recomendaciones',
    recommendationsList: [
      'Como referencia general, suele recomendarse entre 6 y 12 meses de gastos esenciales.',
      'Si tu perfil es estable (por ejemplo, funcionario o con buena cobertura por desempleo), el objetivo puede ser menor.',
      'Mantén una parte del fondo disponible de inmediato para usar de un momento a otro.',
      'El resto puedes tenerlo en activos líquidos, como cuentas de ahorro y fondos de inversión.',
    ],
    referralTitle:
      'Si no tienes cuenta de ahorro en MyInvestor, puedes crearla usando el enlace de referido; así nos ayudas a crecer y te llevas 25€:',
    referralLinkLabel: 'Crear cuenta con MyInvestor',
    referralCode: 'El código de referido es: RQU46',
    footer: '© David Gonzalez, si quieres saber más sobre mí, visita',
    months: 'meses',
    themeSwitcher: 'Selector de tema',
    lightTheme: 'Tema claro',
    darkTheme: 'Tema oscuro',
    languageSwitcher: 'Selector de idioma',
  },
  en: {
    back: 'Back to home',
    title: 'Emergency Fund',
    shareLink: 'Permanent link',
    shareCopied: 'Link copied',
    shareReady: 'Ready to share',
    subtitle:
      'Estimate how much money you should keep to cover essential expenses if your income stops. The general recommendation is usually between 6 and 12 months, but it changes based on job stability and family situation.',
    householdTitle: 'Household profile',
    forWhom: 'Who is this for?',
    onlyMe: 'Only me',
    withFamily: 'Me and my family',
    incomeCount: 'Number of income sources',
    incomeCountInfo:
      'Number of people bringing labor income each month. In "Me and my family" we assume 2 adults, and you can set whether 1 or 2 salaries come in.',
    dependents: 'Dependents',
    employmentStatus: 'Employment status per worker',
    workerPrefix: 'Person',
    publicWorker: 'Public employee',
    salariedWithBenefit: 'Salaried with unemployment benefit',
    salariedNoBenefit: 'Salaried without unemployment benefit',
    selfEmployed: 'Self-employed / no benefit',
    unemploymentMonths: 'Estimated unemployment-benefit months',
    expensesTitle: 'Essential monthly expenses',
    housing: 'Housing (mortgage or rent)',
    food: 'Food and groceries',
    loans: 'Loans and debt',
    utilities: 'Utilities (electricity, water, internet)',
    transport: 'Transport',
    healthEducation: 'Health, education and insurance',
    otherNecessary: 'Other necessary expenses',
    targetTitle: 'Fund target',
    recommendedMonths: 'Recommended months',
    recommendedByProfile:
      'Calculated from job stability, estimated unemployment coverage, household profile, debt load and income sources.',
    monthsToCover: 'Months to cover',
    useRecommended: 'Use recommended',
    emergencyFundTitle: 'Emergency Fund',
    recommendationsTitle: 'Recommendations',
    recommendationsList: [
      'As a general benchmark, people often target between 6 and 12 months of essential expenses.',
      'For stable profiles (for example, public employees or people with strong unemployment coverage), the target can be lower.',
      'Keep part of the fund immediately available so you can use it right away.',
      'You can keep the rest in liquid assets, such as savings accounts and investment funds.',
    ],
    referralTitle:
      "If you don't have a savings account in MyInvestor, you can create one using the referral link; this helps us grow and gives you €25:",
    referralLinkLabel: 'Create a MyInvestor account',
    referralCode: 'Referral code is: RQU46',
    footer: '© David Gonzalez, want to know more about me? Visit',
    months: 'months',
    themeSwitcher: 'Theme switcher',
    lightTheme: 'Light theme',
    darkTheme: 'Dark theme',
    languageSwitcher: 'Language switcher',
  },
} as const;

const statusMonthsBase: Record<EmploymentStatus, number> = {
  funcionario: 5,
  cuenta_ajena_con_paro: 6,
  cuenta_ajena_sin_paro: 8,
  autonomo_sin_paro: 10,
};

const EMPLOYMENT_STATUS_VALUES: EmploymentStatus[] = [
  'funcionario',
  'cuenta_ajena_con_paro',
  'cuenta_ajena_sin_paro',
  'autonomo_sin_paro',
];

const isEmploymentStatus = (value: unknown): value is EmploymentStatus =>
  typeof value === 'string' && EMPLOYMENT_STATUS_VALUES.includes(value as EmploymentStatus);

function computeRecommendedMonths(params: {
  employmentStatuses: EmploymentStatus[];
  unemploymentBenefitMonthsByWorker: number[];
  householdType: HouseholdType;
  dependents: number;
  incomeSources: number;
  housingCost: number;
  loansCost: number;
  totalEssential: number;
}): number {
  const {
    employmentStatuses,
    unemploymentBenefitMonthsByWorker,
    householdType,
    dependents,
    incomeSources,
    housingCost,
    loansCost,
    totalEssential,
  } = params;

  const baseMonthsByWorker =
    employmentStatuses.length > 0
      ? employmentStatuses.map((status) => statusMonthsBase[status])
      : [statusMonthsBase.autonomo_sin_paro];
  let months =
    baseMonthsByWorker.reduce((sum, monthsValue) => sum + monthsValue, 0) /
    baseMonthsByWorker.length;

  const assumedAdults = householdType === 'solo' ? 1 : 2;
  if (assumedAdults === 2) months += 1;
  if (dependents >= 1) months += 1;
  if (dependents >= 3) months += 1;

  if (incomeSources >= 2) months -= 1;
  if (incomeSources <= 1) months += 1;

  const debtWeight = totalEssential > 0 ? (housingCost + loansCost) / totalEssential : 0;
  if (debtWeight >= 0.45) months += 1;

  const unemploymentMonths = employmentStatuses
    .map((status, index) =>
      status === 'cuenta_ajena_con_paro' ? unemploymentBenefitMonthsByWorker[index] ?? 12 : null,
    )
    .filter((value): value is number => value !== null);
  if (unemploymentMonths.length > 0) {
    const weakestCoverageMonths = Math.min(...unemploymentMonths);
    if (weakestCoverageMonths >= 12) months -= 1;
    if (weakestCoverageMonths <= 4) months += 1;
  }

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

function InfoTip({
  content,
  label = 'Info',
  side = 'bottom',
  className = '',
}: {
  content: React.ReactNode;
  label?: string;
  side?: 'top' | 'bottom';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: Event) => {
      const target = event.target as Node;
      if (btnRef.current?.contains(target) || popRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] align-middle focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
          open ? 'border-cyan-400 bg-cyan-50 text-cyan-700' : 'border-gray-300 bg-white text-gray-600'
        }`}
      >
        i
      </button>
      {open && (
        <div
          ref={popRef}
          id={id}
          role="tooltip"
          className={`absolute left-1/2 z-50 w-[360px] max-w-[92vw] -translate-x-1/2 rounded-lg border bg-white p-2.5 text-xs text-gray-700 shadow-lg ${
            side === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'
          }`}
        >
          {content}
        </div>
      )}
    </span>
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
  const [lang, setLang] = useState<Lang>(getStoredLang);
  const [themeChoice, setThemeChoice] = useState<ThemeMode | null>(getStoredThemeChoice);
  const activeTheme = resolveTheme(themeChoice);
  const t = texts[lang];
  const locale = lang === 'es' ? 'es-ES' : 'en-GB';

  const formatEUR = (value: number): string =>
    value.toLocaleString(locale, {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    });

  const [householdType, setHouseholdType] = useState<HouseholdType>('solo');
  const [dependents, setDependents] = useState(0);
  const [incomeSources, setIncomeSources] = useState(1);
  const [employmentStatuses, setEmploymentStatuses] = useState<EmploymentStatus[]>([
    'cuenta_ajena_con_paro',
  ]);
  const [unemploymentBenefitMonthsByWorker, setUnemploymentBenefitMonthsByWorker] = useState<number[]>([12]);

  const [housingCost, setHousingCost] = useState(900);
  const [foodCost, setFoodCost] = useState(350);
  const [loansCost, setLoansCost] = useState(150);
  const [utilitiesCost, setUtilitiesCost] = useState(150);
  const [transportCost, setTransportCost] = useState(120);
  const [healthEducationCost, setHealthEducationCost] = useState(80);
  const [otherEssentialCost, setOtherEssentialCost] = useState(100);

  const [isMonthsCustomized, setIsMonthsCustomized] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    if (householdType === 'solo') {
      setDependents(0);
      setIncomeSources(1);
      return;
    }
    setIncomeSources((previous) => clamp(previous, 1, 2));
  }, [householdType]);

  useEffect(() => {
    setEmploymentStatuses((previous) => {
      if (previous.length === incomeSources) return previous;
      if (previous.length > incomeSources) return previous.slice(0, incomeSources);
      return [
        ...previous,
        ...Array.from({ length: incomeSources - previous.length }, () => 'cuenta_ajena_con_paro' as EmploymentStatus),
      ];
    });
  }, [incomeSources]);

  useEffect(() => {
    setUnemploymentBenefitMonthsByWorker((previous) => {
      if (previous.length === incomeSources) return previous;
      if (previous.length > incomeSources) return previous.slice(0, incomeSources);
      return [...previous, ...Array.from({ length: incomeSources - previous.length }, () => 12)];
    });
  }, [incomeSources]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);

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
        employmentStatuses,
        unemploymentBenefitMonthsByWorker,
        householdType,
        dependents,
        incomeSources,
        housingCost,
        loansCost,
        totalEssential: totalEssentialMonthly,
      }),
    [
      employmentStatuses,
      unemploymentBenefitMonthsByWorker,
      householdType,
      dependents,
      incomeSources,
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

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const raw = params.get('s');
    if (!raw) return;

    try {
      const data: unknown = JSON.parse(atob(raw));
      if (!data || typeof data !== 'object') return;
      const shareData = data as Record<string, unknown>;

      const sharedHouseholdType =
        shareData.hh === 'solo' || shareData.hh === 'familia' ? shareData.hh : null;
      const resolvedHouseholdType: HouseholdType = sharedHouseholdType ?? 'solo';
      const maxIncomeSources = resolvedHouseholdType === 'solo' ? 1 : 2;

      if (sharedHouseholdType) {
        setHouseholdType(sharedHouseholdType);
      }

      const sharedIncomeSources =
        typeof shareData.inc === 'number' && Number.isFinite(shareData.inc)
          ? clamp(Math.round(shareData.inc), 1, maxIncomeSources)
          : null;

      const sharedEmploymentStatuses = Array.isArray(shareData.es)
        ? shareData.es.filter(isEmploymentStatus).slice(0, maxIncomeSources)
        : [];

      const targetIncomeSources =
        sharedIncomeSources ??
        (sharedEmploymentStatuses.length > 0
          ? clamp(sharedEmploymentStatuses.length, 1, maxIncomeSources)
          : null);

      if (targetIncomeSources !== null) {
        setIncomeSources(targetIncomeSources);
      }

      if (typeof shareData.dep === 'number' && Number.isFinite(shareData.dep)) {
        setDependents(
          resolvedHouseholdType === 'solo' ? 0 : clamp(Math.round(shareData.dep), 0, 8),
        );
      }

      const normalizedWorkers =
        targetIncomeSources ?? clamp(sharedEmploymentStatuses.length || 1, 1, maxIncomeSources);

      if (sharedEmploymentStatuses.length > 0) {
        const normalizedStatuses = [
          ...sharedEmploymentStatuses.slice(0, normalizedWorkers),
          ...Array.from(
            { length: Math.max(0, normalizedWorkers - sharedEmploymentStatuses.length) },
            () => 'cuenta_ajena_con_paro' as EmploymentStatus,
          ),
        ];
        setEmploymentStatuses(normalizedStatuses);
      }

      if (Array.isArray(shareData.ubm)) {
        const normalizedUnemploymentMonths = shareData.ubm
          .slice(0, normalizedWorkers)
          .map((value) =>
            typeof value === 'number' && Number.isFinite(value)
              ? clamp(Math.round(value), 0, 24)
              : 12,
          );
        while (normalizedUnemploymentMonths.length < normalizedWorkers) {
          normalizedUnemploymentMonths.push(12);
        }
        setUnemploymentBenefitMonthsByWorker(normalizedUnemploymentMonths);
      }

      if (typeof shareData.h === 'number' && Number.isFinite(shareData.h)) {
        setHousingCost(clamp(Math.round(shareData.h), 0, 999_999));
      }
      if (typeof shareData.f === 'number' && Number.isFinite(shareData.f)) {
        setFoodCost(clamp(Math.round(shareData.f), 0, 999_999));
      }
      if (typeof shareData.l === 'number' && Number.isFinite(shareData.l)) {
        setLoansCost(clamp(Math.round(shareData.l), 0, 999_999));
      }
      if (typeof shareData.u === 'number' && Number.isFinite(shareData.u)) {
        setUtilitiesCost(clamp(Math.round(shareData.u), 0, 999_999));
      }
      if (typeof shareData.t === 'number' && Number.isFinite(shareData.t)) {
        setTransportCost(clamp(Math.round(shareData.t), 0, 999_999));
      }
      if (typeof shareData.he === 'number' && Number.isFinite(shareData.he)) {
        setHealthEducationCost(clamp(Math.round(shareData.he), 0, 999_999));
      }
      if (typeof shareData.o === 'number' && Number.isFinite(shareData.o)) {
        setOtherEssentialCost(clamp(Math.round(shareData.o), 0, 999_999));
      }

      const sharedSelectedMonths =
        typeof shareData.sm === 'number' && Number.isFinite(shareData.sm)
          ? clamp(Math.round(shareData.sm), 0, 24)
          : null;
      if (sharedSelectedMonths !== null) {
        setSelectedMonths(sharedSelectedMonths);
      }

      if (typeof shareData.mc === 'boolean') {
        setIsMonthsCustomized(shareData.mc);
      } else if (sharedSelectedMonths !== null) {
        setIsMonthsCustomized(true);
      }
    } catch {
      // Ignore invalid share links.
    }
  }, []);

  const updateEmploymentStatus = (index: number, status: EmploymentStatus) => {
    setEmploymentStatuses((previous) => {
      const next = [...previous];
      next[index] = status;
      return next;
    });
  };

  const updateUnemploymentMonths = (index: number, value: number) => {
    setUnemploymentBenefitMonthsByWorker((previous) => {
      const next = [...previous];
      next[index] = clamp(value, 0, 24);
      return next;
    });
  };

  const onShare = async () => {
    if (typeof window === 'undefined') return;

    const payload = btoa(
      JSON.stringify({
        hh: householdType,
        dep: dependents,
        inc: incomeSources,
        es: employmentStatuses.slice(0, incomeSources),
        ubm: unemploymentBenefitMonthsByWorker.slice(0, incomeSources),
        h: housingCost,
        f: foodCost,
        l: loansCost,
        u: utilitiesCost,
        t: transportCost,
        he: healthEducationCost,
        o: otherEssentialCost,
        sm: selectedMonths,
        mc: isMonthsCustomized,
      }),
    );

    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('s', payload);
    const nextUrl = url.toString();
    setShareUrl(nextUrl);
    setShareCopied(false);

    try {
      await navigator.clipboard.writeText(nextUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      // Clipboard can be unavailable in some browsers.
    }
  };

  const selectedFundTarget = totalEssentialMonthly * selectedMonths;

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
              <span aria-hidden="true">&larr;</span> {t.back}
            </a>

            <div className="flex items-center gap-2">
              <div
                className="inline-flex gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm"
                role="group"
                aria-label={t.themeSwitcher}
              >
                <button
                  type="button"
                  onClick={() => setThemeChoice('light')}
                  aria-label={t.lightTheme}
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
                  aria-label={t.darkTheme}
                  aria-pressed={activeTheme === 'dark'}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                    activeTheme === 'dark' ? 'bg-cyan-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <MoonIcon />
                </button>
              </div>

              <div
                className="inline-flex gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm"
                role="group"
                aria-label={t.languageSwitcher}
              >
                {(['es', 'en'] as Lang[]).map((nextLang) => (
                  <button
                    key={nextLang}
                    type="button"
                    onClick={() => setLang(nextLang)}
                    aria-pressed={lang === nextLang}
                    className={`inline-flex h-9 min-w-[44px] items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                      lang === nextLang ? 'bg-cyan-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {nextLang.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-6xl space-y-6 p-6">
          <div>
            <h1 className="text-3xl font-extrabold md:text-4xl">{t.title}</h1>
            <p className="mt-2 max-w-4xl text-sm text-gray-700 md:text-base">{t.subtitle}</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-4 rounded-2xl bg-white p-4 shadow">
              <h2 className="text-lg font-semibold">{t.householdTitle}</h2>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t.forWhom}</label>
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
                      {t.onlyMe}
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
                      {t.withFamily}
                    </span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t.incomeCount}
                    <InfoTip content={t.incomeCountInfo} label={t.incomeCount} className="ml-1" />
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={householdType === 'solo' ? 1 : 2}
                    disabled={householdType === 'solo'}
                    value={incomeSources}
                    onChange={(event) =>
                      setIncomeSources(
                        clamp(Number(event.target.value) || 1, 1, householdType === 'solo' ? 1 : 2),
                      )
                    }
                    className="w-full rounded-xl border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">{t.dependents}</label>
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
                <label className="mb-1 block text-sm font-medium text-gray-700">{t.employmentStatus}</label>
                <div className="space-y-2">
                  {employmentStatuses.map((status, index) => (
                    <div key={index}>
                      <label className="mb-1 block text-xs font-medium text-gray-500">
                        {t.workerPrefix} {index + 1}
                      </label>
                      <select
                        value={status}
                        onChange={(event) => updateEmploymentStatus(index, event.target.value as EmploymentStatus)}
                        className="w-full rounded-xl border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        <option value="funcionario">{t.publicWorker}</option>
                        <option value="cuenta_ajena_con_paro">{t.salariedWithBenefit}</option>
                        <option value="cuenta_ajena_sin_paro">{t.salariedNoBenefit}</option>
                        <option value="autonomo_sin_paro">{t.selfEmployed}</option>
                      </select>
                      {status === 'cuenta_ajena_con_paro' && (
                        <div className="mt-2">
                          <label className="mb-1 block text-xs font-medium text-gray-500">{t.unemploymentMonths}</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min={0}
                              max={24}
                              step={1}
                              value={unemploymentBenefitMonthsByWorker[index] ?? 12}
                              onChange={(event) => updateUnemploymentMonths(index, Number(event.target.value) || 0)}
                              className="flex-1 accent-cyan-600"
                            />
                            <span className="w-12 text-right text-sm font-medium">
                              {unemploymentBenefitMonthsByWorker[index] ?? 12}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {employmentStatuses.length === 0 && (
                    <p className="text-xs text-gray-500">{t.incomeCountInfo}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl bg-white p-4 shadow">
              <h2 className="text-lg font-semibold">{t.expensesTitle}</h2>
              <EuroInput label={t.housing} value={housingCost} onChange={setHousingCost} />
              <EuroInput label={t.food} value={foodCost} onChange={setFoodCost} />
              <EuroInput label={t.loans} value={loansCost} onChange={setLoansCost} />
              <EuroInput label={t.utilities} value={utilitiesCost} onChange={setUtilitiesCost} />
              <EuroInput label={t.transport} value={transportCost} onChange={setTransportCost} />
              <EuroInput label={t.healthEducation} value={healthEducationCost} onChange={setHealthEducationCost} />
              <EuroInput label={t.otherNecessary} value={otherEssentialCost} onChange={setOtherEssentialCost} />
            </div>

            <div className="space-y-4 rounded-2xl bg-white p-4 shadow">
              <h2 className="text-lg font-semibold">{t.targetTitle}</h2>

              <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-cyan-700">{t.recommendedMonths}</p>
                <p className="mt-1 text-2xl font-extrabold text-cyan-700">
                  {recommendedMonths} {t.months}
                </p>
                <p className="mt-1 text-xs text-cyan-700">{t.recommendedByProfile}</p>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <label className="text-sm font-medium text-gray-700">{t.monthsToCover}</label>
                  {isMonthsCustomized && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMonthsCustomized(false);
                        setSelectedMonths(recommendedMonths);
                      }}
                      className="rounded-full border border-cyan-600 px-3 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-50"
                    >
                      {t.useRecommended}
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

              <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-cyan-700">
                  {t.emergencyFundTitle}
                </p>
                <p className="mt-1 text-3xl font-extrabold text-cyan-700">{formatEUR(selectedFundTarget)}</p>
                <p className="mt-1 text-xs text-cyan-700">
                  {selectedMonths} {t.months} x {formatEUR(totalEssentialMonthly)}
                </p>
                <div className="no-print mt-3 border-t border-cyan-200 pt-3">
                  <button
                    type="button"
                    onClick={onShare}
                    className="rounded-full border border-cyan-600 bg-cyan-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:border-cyan-700 hover:bg-cyan-700"
                  >
                    {t.shareLink}
                  </button>
                  {shareUrl && (
                    <div className="mt-3 rounded-xl border border-cyan-200 bg-white p-3 text-xs text-gray-600">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">{t.shareReady}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <input
                          type="text"
                          value={shareUrl}
                          readOnly
                          className="min-w-[220px] flex-1 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs text-gray-700 shadow-sm"
                        />
                        {shareCopied && (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                            {t.shareCopied}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow">
            <h3 className="text-lg font-semibold text-gray-900">{t.recommendationsTitle}</h3>
            <ul className="mt-3 space-y-2 text-sm text-gray-700">
              {t.recommendationsList.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-[2px] text-cyan-600">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="keep-light-panel mt-6 rounded-2xl border border-cyan-200 bg-cyan-50 p-5 text-sm text-cyan-900">
              <p className="text-[15px] font-semibold text-cyan-900">{t.referralTitle}</p>
              <ul className="mt-3 space-y-1 text-sm">
                <li>
                  •{' '}
                  <a
                    href="https://newapp.myinvestor.es/do/signup?promotionalCode=RQU46"
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-cyan-700 underline"
                  >
                    {t.referralLinkLabel}
                  </a>
                </li>
                <li>• {t.referralCode}</li>
              </ul>
            </div>
          </div>

          <footer className="text-sm text-gray-500">
            <span>{t.footer}</span>{' '}
            <a href="https://dragner.net/" target="_blank" rel="noreferrer" className="text-cyan-600 hover:underline">
              dragner.net
            </a>
          </footer>

        </div>
      </div>
    </>
  );
}

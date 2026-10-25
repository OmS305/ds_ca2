"use client";

import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ChevronDown,
  CloudRain,
  Database,
  Download,
  Droplets,
  Gauge,
  Menu,
  Sparkles,
  Thermometer,
  Wind,
  X,
  Zap,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipProps } from "recharts";
import type { EnergyObservation } from "@/app/api/energy/route";
import NotebookAnalysis from "@/components/notebook-analysis";

type TimeRange = "7D" | "30D" | "90D" | "ALL";
type ChartPoint = EnergyObservation & { sampleCount: number };

const ranges: TimeRange[] = ["7D", "30D", "90D", "ALL"];

const numberFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

function formatDate(date: string, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
    ...options,
  }).format(new Date(`${date}T12:00:00Z`));
}

function average(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function makeChartPoints(
  observations: EnergyObservation[],
  range: TimeRange,
): ChartPoint[] {
  const groupSize = range === "ALL" ? 30 : range === "90D" ? 3 : 1;

  return Array.from(
    { length: Math.ceil(observations.length / groupSize) },
    (_, index) => {
      const group = observations.slice(
        index * groupSize,
        (index + 1) * groupSize,
      );
      const last = group[group.length - 1];

      return {
        ...last,
        consumption: average(group.map((row) => row.consumption)),
        sampleCount: group.length,
      };
    },
  );
}

function ConsumptionTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload?.length || typeof label !== "string") return null;

  const point = payload[0].payload as ChartPoint;

  return (
    <div className="chart-tooltip">
      <span className="tooltip-date">{formatDate(label)}</span>
      <strong>{numberFormat.format(Number(payload[0].value))}</strong>
      <span className="tooltip-unit">
        {point.sampleCount > 1
          ? `average across ${point.sampleCount} days`
          : "daily consumption · dataset units"}
      </span>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  accent,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  detail: string;
  accent: "mint" | "cyan" | "gold" | "neutral";
}) {
  return (
    <article className={`metric-card metric-${accent}`}>
      <div className="metric-topline">
        <span className="metric-label">{label}</span>
        <span className="metric-icon">
          <Icon size={17} strokeWidth={1.65} />
        </span>
      </div>
      <div className="metric-value">{value}</div>
      <span className="metric-detail">{detail}</span>
    </article>
  );
}

export default function EnergyDashboard() {
  const [observations, setObservations] = useState<EnergyObservation[]>([]);
  const [range, setRange] = useState<TimeRange>("90D");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    let cancelled = false;

    async function loadObservations() {
      try {
        const response = await fetch("/api/energy");
        if (!response.ok) {
          const result = (await response.json()) as { error?: string };
          throw new Error(result.error ?? "Could not load the dataset.");
        }
        const data = (await response.json()) as EnergyObservation[];
        if (!cancelled) setObservations(data);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load the dataset.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadObservations();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedObservations = useMemo(() => {
    const days = range === "ALL" ? observations.length : Number.parseInt(range);
    return observations.slice(-days);
  }, [observations, range]);
  const chartData = useMemo(
    () => makeChartPoints(selectedObservations, range),
    [selectedObservations, range],
  );
  const stats = useMemo(() => {
    if (selectedObservations.length === 0) return null;
    const consumption = selectedObservations.map((row) => row.consumption);
    return {
      average: average(consumption),
      peak: Math.max(...consumption),
      minimum: Math.min(...consumption),
    };
  }, [selectedObservations]);
  const firstDate = selectedObservations[0]?.date;
  const lastObservation = selectedObservations.at(-1);

  function downloadCsv() {
    const header =
      "date,average_wind,precipitation,max_temperature,min_temperature,daily_consumption";
    const rows = selectedObservations.map((row) =>
      [
        row.date,
        row.wind,
        row.precipitation,
        row.maxTemperature,
        row.minTemperature,
        row.consumption,
      ].join(","),
    );
    const file = new Blob([[header, ...rows].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(file);
    link.download = `solstice-energy-${range.toLowerCase()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1_000);
  }

  const entrance = reduceMotion
    ? { initial: false as const, animate: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
      };

  return (
    <main className="app-shell">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <a className="brand" href="#overview" aria-label="Solstice home">
          <span className="brand-mark">
            <svg viewBox="0 0 36 36" fill="none" aria-hidden="true">
              <circle cx="18" cy="18" r="13" stroke="currentColor" />
              <path
                d="M8 21.5h20M11 16.5h14M15 11.5h6M18 5v5.5M12 26.5h12"
                stroke="currentColor"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="brand-copy">
            <strong>solstice</strong>
            <span>ENERGY INTELLIGENCE</span>
          </span>
          <button
            className="mobile-menu-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation"
          >
            <X size={19} />
          </button>
        </a>

        <div className="sidebar-section-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <a
            href="#overview"
            className="nav-link nav-link-active"
            onClick={() => setMenuOpen(false)}
          >
            <Activity size={18} strokeWidth={1.75} />
            <span>Overview</span>
            <span className="nav-live-dot" />
          </a>
          <a href="#consumption" className="nav-link" onClick={() => setMenuOpen(false)}>
            <Zap size={18} strokeWidth={1.7} />
            <span>Consumption</span>
          </a>
          <a href="#weather" className="nav-link" onClick={() => setMenuOpen(false)}>
            <CloudRain size={18} strokeWidth={1.7} />
            <span>Weather signals</span>
          </a>
          <a href="#analysis-tabs" className="nav-link" onClick={() => setMenuOpen(false)}>
            <BarChart3 size={18} strokeWidth={1.7} />
            <span>Analysis &amp; results</span>
          </a>
        </nav>

        <div className="sidebar-bottom">
          <div className="archive-card">
            <span className="archive-icon"><Database size={16} /></span>
            <div>
              <strong>Research archive</strong>
              <span>2006 — 2010 · DAILY</span>
            </div>
            <span className="archive-status" />
          </div>
          <div className="sidebar-profile">
            <div className="profile-avatar">S</div>
            <div className="profile-copy">
              <strong>Solstice lab</strong>
              <span>Energy research</span>
            </div>
            <ChevronDown size={15} className="profile-chevron" />
          </div>
        </div>
      </aside>

      {menuOpen && (
        <button
          className="mobile-scrim"
          onClick={() => setMenuOpen(false)}
          aria-label="Close navigation menu"
        />
      )}

      <section className="main-panel" id="overview">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu-button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <span className="breadcrumb-slash">/</span>
            <strong>Overview</strong>
          </div>
          <div className="topbar-actions">
            <span className="archive-pill">
              <span className="status-dot" />
              Historical dataset
            </span>
            <button
              className="export-button"
              onClick={downloadCsv}
              disabled={loading || Boolean(error)}
            >
              <Download size={15} />
              <span>Export data</span>
            </button>
            <button className="help-button" aria-label="Dataset information">
              <Sparkles size={17} strokeWidth={1.7} />
            </button>
          </div>
        </header>

        <div className="dashboard-content">
          <motion.section
            className="hero"
            {...entrance}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <div className="hero-copy">
              <div className="eyebrow">
                <span className="eyebrow-line" />
                ENERGY, IN CONTEXT
              </div>
              <h1>
                A clearer picture
                <br />
                of <span>energy.</span>
              </h1>
              <p>
                Daily electricity use, seen alongside the weather that shapes
                it. Grounded in four years of real observations.
              </p>
              <a className="text-link" href="#consumption">
                Explore the data <span aria-hidden="true">↗</span>
              </a>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="art-halo art-halo-outer" />
              <div className="art-halo art-halo-middle" />
              <div className="art-halo art-halo-inner" />
              <div className="art-sun" />
              <div className="art-horizon" />
              <div className="art-label art-label-top">SOLAR HORIZON <span>01</span></div>
              <div className="art-label art-label-bottom">A MORE LUMINOUS FUTURE</div>
              <span className="art-coordinate art-coordinate-left">FIELD / 01</span>
              <span className="art-coordinate art-coordinate-right">ENERGY / 04</span>
              <i className="art-star art-star-one" />
              <i className="art-star art-star-two" />
              <i className="art-star art-star-three" />
            </div>
            <div className="hero-footnote">
              <CalendarDays size={14} strokeWidth={1.7} />
              <span>
                {observations.length > 0
                  ? `${formatDate(observations[0].date, { month: "short", year: "numeric" })} — ${formatDate(observations.at(-1)!.date, { month: "short", year: "numeric" })}`
                  : "Daily observation archive"}
              </span>
              <span className="footnote-separator" />
              <span>DAILY OBSERVATIONS</span>
            </div>
          </motion.section>

          {error ? (
            <div className="data-message data-error" role="alert">
              <Database size={19} />
              <div>
                <strong>Couldn’t load the energy archive</strong>
                <span>{error}</span>
              </div>
            </div>
          ) : (
            <NotebookAnalysis
              observations={observations}
              overview={
                <>
              <motion.section
                className="metrics-grid"
                aria-label="Consumption summary"
                {...entrance}
                transition={{ duration: 0.45, delay: 0.08, ease: "easeOut" }}
              >
                <MetricCard
                  icon={Activity}
                  label="Average daily use"
                  value={stats ? numberFormat.format(stats.average) : "—"}
                  detail="dataset units · selected period"
                  accent="mint"
                />
                <MetricCard
                  icon={ArrowUpRight}
                  label="Highest observation"
                  value={stats ? numberFormat.format(stats.peak) : "—"}
                  detail="daily consumption · selected period"
                  accent="gold"
                />
                <MetricCard
                  icon={ArrowDownRight}
                  label="Lowest observation"
                  value={stats ? numberFormat.format(stats.minimum) : "—"}
                  detail="daily consumption · selected period"
                  accent="cyan"
                />
                <MetricCard
                  icon={CalendarDays}
                  label="Days in view"
                  value={selectedObservations.length.toLocaleString("en-US")}
                  detail="daily observations"
                  accent="neutral"
                />
              </motion.section>

              <motion.section
                className="chart-card"
                id="consumption"
                aria-labelledby="consumption-title"
                {...entrance}
                transition={{ duration: 0.5, delay: 0.14, ease: "easeOut" }}
              >
                <div className="chart-heading">
                  <div>
                    <div className="section-overline">
                      <span className="section-dot" />
                      OBSERVED ELECTRICITY
                    </div>
                    <h2 id="consumption-title">Consumption over time</h2>
                    <p>
                      {firstDate && lastObservation
                        ? `${formatDate(firstDate, { month: "short" })} — ${formatDate(lastObservation.date)}`
                        : "Daily records from the energy archive"}
                      <span className="heading-divider">·</span>
                      {range === "ALL" ? "30-day averages" : range === "90D" ? "3-day averages" : "Daily readings"}
                    </p>
                  </div>
                  <div className="range-control" role="group" aria-label="Chart date range">
                    {ranges.map((item) => (
                      <button
                        key={item}
                        className={range === item ? "range-button range-active" : "range-button"}
                        onClick={() => setRange(item)}
                        aria-pressed={range === item}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                {loading ? (
                  <div className="chart-loading" aria-label="Loading chart">
                    <span />
                  </div>
                ) : (
                  <div className="chart-wrap">
                    <div className="chart-unit-label">CONSUMPTION · DATASET UNITS</div>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={chartData}
                        margin={{ top: 22, right: 10, left: 2, bottom: 4 }}
                      >
                        <defs>
                          <linearGradient id="consumptionFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#A8FFCB" stopOpacity={0.23} />
                            <stop offset="92%" stopColor="#73E7E0" stopOpacity={0.015} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          vertical={false}
                          stroke="rgba(184, 219, 198, 0.085)"
                          strokeDasharray="3 7"
                        />
                        <XAxis
                          dataKey="date"
                          axisLine={false}
                          tickLine={false}
                          minTickGap={42}
                          tick={{ fill: "#758c80", fontSize: 11, fontFamily: "var(--font-ibm-plex-mono)" }}
                          tickFormatter={(date: string) =>
                            formatDate(date, range === "ALL" ? { month: "short", year: "2-digit" } : { month: "short", day: "numeric" })
                          }
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          width={54}
                          tick={{ fill: "#758c80", fontSize: 11, fontFamily: "var(--font-ibm-plex-mono)" }}
                          tickFormatter={(value: number) => numberFormat.format(value)}
                        />
                        <Tooltip
                          content={<ConsumptionTooltip />}
                          cursor={{ stroke: "rgba(168, 255, 203, 0.3)", strokeDasharray: "4 5" }}
                        />
                        <Area
                          type="monotone"
                          dataKey="consumption"
                          stroke="#A8FFCB"
                          strokeWidth={2}
                          fill="url(#consumptionFill)"
                          activeDot={{ r: 4, fill: "#A8FFCB", stroke: "#102820", strokeWidth: 2 }}
                          animationDuration={reduceMotion ? 0 : 700}
                          isAnimationActive={!reduceMotion}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div className="chart-footer">
                  <div className="chart-legend">
                    <span className="legend-line" />
                    <span>Daily electricity use</span>
                  </div>
                  <span className="chart-footnote">
                    {range === "ALL" || range === "90D"
                      ? "Grouped averages · original observations preserved"
                      : "Source: electricity & weather dataset"}
                  </span>
                </div>
              </motion.section>

              <div className="detail-grid">
                <motion.section
                  className="detail-card weather-card"
                  id="weather"
                  {...entrance}
                  transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
                >
                  <div className="detail-heading">
                    <div>
                      <div className="section-overline">
                        <span className="section-dot section-dot-cyan" />
                        WEATHER CONTEXT
                      </div>
                      <h2>Signals in the atmosphere</h2>
                    </div>
                    <span className="detail-icon"><Wind size={18} /></span>
                  </div>
                  <p className="detail-description">
                    The latest recorded conditions alongside the electricity
                    series.
                  </p>
                  {lastObservation && (
                    <>
                      <div className="weather-readings">
                        <div className="weather-reading">
                          <span className="weather-reading-icon"><Thermometer size={16} /></span>
                          <span className="reading-name">Temperature</span>
                          <strong>
                            {lastObservation.minTemperature.toFixed(1)}°
                            <span> — </span>
                            {lastObservation.maxTemperature.toFixed(1)}°
                          </strong>
                          <span className="reading-note">low — high</span>
                        </div>
                        <div className="weather-reading">
                          <span className="weather-reading-icon"><Wind size={16} /></span>
                          <span className="reading-name">Average wind</span>
                          <strong>{lastObservation.wind.toFixed(1)}</strong>
                          <span className="reading-note">dataset value</span>
                        </div>
                        <div className="weather-reading">
                          <span className="weather-reading-icon"><Droplets size={16} /></span>
                          <span className="reading-name">Precipitation</span>
                          <strong>{lastObservation.precipitation.toFixed(1)}</strong>
                          <span className="reading-note">dataset value</span>
                        </div>
                      </div>
                      <div className="weather-date">
                        <span className="weather-date-dot" />
                        Observed {formatDate(lastObservation.date)}
                      </div>
                    </>
                  )}
                </motion.section>

                <motion.section
                  className="detail-card research-card"
                  id="research"
                  {...entrance}
                  transition={{ duration: 0.5, delay: 0.26, ease: "easeOut" }}
                >
                  <div className="detail-heading">
                    <div>
                      <div className="section-overline">
                        <span className="section-dot section-dot-gold" />
                        FROM THE NOTEBOOK
                      </div>
                      <h2>Weather meets demand</h2>
                    </div>
                    <span className="detail-icon detail-icon-gold"><Gauge size={18} /></span>
                  </div>
                  <p className="detail-description research-description">
                    This archive pairs daily consumption with four atmospheric
                    signals to explore how conditions and demand move together.
                  </p>
                  <div className="signal-tags" aria-label="Weather variables">
                    <span><Thermometer size={13} /> Temperature</span>
                    <span><Wind size={13} /> Wind</span>
                    <span><CloudRain size={13} /> Precipitation</span>
                  </div>
                  <div className="research-divider" />
                  <div className="model-line">
                    <div>
                      <strong>Three approaches, one question.</strong>
                      <span>Regression methods in the analysis notebook</span>
                    </div>
                    <div className="model-badges">
                      <span>MLR</span>
                      <span>LASSO</span>
                      <span>RIDGE</span>
                    </div>
                  </div>
                </motion.section>
              </div>
            </>
              }
            />
          )}

          <footer className="page-footer">
            <div className="footer-brand"><span>☼</span> SOLSTICE <i>·</i> ENERGY INTELLIGENCE</div>
            <div className="footer-source">
              <span>{observations.length.toLocaleString("en-US")} DAILY RECORDS</span>
              <span className="footer-separator">·</span>
              <span>2006 — 2010</span>
              <span className="footer-separator">·</span>
              <span>RESEARCH ARCHIVE</span>
            </div>
          </footer>
        </div>
      </section>
    </main>
  );
}

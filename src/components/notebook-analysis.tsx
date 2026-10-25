"use client";

import {
  Activity,
  BarChart3,
  ChartNoAxesCombined,
  ClipboardList,
  Crosshair,
  Database,
  Gauge,
  LineChart,
  ScanSearch,
  SlidersHorizontal,
  TableProperties,
} from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EnergyObservation } from "@/app/api/energy/route";
import {
  coefficientResults,
  evaluationSummary,
  modelResults,
} from "@/lib/notebook-results";

type AnalysisTab = "overview" | "visualizations" | "models" | "metrics" | "evaluation";
type FeaturePoint = EnergyObservation & {
  tempRange: number;
  tempAverage: number;
  month: number;
  weekday: number;
  dayOfYear: number;
  quarter: number;
  weekend: number;
};
type AnalysisFeature = {
  key: keyof FeaturePoint;
  label: string;
  shortLabel: string;
};

const tabs: Array<{ id: AnalysisTab; label: string; icon: typeof Activity }> = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "visualizations", label: "Visualizations", icon: LineChart },
  { id: "models", label: "Model comparison", icon: ChartNoAxesCombined },
  { id: "metrics", label: "Performance metrics", icon: Gauge },
  { id: "evaluation", label: "Evaluation", icon: Crosshair },
];

const weatherFeatures: AnalysisFeature[] = [
  { key: "wind", label: "Average wind", shortLabel: "AWND" },
  { key: "precipitation", label: "Precipitation", shortLabel: "PRCP" },
  { key: "maxTemperature", label: "Maximum temperature", shortLabel: "TMAX" },
  { key: "minTemperature", label: "Minimum temperature", shortLabel: "TMIN" },
  { key: "tempRange", label: "Temperature range", shortLabel: "Temp range" },
  { key: "tempAverage", label: "Average temperature", shortLabel: "Temp avg" },
];

const correlationFeatures: AnalysisFeature[] = [
  { key: "wind", label: "Average wind", shortLabel: "AWND" },
  { key: "precipitation", label: "Precipitation", shortLabel: "PRCP" },
  { key: "maxTemperature", label: "Maximum temperature", shortLabel: "TMAX" },
  { key: "minTemperature", label: "Minimum temperature", shortLabel: "TMIN" },
  { key: "tempRange", label: "Temperature range", shortLabel: "Range" },
  { key: "tempAverage", label: "Average temperature", shortLabel: "Avg temp" },
  { key: "month", label: "Month of year", shortLabel: "Month" },
  { key: "weekday", label: "Day of week", shortLabel: "Weekday" },
  { key: "weekend", label: "Weekend indicator", shortLabel: "Weekend" },
  { key: "consumption", label: "Daily consumption", shortLabel: "Demand" },
];

const seasons = ["Winter", "Spring", "Summer", "Fall"] as const;
const seasonColors: Record<(typeof seasons)[number], string> = {
  Winter: "#73e7e0",
  Spring: "#a8ffcb",
  Summer: "#f5d78e",
  Fall: "#d39b7e",
};

const numberFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});
const preciseFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});
const fourDecimalFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
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

function mean(values: number[]) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function withFeatures(rows: EnergyObservation[]): FeaturePoint[] {
  return rows.map((row) => {
    const date = new Date(`${row.date}T12:00:00Z`);
    const month = date.getUTCMonth() + 1;
    const weekday = (date.getUTCDay() + 6) % 7;
    const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
    const dayOfYear =
      Math.floor((date.getTime() - yearStart) / 86_400_000) + 1;

    return {
      ...row,
      tempRange: row.maxTemperature - row.minTemperature,
      tempAverage: (row.maxTemperature + row.minTemperature) / 2,
      month,
      weekday,
      dayOfYear,
      quarter: Math.ceil(month / 3),
      weekend: weekday >= 5 ? 1 : 0,
    };
  });
}

function histogram(values: number[], bins = 20) {
  if (values.length === 0) return [];
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const width = maximum === minimum ? 1 : (maximum - minimum) / bins;
  const result = Array.from({ length: bins }, (_, index) => {
    const start = minimum + index * width;
    return {
      midpoint: start + width / 2,
      start,
      end: start + width,
      count: 0,
    };
  });

  for (const value of values) {
    const index = Math.min(
      bins - 1,
      Math.max(0, Math.floor((value - minimum) / width)),
    );
    result[index].count += 1;
  }

  return result;
}

function pearson(rows: FeaturePoint[], left: AnalysisFeature, right: AnalysisFeature) {
  const leftValues = rows.map((row) => Number(row[left.key]));
  const rightValues = rows.map((row) => Number(row[right.key]));
  const leftMean = mean(leftValues);
  const rightMean = mean(rightValues);
  let numerator = 0;
  let leftSquares = 0;
  let rightSquares = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const leftDelta = leftValues[index] - leftMean;
    const rightDelta = rightValues[index] - rightMean;
    numerator += leftDelta * rightDelta;
    leftSquares += leftDelta * leftDelta;
    rightSquares += rightDelta * rightDelta;
  }

  const denominator = Math.sqrt(leftSquares * rightSquares);
  return denominator > 0 ? numerator / denominator : null;
}

function regressionLine(points: Array<{ x: number; y: number }>) {
  const meanX = mean(points.map((point) => point.x));
  const meanY = mean(points.map((point) => point.y));
  const denominator = points.reduce(
    (sum, point) => sum + (point.x - meanX) ** 2,
    0,
  );
  const slope =
    denominator > 0
      ? points.reduce(
          (sum, point) => sum + (point.x - meanX) * (point.y - meanY),
          0,
        ) / denominator
      : 0;
  return { slope, intercept: meanY - slope * meanX };
}

function quantile(sortedValues: number[], proportion: number) {
  if (sortedValues.length === 0) return 0;
  const position = (sortedValues.length - 1) * proportion;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const weight = position - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

function ChartHeading({
  icon: Icon,
  eyebrow,
  title,
  detail,
}: {
  icon: typeof Activity;
  eyebrow: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="analysis-heading">
      <div className="analysis-heading-icon"><Icon size={16} strokeWidth={1.7} /></div>
      <div className="analysis-heading-copy">
        <div className="section-overline"><span className="section-dot" />{eyebrow}</div>
        <h3>{title}</h3>
        <p>{detail}</p>
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  detail,
  tone = "mint",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "mint" | "cyan" | "gold";
}) {
  return (
    <article className={`analysis-metric analysis-metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function ComparisonTooltip() {
  return (
    <Tooltip
      contentStyle={{
        border: "1px solid rgba(168,255,203,.2)",
        borderRadius: 8,
        background: "rgba(8,25,18,.97)",
        color: "#f1f7f2",
        fontSize: 11,
      }}
      itemStyle={{ color: "#a8ffcb" }}
      labelStyle={{ color: "#96ada2", marginBottom: 4 }}
      cursor={{ fill: "rgba(168,255,203,.045)" }}
    />
  );
}

function ScatterFeatureCard({
  rows,
  feature,
}: {
  rows: FeaturePoint[];
  feature: AnalysisFeature;
}) {
  const data = useMemo(() => {
    const allPoints = rows.map((row) => ({
      x: Number(row[feature.key]),
      y: row.consumption,
    }));
    const stride = Math.max(1, Math.ceil(allPoints.length / 260));
    const points = allPoints.filter(
      (_, index) => index % stride === 0 || index === allPoints.length - 1,
    );
    const line = regressionLine(allPoints);
    const minimum = Math.min(...allPoints.map((point) => point.x));
    const maximum = Math.max(...allPoints.map((point) => point.x));

    return {
      points,
      line: [
        { x: minimum, y: line.slope * minimum + line.intercept },
        { x: maximum, y: line.slope * maximum + line.intercept },
      ],
      correlation: pearson(rows, feature, {
        key: "consumption",
        label: "Daily consumption",
        shortLabel: "Demand",
      }),
    };
  }, [feature, rows]);

  return (
    <article className="analysis-chart-card relationship-card">
      <div className="relationship-title">
        <div>
          <strong>{feature.label}</strong>
          <span>vs. daily consumption</span>
        </div>
        <span className="correlation-pill">
          r {data.correlation === null ? "—" : data.correlation.toFixed(2)}
        </span>
      </div>
      <div className="relationship-chart">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 9, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="rgba(184,219,198,.075)" strokeDasharray="3 6" />
            <XAxis
              type="number"
              dataKey="x"
              name={feature.label}
              tick={{ fill: "#778d81", fontSize: 9 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: number) => Number(value.toFixed(1)).toString()}
              minTickGap={25}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Consumption"
              width={40}
              tick={{ fill: "#778d81", fontSize: 8 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: number) => numberFormat.format(value)}
            />
            <ComparisonTooltip />
            <ReferenceLine
              segment={data.line}
              stroke="#f5d78e"
              strokeOpacity={0.8}
              strokeDasharray="4 4"
            />
            <Scatter data={data.points} fill="#73e7e0" fillOpacity={0.47} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

function OverviewPanel({ children }: { children: React.ReactNode }) {
  return <div className="analysis-overview-panel">{children}</div>;
}

function VisualizationPanel({ rows }: { rows: FeaturePoint[] }) {
  const consumptionHistogram = useMemo(
    () => histogram(rows.map((row) => row.consumption)),
    [rows],
  );
  const monthly = useMemo(() => {
    const buckets = Array.from({ length: 12 }, () => [] as number[]);
    rows.forEach((row) => buckets[row.month - 1].push(row.consumption));
    return buckets.map((values, index) => ({
      month: new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(
        new Date(Date.UTC(2020, index, 1)),
      ),
      average: mean(values),
      count: values.length,
    }));
  }, [rows]);
  const seasonal = useMemo(
    () =>
      seasons.map((season) => {
        const values = rows
          .filter((row) => {
            if (season === "Winter") return row.month === 12 || row.month <= 2;
            if (season === "Spring") return row.month >= 3 && row.month <= 5;
            if (season === "Summer") return row.month >= 6 && row.month <= 8;
            return row.month >= 9 && row.month <= 11;
          })
          .map((row) => row.consumption)
          .sort((left, right) => left - right);

        return {
          season,
          color: seasonColors[season],
          count: values.length,
          min: values[0] ?? 0,
          q1: quantile(values, 0.25),
          median: quantile(values, 0.5),
          q3: quantile(values, 0.75),
          max: values.at(-1) ?? 0,
        };
      }),
    [rows],
  );
  const correlations = useMemo(
    () =>
      correlationFeatures.map((rowFeature) =>
        correlationFeatures.map((columnFeature) =>
          pearson(rows, rowFeature, columnFeature),
        ),
      ),
    [rows],
  );
  const trend = useMemo(
    () =>
      rows.filter(
        (_, index) =>
          index % Math.max(1, Math.ceil(rows.length / 700)) === 0 ||
          index === rows.length - 1,
      ),
    [rows],
  );
  const weatherHistograms = useMemo(
    () =>
      weatherFeatures.map((feature) => ({
        feature,
        data: histogram(rows.map((row) => Number(row[feature.key])), 14),
      })),
    [rows],
  );

  const consumptionExtent = useMemo(() => {
    const min = Math.min(...rows.map((row) => row.consumption));
    const max = Math.max(...rows.map((row) => row.consumption));
    return { min, max, range: Math.max(1, max - min) };
  }, [rows]);

  return (
    <section className="analysis-panel" role="tabpanel" id="analysis-panel-visualizations">
      <div className="analysis-intro">
        <div>
          <div className="section-overline"><span className="section-dot section-dot-cyan" />EXPLORATORY DATA ANALYSIS</div>
          <h2>Patterns in the archive</h2>
          <p>
            The notebook’s distribution, seasonal, time-series, correlation,
            and weather relationship views—replotted from the original daily
            observations.
          </p>
        </div>
        <span className="analysis-sample-pill"><Database size={13} />{rows.length.toLocaleString("en-US")} daily records</span>
      </div>

      <div className="analysis-chart-grid analysis-grid-two">
        <article className="analysis-chart-card">
          <ChartHeading
            icon={BarChart3}
            eyebrow="TARGET DISTRIBUTION"
            title="Daily consumption"
            detail="Frequency across the full observed range"
          />
          <div className="analysis-chart chart-medium">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={consumptionHistogram} margin={{ top: 12, right: 10, bottom: 0, left: -10 }}>
                <CartesianGrid vertical={false} stroke="rgba(184,219,198,.075)" strokeDasharray="3 6" />
                <XAxis
                  dataKey="midpoint"
                  tick={{ fill: "#778d81", fontSize: 9 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: number) => numberFormat.format(value)}
                  minTickGap={28}
                />
                <YAxis
                  tick={{ fill: "#778d81", fontSize: 9 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <ComparisonTooltip />
                <Bar dataKey="count" name="Days" fill="#73e7e0" fillOpacity={0.78} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="analysis-card-footnote">
            Mean {numberFormat.format(evaluationSummary.datasetMean)} <span>·</span> median {numberFormat.format(evaluationSummary.datasetMedian)} <span>·</span> σ {numberFormat.format(evaluationSummary.datasetStdDev)}
          </div>
        </article>

        <article className="analysis-chart-card">
          <ChartHeading
            icon={Activity}
            eyebrow="HISTORICAL TIME SERIES"
            title="Daily demand"
            detail="Observed readings across the complete archive"
          />
          <div className="analysis-chart chart-medium">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 12, right: 8, bottom: 0, left: -8 }}>
                <defs>
                  <linearGradient id="archiveTrendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a8ffcb" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#73e7e0" stopOpacity={0.015} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(184,219,198,.075)" strokeDasharray="3 6" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#778d81", fontSize: 9 }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={36}
                  tickFormatter={(date: string) => formatDate(date, { month: "short", year: "2-digit" })}
                />
                <YAxis
                  tick={{ fill: "#778d81", fontSize: 9 }}
                  tickLine={false}
                  axisLine={false}
                  width={45}
                  tickFormatter={(value: number) => numberFormat.format(value)}
                />
                <ComparisonTooltip />
                <Area
                  type="monotone"
                  dataKey="consumption"
                  name="Daily use"
                  stroke="#a8ffcb"
                  strokeWidth={1.5}
                  fill="url(#archiveTrendFill)"
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="analysis-card-footnote">
            {rows[0]?.date && rows.at(-1)?.date
              ? `${formatDate(rows[0].date, { month: "short", year: "numeric" })} — ${formatDate(rows.at(-1)!.date, { month: "short", year: "numeric" })}`
              : "Daily observations"}
            <span>·</span> displayed line sampled for clarity
          </div>
        </article>
      </div>

      <article className="analysis-chart-card seasonal-card">
        <div className="analysis-chart-grid analysis-grid-seasonal">
          <div className="seasonal-section">
            <ChartHeading
              icon={ChartNoAxesCombined}
              eyebrow="SEASONAL PROFILE"
              title="Demand by season"
              detail="Mean daily use across meteorological seasons"
            />
            <div className="analysis-chart chart-short">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={seasonal} margin={{ top: 12, right: 8, bottom: 0, left: -8 }}>
                  <CartesianGrid vertical={false} stroke="rgba(184,219,198,.075)" strokeDasharray="3 6" />
                  <XAxis dataKey="season" tick={{ fill: "#91a69a", fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: "#778d81", fontSize: 9 }} tickLine={false} axisLine={false} width={42} tickFormatter={(value: number) => numberFormat.format(value)} />
                  <ComparisonTooltip />
                  <Bar dataKey="average" name="Mean use" radius={[4, 4, 0, 0]}>
                    {seasonal.map((item) => <Cell key={item.season} fill={item.color} fillOpacity={0.76} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="seasonal-section">
            <ChartHeading
              icon={LineChart}
              eyebrow="CALENDAR PROFILE"
              title="Monthly averages"
              detail="Mean consumption for each calendar month"
            />
            <div className="analysis-chart chart-short">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly} margin={{ top: 12, right: 5, bottom: 0, left: -8 }}>
                  <CartesianGrid vertical={false} stroke="rgba(184,219,198,.075)" strokeDasharray="3 6" />
                  <XAxis dataKey="month" tick={{ fill: "#91a69a", fontSize: 8 }} tickLine={false} axisLine={false} interval={0} />
                  <YAxis tick={{ fill: "#778d81", fontSize: 9 }} tickLine={false} axisLine={false} width={42} tickFormatter={(value: number) => numberFormat.format(value)} />
                  <ComparisonTooltip />
                  <Bar dataKey="average" name="Mean use" fill="#a8ffcb" fillOpacity={0.72} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="season-boxplot">
          <div className="season-boxplot-heading">
            <strong>Seasonal distribution</strong>
            <span>Median, interquartile range &amp; full observed range</span>
          </div>
          <div className="boxplot-axis">
            <span>0</span><span>{numberFormat.format(consumptionExtent.max / 2)}</span><span>{numberFormat.format(consumptionExtent.max)}</span>
          </div>
          {seasonal.map((item) => {
            const position = (value: number) => ((value - consumptionExtent.min) / consumptionExtent.range) * 100;
            return (
              <div className="boxplot-row" key={item.season}>
                <span className="boxplot-label">{item.season}</span>
                <div className="boxplot-track">
                  <span
                    className="boxplot-whisker"
                    style={{
                      left: `${position(item.min)}%`,
                      width: `${Math.max(0.6, position(item.max) - position(item.min))}%`,
                      backgroundColor: item.color,
                    }}
                  />
                  <span
                    className="boxplot-iqr"
                    style={{
                      left: `${position(item.q1)}%`,
                      width: `${Math.max(0.6, position(item.q3) - position(item.q1))}%`,
                      backgroundColor: item.color,
                    }}
                  />
                  <span className="boxplot-median" style={{ left: `${position(item.median)}%` }} />
                </div>
                <span className="boxplot-count">{item.count} days</span>
              </div>
            );
          })}
        </div>
      </article>

      <div className="analysis-section-heading">
        <div>
          <div className="section-overline"><span className="section-dot section-dot-gold" />WEATHER RELATIONSHIPS</div>
          <h3>What moves with demand?</h3>
        </div>
        <span>Each point is one observation · line is a least-squares fit</span>
      </div>
      <div className="analysis-chart-grid relationship-grid">
        {weatherHistograms.map(({ feature, data }) => (
          <article className="analysis-chart-card weather-histogram-card" key={feature.key}>
            <div className="weather-histogram-heading">
              <strong>{feature.label}</strong>
              <span>{feature.shortLabel}</span>
            </div>
            <div className="weather-histogram">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 6, right: 2, bottom: 0, left: -22 }}>
                  <CartesianGrid vertical={false} stroke="rgba(184,219,198,.06)" strokeDasharray="3 6" />
                  <XAxis dataKey="midpoint" tick={{ fill: "#778d81", fontSize: 8 }} tickLine={false} axisLine={false} tickFormatter={(value: number) => Number(value.toFixed(0)).toString()} minTickGap={20} />
                  <YAxis tick={{ fill: "#778d81", fontSize: 8 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <ComparisonTooltip />
                  <Bar dataKey="count" name="Days" fill="#73e7e0" fillOpacity={0.68} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>
        ))}
      </div>

      <div className="analysis-chart-grid relationship-grid feature-relationship-grid">
        {weatherFeatures.map((feature) => (
          <ScatterFeatureCard
            key={`relationship-${feature.key}`}
            rows={rows}
            feature={feature}
          />
        ))}
      </div>

      <div className="analysis-section-heading">
        <div>
          <div className="section-overline"><span className="section-dot" />PEARSON CORRELATION</div>
          <h3>Signals across the full dataset</h3>
        </div>
        <span>Correlation describes association, not causation</span>
      </div>
      <article className="analysis-chart-card correlation-card">
        <div className="correlation-legend">
          <span><i className="correlation-negative" />Negative</span>
          <span><i className="correlation-neutral" />Near zero</span>
          <span><i className="correlation-positive" />Positive</span>
        </div>
        <div className="correlation-scroll" role="table" aria-label="Pearson correlation matrix">
          <div className="correlation-matrix">
            <div className="correlation-cell correlation-corner" role="columnheader">r</div>
            {correlationFeatures.map((feature) => (
              <div className="correlation-cell correlation-column-label" role="columnheader" key={`head-${feature.key}`} title={feature.label}>
                {feature.shortLabel}
              </div>
            ))}
            {correlationFeatures.map((feature, rowIndex) => (
              <div className="correlation-row-fragment" role="row" key={`row-${feature.key}`}>
                <div className="correlation-cell correlation-row-label" role="rowheader">{feature.shortLabel}</div>
                {correlations[rowIndex].map((value, columnIndex) => {
                  const tint = value === null ? 0 : Math.abs(value) * 0.55 + 0.035;
                  const background = value === null
                    ? "rgba(255,255,255,.025)"
                    : value < 0
                      ? `rgba(115,231,224,${tint})`
                      : `rgba(168,255,203,${tint})`;
                  return (
                    <div
                      className="correlation-cell correlation-value"
                      role="cell"
                      key={`${feature.key}-${correlationFeatures[columnIndex].key}`}
                      style={{ backgroundColor: background }}
                      title={`${feature.label} × ${correlationFeatures[columnIndex].label}: ${value === null ? "not available" : value.toFixed(3)}`}
                    >
                      {value === null ? "—" : value.toFixed(2)}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <p className="analysis-card-footnote">
          Correlations are recalculated from the loaded CSV. The notebook’s model metrics below are its saved, separate 80/20 random-split evaluation.
        </p>
      </article>
    </section>
  );
}

function ModelComparisonPanel() {
  const scoreData = modelResults.map((model) => ({
    model: model.shortName,
    "Train R²": model.trainR2,
    "Test R²": model.testR2,
    color: model.color,
  }));
  const errorData = modelResults.map((model) => ({
    model: model.shortName,
    "Test RMSE": model.testRmse,
    "Test MAE": model.testMae,
  }));

  return (
    <section className="analysis-panel" role="tabpanel" id="analysis-panel-models">
      <div className="analysis-intro">
        <div>
          <div className="section-overline"><span className="section-dot section-dot-gold" />THREE REGRESSION APPROACHES</div>
          <h2>One dataset. Three perspectives.</h2>
          <p>Compare the notebook’s multiple linear, Lasso, and Ridge regression results on the same held-out test set.</p>
        </div>
        <span className="analysis-sample-pill"><ClipboardList size={13} />Saved notebook run</span>
      </div>

      <div className="analysis-chart-grid analysis-grid-two">
        <article className="analysis-chart-card">
          <ChartHeading
            icon={ChartNoAxesCombined}
            eyebrow="EXPLAINED VARIANCE"
            title="R² · train vs. test"
            detail="Higher is better · held-out test shown in mint"
          />
          <div className="analysis-chart chart-medium">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scoreData} margin={{ top: 14, right: 10, bottom: 0, left: -8 }}>
                <CartesianGrid vertical={false} stroke="rgba(184,219,198,.075)" strokeDasharray="3 6" />
                <XAxis dataKey="model" tick={{ fill: "#91a69a", fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 0.45]} tick={{ fill: "#778d81", fontSize: 9 }} tickLine={false} axisLine={false} width={36} tickFormatter={(value: number) => value.toFixed(2)} />
                <ComparisonTooltip />
                <Legend wrapperStyle={{ color: "#91a69a", fontSize: 10 }} />
                <Bar dataKey="Train R²" fill="#73e7e0" fillOpacity={0.43} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Test R²" fill="#a8ffcb" fillOpacity={0.87} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="analysis-chart-card">
          <ChartHeading
            icon={Crosshair}
            eyebrow="PREDICTION ERROR"
            title="Test-set RMSE &amp; MAE"
            detail="Lower is better · dataset consumption units"
          />
          <div className="analysis-chart chart-medium">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={errorData} margin={{ top: 14, right: 10, bottom: 0, left: -5 }}>
                <CartesianGrid vertical={false} stroke="rgba(184,219,198,.075)" strokeDasharray="3 6" />
                <XAxis dataKey="model" tick={{ fill: "#91a69a", fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "#778d81", fontSize: 9 }} tickLine={false} axisLine={false} width={43} tickFormatter={(value: number) => numberFormat.format(value)} />
                <ComparisonTooltip />
                <Legend wrapperStyle={{ color: "#91a69a", fontSize: 10 }} />
                <Bar dataKey="Test RMSE" fill="#73e7e0" fillOpacity={0.68} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Test MAE" fill="#f5d78e" fillOpacity={0.77} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>

      <article className="analysis-chart-card comparison-table-card">
        <ChartHeading
          icon={TableProperties}
          eyebrow="NOTEBOOK RESULTS"
          title="Full model comparison"
          detail="Values transcribed from the notebook’s saved evaluation output"
        />
        <div className="responsive-table-wrap">
          <table className="analysis-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Train R²</th>
                <th>Test R²</th>
                <th>Train RMSE</th>
                <th>Test RMSE</th>
                <th>Train MAE</th>
                <th>Test MAE</th>
                <th>5-fold CV R²</th>
              </tr>
            </thead>
            <tbody>
              {modelResults.map((model) => (
                <tr key={model.shortName}>
                  <td><span className="model-table-dot" style={{ backgroundColor: model.color }} />{model.name}</td>
                  <td>{fourDecimalFormat.format(model.trainR2)}</td>
                  <td className={model.name === evaluationSummary.bestModel ? "best-model-value" : ""}>{fourDecimalFormat.format(model.testR2)}</td>
                  <td>{preciseFormat.format(model.trainRmse)}</td>
                  <td>{preciseFormat.format(model.testRmse)}</td>
                  <td>{preciseFormat.format(model.trainMae)}</td>
                  <td>{preciseFormat.format(model.testMae)}</td>
                  <td>{fourDecimalFormat.format(model.cvR2Mean)} ± {fourDecimalFormat.format(model.cvR2Std)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="analysis-card-footnote">
          R² is unitless. RMSE and MAE use dataset consumption units. A lower error is better; a higher R² is better.
        </p>
      </article>

      <article className="analysis-chart-card coefficient-card">
        <ChartHeading
          icon={SlidersHorizontal}
          eyebrow="REGULARIZATION EFFECT"
          title="Feature coefficients"
          detail="The notebook’s fitted coefficients across all three models"
        />
        <div className="analysis-chart coefficient-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[...coefficientResults]} layout="vertical" margin={{ top: 6, right: 22, bottom: 5, left: 15 }}>
              <CartesianGrid horizontal={false} stroke="rgba(184,219,198,.065)" strokeDasharray="3 6" />
              <XAxis type="number" tick={{ fill: "#778d81", fontSize: 9 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="feature" width={80} tick={{ fill: "#91a69a", fontSize: 9, fontFamily: "var(--font-ibm-plex-mono)" }} tickLine={false} axisLine={false} />
              <ReferenceLine x={0} stroke="rgba(241,247,242,.35)" />
              <ComparisonTooltip />
              <Legend wrapperStyle={{ color: "#91a69a", fontSize: 10 }} />
              <Bar dataKey="linear" name="Multiple linear" fill="#73e7e0" fillOpacity={0.78} />
              <Bar dataKey="lasso" name="Lasso" fill="#a8ffcb" fillOpacity={0.8} />
              <Bar dataKey="ridge" name="Ridge" fill="#f5d78e" fillOpacity={0.82} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="analysis-card-footnote">
          Lasso drives several coefficients to zero, producing a sparser fit. Coefficients are those saved from the notebook run.
        </p>
      </article>

      <div className="analysis-chart-grid analysis-grid-two">
        {[
          { cell: 43, title: "Lasso regularization tuning", alpha: modelResults[1].alpha!, score: modelResults[1].cvR2Mean, tone: "mint" },
          { cell: 52, title: "Ridge regularization tuning", alpha: modelResults[2].alpha!, score: modelResults[2].cvR2Mean, tone: "gold" },
        ].map((plot) => (
          <article className="analysis-chart-card saved-figure-card" key={plot.cell}>
            <ChartHeading
              icon={ScanSearch}
              eyebrow="5-FOLD GRID SEARCH"
              title={plot.title}
              detail={`Best alpha ${plot.alpha.toFixed(6)} · mean CV R² ${plot.score.toFixed(6)}`}
            />
            <Image
              className="notebook-figure"
              src={`/api/notebook-figures/${plot.cell}`}
              width={1189}
              height={590}
              unoptimized
              alt={`${plot.title} chart saved in the analysis notebook`}
              loading="lazy"
            />
            <p className="analysis-card-footnote">Original cross-validation tuning plot from the executed notebook.</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function PerformancePanel() {
  return (
    <section className="analysis-panel" role="tabpanel" id="analysis-panel-metrics">
      <div className="analysis-intro">
        <div>
          <div className="section-overline"><span className="section-dot" />MODEL PERFORMANCE</div>
          <h2>Every score, in context.</h2>
          <p>Training, held-out test, and five-fold cross-validation metrics from the saved notebook run.</p>
        </div>
        <span className="analysis-sample-pill"><Database size={13} />{evaluationSummary.featureCount} model features</span>
      </div>

      <div className="analysis-metric-grid">
        <MetricTile label="Best held-out R²" value="0.3695" detail="Ridge · 36.9% of test variance" tone="mint" />
        <MetricTile label="Lowest test RMSE" value="493.20" detail="Ridge · dataset units" tone="cyan" />
        <MetricTile label="Lowest test MAE" value="373.56" detail="Multiple linear · dataset units" tone="gold" />
        <MetricTile label="Best mean CV R²" value="0.3063" detail="Lasso · 5-fold cross-validation" tone="mint" />
      </div>

      <article className="analysis-chart-card comparison-table-card">
        <ChartHeading
          icon={TableProperties}
          eyebrow="TRAIN / TEST / CROSS-VALIDATION"
          title="Performance by model"
          detail="Scores rounded for readability; source values retain notebook precision"
        />
        <div className="responsive-table-wrap">
          <table className="analysis-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Train R²</th>
                <th>Test R²</th>
                <th>Train RMSE</th>
                <th>Test RMSE</th>
                <th>Train MAE</th>
                <th>Test MAE</th>
                <th>CV R² mean</th>
                <th>CV R² std</th>
              </tr>
            </thead>
            <tbody>
              {modelResults.map((model) => (
                <tr key={model.shortName}>
                  <td><span className="model-table-dot" style={{ backgroundColor: model.color }} />{model.name}</td>
                  <td>{model.trainR2.toFixed(6)}</td>
                  <td className={model.name === evaluationSummary.bestModel ? "best-model-value" : ""}>{model.testR2.toFixed(6)}</td>
                  <td>{model.trainRmse.toFixed(2)}</td>
                  <td>{model.testRmse.toFixed(2)}</td>
                  <td>{model.trainMae.toFixed(2)}</td>
                  <td>{model.testMae.toFixed(2)}</td>
                  <td>{model.cvR2Mean.toFixed(6)}</td>
                  <td>{model.cvR2Std.toFixed(6)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="analysis-card-footnote">
          RMSE squares larger errors more heavily; MAE is the average absolute error. Both error metrics are in the dataset’s original units.
        </p>
      </article>

      <div className="analysis-chart-grid analysis-grid-two">
        <article className="analysis-chart-card evaluation-notes-card">
          <ChartHeading
            icon={ClipboardList}
            eyebrow="EXPERIMENT DESIGN"
            title="How the notebook evaluated"
            detail="The reported scores belong to a specific saved experiment."
          />
          <dl className="evaluation-facts">
            <div><dt>Observations</dt><dd>{evaluationSummary.datasetSamples.toLocaleString("en-US")} daily records</dd></div>
            <div><dt>Training set</dt><dd>{evaluationSummary.trainingSamples.toLocaleString("en-US")} · 80%</dd></div>
            <div><dt>Held-out test set</dt><dd>{evaluationSummary.testSamples.toLocaleString("en-US")} · 20%</dd></div>
            <div><dt>Split strategy</dt><dd>Random split · seed {evaluationSummary.randomState}</dd></div>
            <div><dt>Cross-validation</dt><dd>{evaluationSummary.crossValidationFolds}-fold R² scoring</dd></div>
            <div><dt>Lasso best alpha</dt><dd>{modelResults[1].alpha?.toFixed(6)}</dd></div>
            <div><dt>Ridge best alpha</dt><dd>{modelResults[2].alpha?.toFixed(6)}</dd></div>
          </dl>
        </article>
        <article className="analysis-chart-card evaluation-notes-card">
          <ChartHeading
            icon={Gauge}
            eyebrow="READING THE SCORES"
            title="What these results say"
            detail="Use the test and cross-validation scores together."
          />
          <div className="insight-list">
            <div><span className="insight-index">01</span><p>Ridge has the highest test R² ({modelResults[2].testR2.toFixed(4)}) and the lowest test RMSE ({modelResults[2].testRmse.toFixed(2)}) of the three saved fits.</p></div>
            <div><span className="insight-index">02</span><p>Lasso has the highest mean cross-validation R² ({modelResults[1].cvR2Mean.toFixed(4)}); the scores are close across all three models.</p></div>
            <div><span className="insight-index">03</span><p>The held-out R² is about 0.37, so these weather and calendar features leave substantial variation unexplained.</p></div>
          </div>
          <p className="analysis-card-footnote">A single random split is not a time-forward forecast test; these results should not be read as future prediction guarantees.</p>
        </article>
      </div>
    </section>
  );
}

function EvaluationPanel() {
  return (
    <section className="analysis-panel" role="tabpanel" id="analysis-panel-evaluation">
      <div className="analysis-intro">
        <div>
          <div className="section-overline"><span className="section-dot section-dot-cyan" />HELD-OUT TEST SET</div>
          <h2>Predictions under the microscope.</h2>
          <p>The actual-vs-predicted and residual figures are the original plots saved by the executed notebook—not reconstructed or simulated predictions.</p>
        </div>
        <span className="analysis-sample-pill"><Crosshair size={13} />{evaluationSummary.testSamples} test observations</span>
      </div>

      <div className="evaluation-callout">
        <div className="evaluation-callout-mark"><Crosshair size={18} /></div>
        <div>
          <strong>Best test-set score · {evaluationSummary.bestModel}</strong>
          <span>R² {modelResults[2].testR2.toFixed(6)} <i>·</i> RMSE {modelResults[2].testRmse.toFixed(2)} <i>·</i> MAE {modelResults[2].testMae.toFixed(2)}</span>
        </div>
        <span className="evaluation-callout-badge">SAVED NOTEBOOK RESULT</span>
      </div>

      <div className="analysis-chart-grid analysis-grid-two">
        <article className="analysis-chart-card saved-figure-card">
          <ChartHeading
            icon={Crosshair}
            eyebrow="ACTUAL VS. PREDICTED"
            title="Where predictions meet reality"
            detail="Each panel compares actual and predicted consumption for one model"
          />
          <Image
            className="notebook-figure"
            src="/api/notebook-figures/63"
            width={1790}
            height={489}
            unoptimized
            alt="Notebook comparison of actual and predicted held-out consumption for linear, Lasso, and Ridge models"
            loading="lazy"
          />
          <p className="analysis-card-footnote">The dashed diagonal is perfect agreement; wider scatter indicates larger prediction errors.</p>
        </article>

        <article className="analysis-chart-card saved-figure-card">
          <ChartHeading
            icon={Activity}
            eyebrow="RESIDUAL DIAGNOSTICS"
            title="Errors across the prediction range"
            detail="Residuals are actual minus predicted consumption"
          />
          <Image
            className="notebook-figure"
            src="/api/notebook-figures/65"
            width={1787}
            height={489}
            unoptimized
            alt="Notebook residual plots for linear, Lasso, and Ridge regression on the held-out test set"
            loading="lazy"
          />
          <p className="analysis-card-footnote">A well-calibrated residual plot is centered around zero without a strong pattern or changing spread.</p>
        </article>
      </div>

      <article className="analysis-chart-card evaluation-table-card">
        <ChartHeading
          icon={TableProperties}
          eyebrow="TEST-SET DETAIL"
          title="How to interpret the comparison"
          detail="A compact guide to the notebook’s held-out evaluation measures"
        />
        <div className="evaluation-interpretations">
          <div><span className="interpretation-code">R²</span><strong>Explained variation</strong><p>Ridge: {modelResults[2].testR2.toFixed(4)}. Higher is better; a score below 1 indicates remaining unexplained variation.</p></div>
          <div><span className="interpretation-code">RMSE</span><strong>Large-error-sensitive miss</strong><p>Ridge: {modelResults[2].testRmse.toFixed(2)} dataset units. The square root of mean squared prediction error.</p></div>
          <div><span className="interpretation-code">MAE</span><strong>Average absolute miss</strong><p>Ridge: {modelResults[2].testMae.toFixed(2)} dataset units. The average distance between prediction and observation.</p></div>
        </div>
        <p className="analysis-card-footnote">
          Scores and plots are from the notebook’s 20% random holdout ({evaluationSummary.testSamples} rows). They are not recomputed when chart date ranges change.
        </p>
      </article>
    </section>
  );
}

export default function NotebookAnalysis({
  observations,
  overview,
}: {
  observations: EnergyObservation[];
  overview: React.ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<AnalysisTab>("overview");
  const featureRows = useMemo(() => withFeatures(observations), [observations]);

  function handleTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex !== null) {
      event.preventDefault();
      setActiveTab(tabs[nextIndex].id);
      document.getElementById(`analysis-tab-${tabs[nextIndex].id}`)?.focus();
    }
  }

  return (
    <div className="notebook-analysis">
      <div className="analysis-tabs-scroll" id="analysis-tabs">
        <div className="analysis-tabs" role="tablist" aria-label="Energy analysis">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              id={`analysis-tab-${id}`}
              className={`analysis-tab ${activeTab === id ? "analysis-tab-active" : ""}`}
              role="tab"
              type="button"
              aria-selected={activeTab === id}
              aria-controls={`analysis-panel-${id}`}
              tabIndex={activeTab === id ? 0 : -1}
              onClick={() => setActiveTab(id)}
              onKeyDown={handleTabKeyDown}
            >
              <Icon size={15} strokeWidth={1.7} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {activeTab === "overview" && (
        <OverviewPanel>{overview}</OverviewPanel>
      )}
      {activeTab === "visualizations" && (
        <VisualizationPanel rows={featureRows} />
      )}
      {activeTab === "models" && <ModelComparisonPanel />}
      {activeTab === "metrics" && <PerformancePanel />}
      {activeTab === "evaluation" && <EvaluationPanel />}
    </div>
  );
}

import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export type EnergyObservation = {
  date: string;
  wind: number;
  precipitation: number;
  maxTemperature: number;
  minTemperature: number;
  consumption: number;
};

export async function GET() {
  try {
    const csvPath = path.join(
      process.cwd(),
      "electricity_consumption_based_weather_dataset.csv",
    );
    const csv = await readFile(csvPath, "utf8");
    const lines = csv.trim().split(/\r?\n/);
    const observations: EnergyObservation[] = lines
      .slice(1)
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        const [
          date,
          wind,
          precipitation,
          maxTemperature,
          minTemperature,
          consumption,
        ] = line.split(",");

        return {
          date,
          wind: Number(wind),
          precipitation: Number(precipitation),
          maxTemperature: Number(maxTemperature),
          minTemperature: Number(minTemperature),
          consumption: Number(consumption),
        };
      });

    if (
      observations.length === 0 ||
      observations.some(
        (row) =>
          !/^\d{4}-\d{2}-\d{2}$/.test(row.date) ||
          Object.values(row).some(
            (value) =>
              typeof value === "number" && !Number.isFinite(value),
          ),
      )
    ) {
      return NextResponse.json(
        { error: "The energy dataset contains invalid observations." },
        { status: 500 },
      );
    }

    return NextResponse.json(observations);
  } catch (error) {
    console.error("Unable to load the energy dataset:", error);
    return NextResponse.json(
      { error: "The energy dataset could not be loaded." },
      { status: 500 },
    );
  }
}

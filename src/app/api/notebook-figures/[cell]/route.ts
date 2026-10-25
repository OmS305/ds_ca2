import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const availableFigures = new Set([43, 52, 63, 65]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ cell: string }> },
) {
  const { cell } = await params;
  const cellIndex = Number(cell);

  if (!Number.isInteger(cellIndex) || !availableFigures.has(cellIndex)) {
    return NextResponse.json(
      { error: "This notebook figure is not available." },
      { status: 404 },
    );
  }

  try {
    const notebookPath = path.join(process.cwd(), "electricity_analysis.ipynb");
    const notebook = JSON.parse(await readFile(notebookPath, "utf8")) as {
      cells?: Array<{
        outputs?: Array<{ data?: { "image/png"?: string | string[] } }>;
      }>;
    };
    const image = notebook.cells?.[cellIndex]?.outputs?.find(
      (output) => output.data?.["image/png"],
    )?.data?.["image/png"];

    if (!image) {
      return NextResponse.json(
        { error: "The notebook figure has not been generated." },
        { status: 404 },
      );
    }

    const png = Buffer.from(Array.isArray(image) ? image.join("") : image, "base64");
    if (
      png.length < 8 ||
      !png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ) {
      return NextResponse.json(
        { error: "The saved notebook figure is invalid." },
        { status: 500 },
      );
    }

    return new Response(png, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Unable to load the saved notebook figure:", error);
    return NextResponse.json(
      { error: "The saved notebook figure could not be loaded." },
      { status: 500 },
    );
  }
}

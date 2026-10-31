
import sharp from "sharp";
import type { PosterTextRegion } from "./gemini-image";
import {
  contrastRatio,
  hexToRgb,
  type RGB,
} from "./visual-analysis";

export type VisualFinding = {
  quote: string;
  issue: string;
  reason: string;
  source: string;
  severity: "low" | "medium" | "high";
  confidence: number;
  suggested_fix: string;
  origin: "visual";
  region: PosterTextRegion["box"];
};

type PaletteColor = {
  name: string;
  hex_code: string;
};

function colorDistance(a: RGB, b: RGB) {
  return Math.sqrt(
    (a.r - b.r) ** 2 +
    (a.g - b.g) ** 2 +
    (a.b - b.b) ** 2
  );
}

function dominantColor(pixels: RGB[]): RGB | null {
  if (!pixels.length) return null;

  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();

  for (const p of pixels) {
    const r = Math.round(p.r / 16) * 16;
    const g = Math.round(p.g / 16) * 16;
    const b = Math.round(p.b / 16) * 16;
    const key = `${r},${g},${b}`;
    const old = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 };

    old.count++;
    old.r += p.r;
    old.g += p.g;
    old.b += p.b;
    buckets.set(key, old);
  }

  const best = [...buckets.values()].sort((a, b) => b.count - a.count)[0];

  return {
    r: Math.round(best.r / best.count),
    g: Math.round(best.g / best.count),
    b: Math.round(best.b / best.count),
  };
}

async function readPixels(
  image: Buffer,
  left: number,
  top: number,
  width: number,
  height: number
): Promise<RGB[]> {
  if (width < 1 || height < 1) return [];

  const { data, info } = await sharp(image)
    .extract({ left, top, width, height })
    .flatten({ background: "#ffffff" })
    .removeAlpha()
    .resize({ width: Math.min(width, 100), height: Math.min(height, 100), fit: "inside" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels: RGB[] = [];

  for (let i = 0; i < info.width * info.height; i++) {
    const offset = i * info.channels;
    pixels.push({
      r: data[offset],
      g: data[offset + 1],
      b: data[offset + 2],
    });
  }

  return pixels;
}

export async function getVisualFindings(
  image: Buffer,
  regions: PosterTextRegion[],
  approvedColors: PaletteColor[] = []
): Promise<VisualFinding[]> {
  const metadata = await sharp(image).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Could not determine poster dimensions.");
  }

  const findings: VisualFinding[] = [];

  for (const item of regions) {
    const { x, y, width, height } = item.box;
    const text = item.text.trim();

    if (
      !text ||
      ![x, y, width, height].every(Number.isFinite) ||
      x < 0 || y < 0 || width <= 0 || height <= 0 ||
      x + width > 1000 || y + height > 1000
    ) continue;

    const left = Math.max(0, Math.floor(x / 1000 * metadata.width));
    const top = Math.max(0, Math.floor(y / 1000 * metadata.height));
    const right = Math.min(metadata.width, Math.ceil((x + width) / 1000 * metadata.width));
    const bottom = Math.min(metadata.height, Math.ceil((y + height) / 1000 * metadata.height));

    const boxWidth = right - left;
    const boxHeight = bottom - top;

    if (boxWidth < 2 || boxHeight < 2) continue;

    const fontHeightPx =
      (item.estimatedFontHeight / 1000) * metadata.height;

    // Small-text warning: estimated visual glyph height, not a certified font size.
    if (fontHeightPx > 0 && fontHeightPx < 14) {
      findings.push({
        quote: text,
        issue: "Potentially small text",
        reason: `Gemini estimates the text height at approximately ${fontHeightPx.toFixed(1)} pixels. It may be difficult to read at smaller display sizes.`,
        source: "Gemini poster layout analysis",
        severity: "medium",
        confidence: 0.65,
        suggested_fix: "Increase the text size and check readability on a mobile screen.",
        origin: "visual",
        region: item.box,
      });
    }

    // Sample a narrow ring around the text block to estimate its background.
    const pad = Math.max(3, Math.round(Math.min(boxWidth, boxHeight) * 0.12));
    const ringPixels = [
      ...(await readPixels(image, Math.max(0, left - pad), Math.max(0, top - pad), boxWidth + 2 * pad, pad)),
      ...(await readPixels(image, Math.max(0, left - pad), bottom, boxWidth + 2 * pad, pad)),
      ...(await readPixels(image, Math.max(0, left - pad), top, pad, boxHeight)),
      ...(await readPixels(image, right, top, pad, boxHeight)),
    ];

    const insidePixels = await readPixels(image, left, top, boxWidth, boxHeight);
    const background = dominantColor(ringPixels);

    if (background && insidePixels.length) {
      // Ignore pixels similar to the estimated background.
      const foregroundCandidates = insidePixels.filter(
        (pixel) => colorDistance(pixel, background) > 45
      );

      const foreground = dominantColor(foregroundCandidates);

      if (foreground) {
        const ratio = contrastRatio(foreground, background);

        if (ratio < 4.5) {
          findings.push({
            quote: text,
            issue: "Potentially low text contrast",
            reason: `Estimated contrast ratio is ${ratio.toFixed(2)}:1. WCAG AA recommends at least 4.5:1 for normal text. Colour detection is approximate; verify this result manually.`,
            source: "Estimated poster pixel analysis",
            severity: ratio < 3 ? "high" : "medium",
            confidence: 0.5,
            suggested_fix: "Use a darker text colour on a light background, or a lighter text colour on a dark background. Recheck the final contrast ratio.",
            origin: "visual",
            region: item.box,
          });
        }

        // Compare the estimated text colour with the approved palette.
        const parsedPalette = approvedColors
          .map((color) => ({
            name: color.name,
            hex: color.hex_code,
            rgb: hexToRgb(color.hex_code),
          }))
          .filter((color) => color.rgb !== null);

        if (parsedPalette.length > 0) {
          const closest = parsedPalette
            .map((color) => ({
              ...color,
              distance: colorDistance(foreground, color.rgb!),
            }))
            .sort((a, b) => a.distance - b.distance)[0];

          if (closest.distance > 55) {
            findings.push({
              quote: text,
              issue: "Text colour may be outside brand palette",
              reason: `Estimated text colour is RGB(${foreground.r}, ${foreground.g}, ${foreground.b}). The closest approved colour is ${closest.name} (${closest.hex}).`,
              source: "Approved brand colour palette",
              severity: "low",
              confidence: 0.5,
              suggested_fix: `Consider using the approved ${closest.name} colour (${closest.hex}), while preserving sufficient text contrast.`,
              origin: "visual",
              region: item.box,
            });
          }
        }
      }
    }
  }

  return findings;
}

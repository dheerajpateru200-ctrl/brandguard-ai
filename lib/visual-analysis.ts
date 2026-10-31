
/**
 * BrandGuard AI — Visual accessibility utilities.
 * Deterministic WCAG calculations and bounded poster pixel sampling.
 */
import sharp from "sharp";

export type RGB = {
  r: number;
  g: number;
  b: number;
};

export type ContrastResult = {
  ratio: number;
  passesNormalText: boolean;
  passesLargeText: boolean;
};

function linearize(channel: number): number {
  const value = channel / 255;

  return value <= 0.04045
    ? value / 12.92
    : Math.pow((value + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(color: RGB): number {
  const r = linearize(color.r);
  const g = linearize(color.g);
  const b = linearize(color.b);

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(
  foreground: RGB,
  background: RGB
): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

export function evaluateContrast(
  foreground: RGB,
  background: RGB
): ContrastResult {
  const ratio = contrastRatio(foreground, background);

  return {
    ratio: Math.round(ratio * 100) / 100,
    passesNormalText: ratio >= 4.5,
    passesLargeText: ratio >= 3,
  };
}

export function hexToRgb(hex: string): RGB | null {
  const cleaned = hex.trim().replace(/^#/, "");

  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return null;
  }

  return {
    r: parseInt(cleaned.slice(0, 2), 16),
    g: parseInt(cleaned.slice(2, 4), 16),
    b: parseInt(cleaned.slice(4, 6), 16),
  };
}

export type PixelSample = {
  width: number;
  height: number;
  pixels: RGB[];
};

export type PosterBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Convert Gemini's normalized 0–1000 box into image pixel coordinates.
 */
export function normalizedBoxToPixels(
  box: PosterBox,
  imageWidth: number,
  imageHeight: number
) {
  const values = [box.x, box.y, box.width, box.height];

  if (
    values.some((value) => !Number.isFinite(value)) ||
    box.x < 0 ||
    box.y < 0 ||
    box.width <= 0 ||
    box.height <= 0 ||
    box.x + box.width > 1000 ||
    box.y + box.height > 1000
  ) {
    throw new Error("Invalid normalized poster region.");
  }

  const left = Math.max(
    0,
    Math.floor((box.x / 1000) * imageWidth)
  );

  const top = Math.max(
    0,
    Math.floor((box.y / 1000) * imageHeight)
  );

  const right = Math.min(
    imageWidth,
    Math.ceil(((box.x + box.width) / 1000) * imageWidth)
  );

  const bottom = Math.min(
    imageHeight,
    Math.ceil(((box.y + box.height) / 1000) * imageHeight)
  );

  if (right <= left || bottom <= top) {
    throw new Error("The detected poster region is empty.");
  }

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  };
}

/**
 * Extract actual RGB pixels from a normalized poster region.
 * Transparent pixels are composited onto white before sampling.
 */
export async function samplePosterRegion(
  image: Buffer,
  box: PosterBox
): Promise<PixelSample> {
  const metadata = await sharp(image).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Could not determine poster dimensions.");
  }

  const region = normalizedBoxToPixels(
    box,
    metadata.width,
    metadata.height
  );

  const { data, info } = await sharp(image)
    .extract(region)
    .flatten({ background: "#ffffff" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const totalPixels = info.width * info.height;

  // Never collect more than approximately 2,000 pixels.
  const stride = Math.max(
    1,
    Math.ceil(totalPixels / 2000)
  );

  const pixels: RGB[] = [];

  for (let i = 0; i < totalPixels; i += stride) {
    const offset = i * info.channels;

    pixels.push({
      r: data[offset],
      g: data[offset + 1],
      b: data[offset + 2],
    });
  }

  return {
    width: info.width,
    height: info.height,
    pixels,
  };
}

export type RegionContrastAnalysis = {
  averageForeground: RGB;
  averageBackground: RGB;
  contrast: ContrastResult;
  warning: string | null;
};

function averageColor(pixels: RGB[]): RGB {
  if (pixels.length === 0) {
    throw new Error("Cannot calculate the average of zero pixels.");
  }

  const total = pixels.reduce(
    (sum, pixel) => ({
      r: sum.r + pixel.r,
      g: sum.g + pixel.g,
      b: sum.b + pixel.b,
    }),
    { r: 0, g: 0, b: 0 }
  );

  return {
    r: Math.round(total.r / pixels.length),
    g: Math.round(total.g / pixels.length),
    b: Math.round(total.b / pixels.length),
  };
}

/**
 * Calculates contrast between two explicitly identified pixel groups.
 * Do not pass the entire text region as foreground pixels.
 */
export function analyzeRegionContrast(
  foregroundPixels: RGB[],
  backgroundPixels: RGB[]
): RegionContrastAnalysis {
  const averageForeground = averageColor(foregroundPixels);
  const averageBackground = averageColor(backgroundPixels);

  const contrast = evaluateContrast(
    averageForeground,
    averageBackground
  );

  let warning: string | null = null;

  if (!contrast.passesNormalText) {
    warning = contrast.passesLargeText
      ? "Contrast may be insufficient for normal-sized text."
      : "Low contrast may make text difficult to read.";
  }

  return {
    averageForeground,
    averageBackground,
    contrast,
    warning,
  };
}

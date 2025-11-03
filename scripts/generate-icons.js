/*
  scripts/generate-icons.js
  Generate a full PWA icon set from public/logo.png into public/icons/.
  Uses sharp if available, falls back to jimp.
*/

const fs = require('fs');
const path = require('path');

const SIZES = [16, 32, 48, 72, 96, 128, 144, 152, 167, 180, 192, 256, 384, 512];

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'public', 'logo.png');
const OUT_DIR = path.join(ROOT, 'public', 'icons');

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function usingSharp() {
  try {
    const sharp = require('sharp');
    return sharp;
  } catch (e) {
    return null;
  }
}

async function usingJimp() {
  try {
    const Jimp = require('jimp');
    return Jimp;
  } catch (e) {
    return null;
  }
}

async function main() {
  const srcExists = fs.existsSync(SRC);
  const srcSize = srcExists ? (await fs.promises.stat(SRC)).size : 0;

  await ensureDir(OUT_DIR);

  const sharp = await usingSharp();
  let Jimp = sharp ? null : await usingJimp();

  if (!sharp && !Jimp) {
    console.error('Neither sharp nor jimp is available. Please install one of them.');
    process.exit(1);
  }

  const useGenerated = !srcExists || srcSize < 1024; // treat tiny file as invalid logo
  console.log(
    useGenerated
      ? `Source logo missing or invalid (size=${srcSize}). Generating placeholder icons...`
      : `Generating icons from ${SRC} -> ${OUT_DIR}`
  );

  if (!useGenerated && sharp) {
    try {
      // Try sharp end-to-end; if any failure occurs, fall back to Jimp for all sizes
      for (const size of SIZES) {
        const outPath = path.join(OUT_DIR, `icon-${size}x${size}.png`);
        await sharp(SRC)
          .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png({ quality: 100 })
          .toFile(outPath);
        console.log('✓', path.basename(outPath));
      }
    } catch (err) {
      console.warn('sharp failed, falling back to jimp:', err?.message || err);
      const Jimp2 = await usingJimp();
      if (!Jimp2) throw err;
      const image = await Jimp2.read(SRC);
      for (const size of SIZES) {
        const outPath = path.join(OUT_DIR, `icon-${size}x${size}.png`);
        const clone = image.clone();
        clone.contain(size, size, Jimp2.HORIZONTAL_ALIGN_CENTER | Jimp2.VERTICAL_ALIGN_MIDDLE);
        await clone.writeAsync(outPath);
        console.log('✓', path.basename(outPath));
      }
    }
  } else if (!useGenerated && Jimp) {
    const image = await Jimp.read(SRC);
    for (const size of SIZES) {
      const outPath = path.join(OUT_DIR, `icon-${size}x${size}.png`);
      const clone = image.clone();
      clone.contain(size, size, Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_MIDDLE);
      await clone.writeAsync(outPath);
      console.log('✓', path.basename(outPath));
    }
  } else {
    // Create generated icons with initials using Jimp
    if (!Jimp) Jimp = await usingJimp();
    if (!Jimp) {
      console.error('Cannot generate placeholder icons without jimp.');
      process.exit(1);
    }
    const bg = 0x1f2937ff; // themeColor #1f2937
    const initials = 'NP';
    // Preload fonts
    const fonts = {
      128: await Jimp.loadFont(Jimp.FONT_SANS_128_WHITE).catch(() => null),
      64: await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE).catch(() => null),
      32: await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE).catch(() => null),
      16: await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE).catch(() => null),
    };
    for (const size of SIZES) {
      const outPath = path.join(OUT_DIR, `icon-${size}x${size}.png`);
      const img = new Jimp(size, size, bg);
      // pick a font roughly proportional to size
      const font = size >= 192 ? fonts[128] : size >= 96 ? fonts[64] : size >= 48 ? fonts[32] : fonts[16];
      if (font) {
        img.print(
          font,
          0,
          0,
          { text: initials, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER, alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE },
          size,
          size
        );
      }
      await img.writeAsync(outPath);
      console.log('✓', path.basename(outPath));
    }
  }

  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

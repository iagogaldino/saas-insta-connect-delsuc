import path from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const assetsDir = path.resolve(__dirname, "../assets/images")
const sourceLogo = process.argv[2] ?? "C:/Users/iago_/Pictures/InstaConnect/logo.png"

const colors = {
  background: { r: 248, g: 250, b: 252, alpha: 1 },
  primaryLight: { r: 209, g: 250, b: 229, alpha: 1 },
  white: { r: 255, g: 255, b: 255, alpha: 1 },
  transparent: { r: 0, g: 0, b: 0, alpha: 0 },
}

async function writeSquareIcon({
  outputName,
  size,
  logoSize,
  background,
  monochrome = false,
}) {
  const padding = Math.round((size - logoSize) / 2)
  let pipeline = sharp(sourceLogo).resize(logoSize, logoSize, {
    fit: "contain",
    background: colors.transparent,
  })

  if (monochrome) {
    pipeline = pipeline
      .greyscale()
      .linear(1.15, -20)
      .threshold(140)
      .negate({ alpha: false })
      .flatten({ background: colors.white })
      .ensureAlpha()
  }

  await pipeline
    .extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background,
    })
    .png()
    .toFile(path.join(assetsDir, outputName))
}

async function writeSolidBackground(outputName, color) {
  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: color,
    },
  })
    .png()
    .toFile(path.join(assetsDir, outputName))
}

async function writeSplashScreen() {
  const width = 1284
  const height = 2778
  const logoSize = 280
  const centerY = Math.round(height * 0.42)
  const logoTop = centerY - Math.round(logoSize / 2)
  const logoLeft = Math.round((width - logoSize) / 2)

  const backgroundSvg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="accent" cx="50%" cy="34%" r="58%">
          <stop offset="0%" stop-color="#D1FAE5" stop-opacity="0.95" />
          <stop offset="100%" stop-color="#F8FAFC" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="#F8FAFC" />
      <rect width="100%" height="100%" fill="url(#accent)" />
      <circle cx="${width / 2}" cy="${centerY}" r="${logoSize / 2 + 56}" fill="#D1FAE5" opacity="0.55" />
    </svg>
  `

  const textSvg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <text
        x="50%"
        y="${logoTop + logoSize + 88}"
        text-anchor="middle"
        font-family="Segoe UI, system-ui, -apple-system, sans-serif"
        font-size="64"
        font-weight="700"
        fill="#0F172A"
      >Insta Connect</text>
      <text
        x="50%"
        y="${logoTop + logoSize + 148}"
        text-anchor="middle"
        font-family="Segoe UI, system-ui, -apple-system, sans-serif"
        font-size="30"
        fill="#64748B"
      >Sessões e AutoFollow</text>
    </svg>
  `

  const logoBuffer = await sharp(sourceLogo)
    .resize(logoSize, logoSize, {
      fit: "contain",
      background: colors.transparent,
    })
    .png()
    .toBuffer()

  await sharp(Buffer.from(backgroundSvg))
    .composite([
      { input: Buffer.from(textSvg), top: 0, left: 0 },
      { input: logoBuffer, top: logoTop, left: logoLeft },
    ])
    .png()
    .toFile(path.join(assetsDir, "splash.png"))
}

async function main() {
  await writeSquareIcon({
    outputName: "icon.png",
    size: 1024,
    logoSize: 900,
    background: colors.background,
  })

  await writeSquareIcon({
    outputName: "android-icon-foreground.png",
    size: 1024,
    logoSize: 672,
    background: colors.transparent,
  })

  await writeSolidBackground("android-icon-background.png", colors.primaryLight)

  await writeSquareIcon({
    outputName: "android-icon-monochrome.png",
    size: 1024,
    logoSize: 672,
    background: colors.transparent,
    monochrome: true,
  })

  await writeSquareIcon({
    outputName: "splash-icon.png",
    size: 1024,
    logoSize: 420,
    background: colors.transparent,
  })

  await writeSplashScreen()

  await writeSquareIcon({
    outputName: "favicon.png",
    size: 192,
    logoSize: 168,
    background: colors.background,
  })

  console.log("App icons generated in", assetsDir)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

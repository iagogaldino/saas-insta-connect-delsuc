const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.join(__dirname, "..");
const mobileRouter = path.join(root, "mobile", "node_modules", "expo-router");
const rootRouter = path.join(root, "node_modules", "expo-router");

if (!fs.existsSync(mobileRouter)) {
  process.exit(0);
}

if (fs.existsSync(rootRouter)) {
  const rootAssetsDir = path.join(rootRouter, "assets");
  if (fs.existsSync(rootAssetsDir)) {
    process.exit(0);
  }
  fs.rmSync(rootRouter, { recursive: true, force: true });
}

if (process.platform === "win32") {
  execSync(`cmd /c mklink /J "${rootRouter}" "${mobileRouter}"`, { stdio: "inherit" });
} else {
  fs.symlinkSync(mobileRouter, rootRouter, "dir");
}

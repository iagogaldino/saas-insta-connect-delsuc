const path = require("path")
const { getDefaultConfig } = require("expo/metro-config")

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname)

const projectNodeModules = path.resolve(__dirname, "node_modules")

// npm workspaces hoist most deps to the repo root, but some packages (e.g.
// expo-router) stay in mobile/node_modules. Metro must watch that folder or
// asset subpaths like expo-router/assets/error.png fail to resolve on web.
config.watchFolders = [...new Set([...(config.watchFolders ?? []), projectNodeModules])]

const defaultBlockList = Array.isArray(config.resolver.blockList)
  ? config.resolver.blockList
  : [config.resolver.blockList]

config.resolver.blockList = [
  ...defaultBlockList,
  // Puppeteer/Chrome session files in backend change rapidly and crash Metro watcher
  /[\\/]backend[\\/]\.session[\\/].*/,
  /[\\/]backend[\\/]dist[\\/].*/,
]

module.exports = config

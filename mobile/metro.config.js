const { getDefaultConfig } = require("expo/metro-config")

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname)

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

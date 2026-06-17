const fs = require("fs")
const path = require("path")
const { getDefaultConfig } = require("expo/metro-config")

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname)

const projectNodeModules = path.resolve(__dirname, "node_modules")
const expoRouterRoot = path.resolve(projectNodeModules, "expo-router")

// npm workspaces hoist most deps to the repo root, but some packages (e.g.
// expo-router) stay in mobile/node_modules. Metro must watch that folder and
// resolve subpath assets like expo-router/assets/logotype.png on web.
config.watchFolders = [...new Set([...(config.watchFolders ?? []), projectNodeModules])]

if (fs.existsSync(expoRouterRoot)) {
  config.resolver.extraNodeModules = {
    ...(config.resolver.extraNodeModules ?? {}),
    "expo-router": expoRouterRoot,
  }

  const defaultResolveRequest = config.resolver.resolveRequest
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName.startsWith("expo-router/")) {
      const subpath = moduleName.slice("expo-router/".length)
      const candidate = path.join(expoRouterRoot, ...subpath.split("/"))
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return { type: "sourceFile", filePath: candidate }
      }
    }

    if (defaultResolveRequest) {
      return defaultResolveRequest(context, moduleName, platform)
    }

    return context.resolveRequest(context, moduleName, platform)
  }
}

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

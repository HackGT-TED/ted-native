const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// The skeleton package imports a default gradient; use Expo's bundled module
// on native and web without modifying node_modules after every install.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native-linear-gradient') {
    return context.resolveRequest(context, require.resolve('./src/components/skeleton-gradient.ts'), platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Match Tailwind's web spacing scale and the app's original numeric dimensions.
module.exports = withNativeWind(config, { input: './global.css', inlineRem: 16 });

const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Match Tailwind's web spacing scale and the app's original numeric dimensions.
module.exports = withNativeWind(config, { input: './global.css', inlineRem: 16 });

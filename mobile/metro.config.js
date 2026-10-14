const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Вэбтэй хуваалцдаг код (../shared) mobile/-ээс гадна байгаа тул Metro-д харуулна.
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, "../shared")];

module.exports = config;

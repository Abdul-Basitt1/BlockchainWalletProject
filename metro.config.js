const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const defaultConfig = getDefaultConfig(__dirname);

const config = {
    resolver: {
        extraNodeModules: {
            buffer: require.resolve('buffer'),
            stream: require.resolve('stream-browserify'),
            crypto: require.resolve('react-native-quick-crypto'),
        },
    },
};

module.exports = mergeConfig(defaultConfig, config);

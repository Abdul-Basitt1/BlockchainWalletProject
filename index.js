// index.js or App.js
import 'react-native-get-random-values';
import 'react-native-quick-crypto';

// Polyfill Buffer
import { Buffer } from 'buffer';
global.Buffer = Buffer;
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);

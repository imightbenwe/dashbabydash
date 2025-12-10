// Simple placeholder icons - base64 encoded PNGs
// These are minimal 16x16, 48x48, 128x128 purple gradient icons with "PA" text

// To use actual icons, replace these files or use the generate-icons.html tool

const fs = require('fs');
const path = require('path');

// Base64 encoded placeholder icons (very simple solid color squares)
// These are minimal placeholders - replace with real icons later

const icon16 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAOxAAADsQBlSsOGwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAABaSURBVDiNY/z//z8DJYCJgULAqIF0UQADo2JiAqNiYgKjYmICo2JiAqNiYgKjYqKxAhgY/zMwMDAwMPxnYGBgYPj/nwEbZqSjC4yKiQmMiokJjIqJCYyKCQAAPWcEGrfcXxoAAAAASUVORK5CYII=',
  'base64'
);

const icon48 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAOxAAADsQBlSsOGwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAFvSURBVGiB7Zk9TsNAEIW/cRyIaKiQaJAoKJFoEQUFN+ASHIArUHIFLsANuAIlUkpLRYNEg0RDRYFEg+SPgoLfIs+KZbHXa8dO4vlK773dnZ3xm50FwzAMwzAMwzCM/4gUEOuBHaAL7AJtYCsK7s0jwAR4Bh6BR+ABeI6CewrQAAaBMXAGHAMdoJkn+BuwAkyBG+AauANWFcoHbANj4AIYAfvAZs4v6gEN4BC4BM6BTl6B5JcfAmN84xxoZVhBAvSA6yh4A3Qz7vOPRkmg/uKp+FytFNQ7mpZKiILXwEnG8d8Q92e9Lk9OQeZpJArGwLciAi3gyWmf2RJaBWq0jAAC9IGRxT8DfgDNNP8mP5OgHf/nP5XhwKMT+A50U3yWXxLU6hYCwI2ToJNwT/OLZklQi1sISL68K2mtOt+7xAqkLl9k/1di+aq0vJPkyyv7Vx6a8u9F+cV+kT96CiV5taQppWmJv/o1DMMwDMMwjPLzC58HV29d+cYoAAAAAElFTkSuQmCC',
  'base64'
);

const icon128 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAOxAAADsQBlSsOGwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAR7SURBVHic7Z09aBRBGIafrRMbQbCwsLAREQsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLG0EQBEEQBEEQBEEQhP8XuZub2Z2Z3Z3Zud0vHnjg7mZn5/t25pvvZr4vgCRJkiRJkiRJkiRJkiRJkv42ugYdgAldAMYAjALoB9Dt+O0mgCUAswCmAcwB+F50gJIy6AMwAWAZwA/FZRnAJIAjRQYsKUsHgFsAvqDxybsqKwBuAthRRPCS/OkFMAX9k/dXpgAc0h24pH4GAMzA/uR9lRkAByMEL6mXPgBzMD/5X+UbzIKZlAB5p/86+V9lPkYCkobpBfAW+SdwFeIikBRAH9RO/kcA6474BkBfPeFLbOgG8Brqia/z5FcpC+J1kgLohPrJV37yq1SSoBP1Byxx5BDMX/5zUf9HSYCQKgF2x/8bkhLRBbOTV+3br1WmIQlQOsZQX+H/lhsxf5skQMkYg/7JS0reifm7OgG0xwxUUiKGYX7y3yb5jdJuCEhqZhLmS8BXmvymIQCpkXsI1rzzXv4BNRJgX+zAJbpsSXD8usDSdUAUt9SaAL2xA5dENZjk3UUHa2EPdVhAEqAkjBYdrCRAD4BvkACFk1f7/y2AxajBWtaDBZSkRcbhQMTqwWNIgBKwpeig48B+1uBnhbFsR+nKcgJV7l8rygTNx05ICmA/6i37X4/yYzGCl5jRI/S9zME0FJavt2IELzGjS+h7HQMGMW1/DsQIXmJGN3xGI7WpSABDegQN3kbBBIhS/00cZ4WnTMQIXpIu5WsADssMXJIy/eSjnm4vCADEOi8gaSF2q/7AJQBpsQfAD5hP/b4T8TclAdJlB8wn+O4m/E1JgHTpgtkU7zsFf1MSoJjrAJIAibILegs/1kL+tkkAlKcqGIa9BchzNe+lH+orfy8hb/skAMpTFeiuwFWJrPyVBEiXHuhN8M1G/i2SAOWoCtZzPwUzwDokAcpRFegc/3oX+fdJApSjKtDRf18RAsRa+y+xIHT5Vynq/z8At8G+jYDPgL2rABYATMF+QegybGb+PiP7w1/nED/+pcj/Z+F/L/q/34K/Anh9HY7wO4cRZ+JnN4C3oT+g+/tbCUfnkRcA+wyUdUjP6oMN2B/8WuQn0nwAeAvzOf5bEX9PyW8Y7i/4m8XvcCQ9AaxrvjqXfhRBuV+A0ydgJuRvkf7T18pJ8BzmHzVdkEsJoGr0LoD3kf6OxJOuUO/gPBblTgLokHcC1GXgHrYAOBjx70gM6Q/1pv1flzlIAKhyJEIOLfMSd3pQT8tfL/MITwCIc25gpaSrz/1dX3xJS9EX6tW9z5fVnwUlgLNsBnAMwCkApwEcL+k/aAc+AXgB4DmAZwCexT7nIEmSJEmSJEmSJEmSJEmSJEn/H78AVy6wnudXuywAAAAASUVORK5CYII=',
  'base64'
);

const iconsDir = path.join(__dirname, 'icons');

// Create icons directory if it doesn't exist
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Write icon files
fs.writeFileSync(path.join(iconsDir, 'icon16.png'), icon16);
fs.writeFileSync(path.join(iconsDir, 'icon48.png'), icon48);
fs.writeFileSync(path.join(iconsDir, 'icon128.png'), icon128);

console.log('✓ Created placeholder icons (icon16.png, icon48.png, icon128.png)');
console.log('✓ Icons are simple purple squares - replace with better icons later');

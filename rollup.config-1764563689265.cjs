'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var pluginBabel = require('@rollup/plugin-babel');
var commonjs = require('@rollup/plugin-commonjs');
var json = require('@rollup/plugin-json');
var nodeResolve = require('@rollup/plugin-node-resolve');
var terser = require('@rollup/plugin-terser');
var typescript = require('@rollup/plugin-typescript');
var serve = require('rollup-plugin-serve');

function ignore (userOptions = {}) {
    // Files need to be absolute paths.
    // This only works if the file has no exports
    // and only is imported for its side effects
    const files = userOptions.files || [];

    if (files.length === 0) {
        return {
            name: "ignore",
        };
    }

    return {
        name: "ignore",

        load(id) {
            return files.some((toIgnorePath) => id.startsWith(toIgnorePath))
                ? {
                      code: "",
                  }
                : null;
        },
    };
}

const IGNORED_FILES = [
  "@material/mwc-notched-outline/mwc-notched-outline.js",
  "@material/mwc-ripple/mwc-ripple.js",
  "@material/mwc-list/mwc-list.js",
  "@material/mwc-list/mwc-list-item.js",
  "@material/mwc-menu/mwc-menu.js",
  "@material/mwc-menu/mwc-menu-surface.js",
  "@material/mwc-icon/mwc-icon.js",
];

const dev = process.env.ROLLUP_WATCH;

const serveOptions = {
  contentBase: ["./dist"],
  host: "0.0.0.0",
  port: 4000,
  allowCrossOrigin: true,
  headers: {
    "Access-Control-Allow-Origin": "*",
  },
};

const plugins = [
  ignore({
    files: IGNORED_FILES.map((file) => require.resolve(file)),
  }),
  typescript({
    declaration: false,
  }),
  nodeResolve(),
  json(),
  commonjs(),
  pluginBabel.getBabelInputPlugin({
    babelHelpers: "bundled",
  }),
  pluginBabel.getBabelOutputPlugin({
    presets: [
      [
        "@babel/preset-env",
        {
          modules: false,
        },
      ],
    ],
    compact: true,
  }),
  ...(dev ? [serve(serveOptions)] : [terser()]),
];

var rollup_config = [
  {
    input: "src/mushroom.ts",
    output: {
      dir: "dist",
      format: "es",
      inlineDynamicImports: true,
    },
    plugins,
    moduleContext: (id) => {
      const thisAsWindowForModules = [
        "node_modules/@formatjs/intl-utils/lib/src/diff.js",
        "node_modules/@formatjs/intl-utils/lib/src/resolve-locale.js",
      ];
      if (thisAsWindowForModules.some((id_) => id.trimRight().endsWith(id_))) {
        return "window";
      }
    },
  },
];

exports.default = rollup_config;

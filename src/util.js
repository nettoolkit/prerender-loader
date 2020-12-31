/**
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

const path = require('path');

/**
 * Promisified version of compiler.runAsChild() with error hoisting and isolated output/assets.
 * (runAsChild() merges assets into the parent compilation, we don't want that)
 */
function runChildCompiler (compiler) {
  return new Promise((resolve, reject) => {
    compiler.compile((err, compilation) => {
      // still allow the parent compiler to track execution of the child:
      compiler.parentCompilation.children.push(compilation);
      if (err) return reject(err);

      // Bubble stat errors up and reject the Promise:
      if (compilation.errors && compilation.errors.length) {
        const errorDetails = compilation.errors.map(error => {
          if (error instanceof Error) {
            // In webpack 5, compilation error objects appear to be actual Errors.
            // For these, we want to reject with the stack trace for easier debugging.
            return error.stack;
          } else if (error.details) {
            // In webpack 4 and before, errors object appear to have a `details` property,
            // containing debug information about the error.
            return error.details;
          }
          return error;
        }).join('\n');
        return reject(Error('Child compilation failed:\n' + errorDetails));
      }

      resolve(compilation);
    });
  });
}

/** Crawl up the compiler tree and return the outermost compiler instance */
function getRootCompiler (compiler) {
  while (compiler.parentCompilation && compiler.parentCompilation.compiler) {
    compiler = compiler.parentCompilation.compiler;
  }
  return compiler;
}

/** Find the best possible export for an ES Module. Returns `undefined` for no exports. */
function getBestModuleExport (exports) {
  if (exports.default) {
    return exports.default;
  }
  for (const prop in exports) {
    if (prop !== '__esModule') {
      return exports[prop];
    }
  }
}

/** Wrap a String up into an ES Module that exports it */
function stringToModule (str) {
  return 'export default ' + JSON.stringify(str);
}

/**
 * Takes the context path, entry, and optional prefix, and returns an entry-like value
 * that can be used in the loader.
 */
function normalizeEntry (context, entry, prefix = '') {
  if (entry && typeof entry === 'object') {
    return Object.keys(entry).reduce((acc, key) => {
      const entryItem = entry[key];
      // In webpack 5, entry can be a string, array of strings, or an object called an
      // entry descriptor that has `import` property pointing to a path string or
      // array of path strings. Entry descriptors are not handled by the
      // NormalModuleFactory eventually used to process entries).
      // Therefore, we convert descriptors to simple path string(s) instead.
      if (typeof entryItem === 'object' && entryItem.import) {
        acc[key] = convertPathToRelative(context, entryItem.import, prefix);
      } else {
        acc[key] = convertPathToRelative(context, entryItem, prefix);
      }
      return acc;
    }, {});
  }
  return convertPathToRelative(context, entry, prefix);
}

/**
 * Takes single path or array of paths and returns single relative path or array of relative paths.
 */
function convertPathToRelative (context, entryPath, prefix) {
  if (Array.isArray(entryPath)) {
    return entryPath.map(p => prefix + path.relative(context, p));
  }
  return prefix + path.relative(context, entryPath);
}

module.exports = {
  runChildCompiler,
  getRootCompiler,
  getBestModuleExport,
  stringToModule,
  normalizeEntry
};

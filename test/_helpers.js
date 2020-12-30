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

import { promisify } from 'util';
import jsdom from 'jsdom';
import fs from 'fs';
import path from 'path';
import webpack from 'webpack';

const DOMParser = new jsdom.JSDOM(``, { includeNodeLocations: false }).window.DOMParser;

// parse a string into a JSDOM Document
export const parseDom = html => new DOMParser().parseFromString(html, 'text/html');

// returns a promise resolving to the contents of a file
export const readFile = file => promisify(fs.readFile)(path.resolve(__dirname, file), 'utf8');

// invoke webpack on a given entry module, optionally mutating the default configuration
export function compile (entryItem, configDecorator) {
  return new Promise((resolve, reject) => {
    let context, entry;
    if (typeof entryItem === 'object') {
      context = path.dirname(path.resolve(__dirname, Object.values(entryItem)[0]));
      entry = entryItem;
    } else {
      context = path.dirname(path.resolve(__dirname, entryItem));
      entry = path.resolve(context, path.basename(entryItem));
    }
    let config = {
      mode: 'development', // required so webpack doesn't squash certain errors
      context,
      entry,
      output: {
        path: path.resolve(__dirname, path.resolve(context, 'dist')),
        filename: '[name].bundle.js',
        chunkFilename: '[name].chunk.js'
      },
      resolveLoader: {
        modules: [path.resolve(__dirname, '../node_modules')]
      },
      module: {
        rules: []
      },
      plugins: []
    };
    if (configDecorator) {
      config = configDecorator(config) || config;
    }
    webpack(config, (err, stats) => {
      if (err) {
        return reject(err);
      }
      const info = stats.toJson();
      if (stats.hasErrors()) {
        return reject(info.errors.map(error => error.message).join('\n'));
      }
      resolve(info);
    });
  });
}

// invoke webpack via compile(), injecting `html` and `document` properties into the webpack build info.
export async function compileToHtml (fixture, configDecorator, crittersOptions = {}) {
  const info = await compile(`fixtures/${fixture}/index.js`, configDecorator);
  info.html = await readFile(`fixtures/${fixture}/dist/index.html`);
  info.document = parseDom(info.html);
  return info;
}

export async function compileMultipleToHtml (fixture, configDecorator) {
  const context = path.resolve(__dirname, `fixtures/${fixture}`);
  const jsFiles = fs.readdirSync(context).filter(filename => filename.endsWith('.js'));
  const entry = jsFiles.reduce((acc, filename) => {
    const entryKey = getEntryKey(filename);
    acc[entryKey] = path.resolve(context, filename);
    return acc;
  }, {});
  const info = await compile(entry, configDecorator);
  // Include HTML and document for each generated HTML file, indexed by entry key.
  info.html = {};
  info.document = {};
  for (const entryKey of Object.keys(entry)) {
    const htmlFilename = entryKey + '.html';
    const html = await readFile(`fixtures/${fixture}/dist/${htmlFilename}`);
    info.html[entryKey] = html;
    info.document[entryKey] = parseDom(html);
  }
  return info;
}

export function getEntryKey (filePath) {
  return path.basename(filePath, path.extname(filePath));
}

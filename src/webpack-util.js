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

import EntryPlugin from 'webpack/lib/EntryPlugin';

/** Handle "object", "string" and "array" types of entry */
export function applyEntry (context, entry, compiler) {
  if (typeof entry === 'string') {
    itemToPlugin(context, entry, 'main').apply(compiler);
  } else if (Array.isArray(entry)) {
    entry.forEach(item => {
      itemToPlugin(context, item, 'main').apply(compiler);
    });
  } else if (typeof entry === 'object') {
    Object.keys(entry).forEach(name => {
      const item = entry[name];
      if (Array.isArray(item)) {
        item.forEach(subItem => {
          itemToPlugin(context, subItem, name).apply(compiler);
        });
      } else {
        itemToPlugin(context, item, name).apply(compiler);
      }
    });
  }
}

function itemToPlugin (context, item, name) {
  return new EntryPlugin(context, item, { name });
}

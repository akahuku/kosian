/**
 * commonjs partial emulation
 *
 * @author akahuku@gmail.com
 */
/**
 * Copyright 2014 akahuku, akahuku@gmail.com
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

(function (global) {
	'use strict';

	var CORE_LIBS = [
		'kosian/Utils.js',
		'kosian/SHA1.js',
		'kosian/Blowfish.js',
		'kosian/ResourceLoader.js',
		'kosian/FileSystemImpl.js',
		'kosian/FileSystem.js',
		'kosian/StorageWrapper.js',
		'kosian/TabWatcher.js',
		'kosian/Hotkey.js',
		'kosian/Clipboard.js',
		'kosian/Kosian.js',
		'kosian/' + (function () {
			if (global.chrome) {
				return 'Chrome';
			}
			if (global.opera) {
				return 'Opera';
			}
			return 'Null';
		})() + 'Impl.js'
	];

	var modules = {};
	var pathCache = {};
	var isCoreLoaded = false;

	function loadScripts () {
		var args = Array.prototype.slice.call(arguments);

		if (!isCoreLoaded) {
			Array.prototype.unshift.apply(args, CORE_LIBS);
			isCoreLoaded = true;
		}

		var loader = function (onload) {
			var top = args.shift();

			if (typeof top == 'function') {
				try {
					top();
				}
				catch (e) {
				}
				onload();
			}
			else {
				var s = document.createElement('script');
				s.src = 'lib/' + top;
				s.onload = onload;
				document.head.appendChild(s);
				modules[s.src] = global.exports = {};
			}
		};
		loader(function onload (e) {
			if (e) {
				e.target.onload = null;
				e.target.parentNode.removeChild(e.target);
			}
			if (args.length) {
				loader(onload);
			}
			else {
				/*var a = ['*** all scripts has been loaded ***'];
				for (var i in modules) {
					a.push('module path: ' + i);
					for (var j in modules[i]) {
						a.push('\t' + j);
					}
				}
				console.log(a.join('\n'));*/
			}
		});
	}

	function require (path) {
		if (path in pathCache) {
			return modules[pathCache[path]];
		}

		var anchor = document.createElement('a');
		anchor.href = 'lib/' + path + '.js';

		var canonical = anchor.href;
		pathCache[path] = canonical;

		return modules[canonical];
	}

	global.loadScripts = loadScripts;
	global.require = require;
})(this);

// vim:set ts=4 sw=4 fenc=UTF-8 ff=unix ft=javascript fdm=marker :

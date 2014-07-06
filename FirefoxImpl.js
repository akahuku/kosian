/**
 * Firefox extension wrapper
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

(function () {
	'use strict';

	var self = require('sdk/self');
	var PageMod = require('sdk/page-mod').PageMod;
	var tabs = require('sdk/tabs');
	var l10n = require('sdk/l10n/locale');
	var MatchPattern = require('sdk/util/match-pattern').MatchPattern;
	var base = require('kosian/Kosian').Kosian;

	function findTabById (id) {
		var result;

		Array.prototype.some.call(tabs, function (tab) {
			if (tab.id == id) {
				result = tab;
				return true;
			}
		});
		if (result) return result;

		for (var i in this.workers) {
			if (i == id) {
				result = this.workers[i].tab;
				break;
			}
		}
		if (result) return result;

		return null;
	}

	function receive (callback) {
		this.receiver = callback;
	}

	function openTabWithUrl (url, selfUrl, callback) {
		var that = this;
		tabs.open({
			url: url,
			onReady: function (tab) {
				callback && that.emit(callback, tab.id, tab.url);
				callback = null;
			}
		});
	}

	function openTabWithFile (file, callback) {
		var that = this;
		tabs.open({
			url: self.data.url(file),
			onReady: function (tab) {
				callback && that.emit(callback, tab.id, tab.url);
				callback = null;
			}
		});
	}

	function isTabExist (id) {
		return !!findTabById(id);
	}

	function closeTab (id) {
		var tab = findTabById(id);
		if (tab) {
			tab.close();
		}
	}

	function focusTab (id) {
		var tab = findTabById(id);
		if (tab) {
			tab.activate();
		}
	}

	function getTabTitle (id, callback) {
		var tab = findTabById(id);
		this.emit(callback, tab ? tab.title : null);
	}

	function broadcastToAllTabs (message, exceptId) {
		var that = this;
		Array.prototype.forEach.call(tabs, function (tab) {
			if (tab.id == exceptId) return;

			for (var i in that.workers) {
				var worker = that.workers[i];
				if (worker.tab.id != tab.id) continue;
				if (worker.tab.url != tab.url) continue;

				try {
					worker.postMessage({payload: message});
					break;
				}
				catch (e) {}
			}
		});
	}

	function createTransport () {
		var chrome = require('chrome');
		if (chrome) {
			var Cc = chrome.Cc, Ci = chrome.Ci;
			var xhr = Cc['@mozilla.org/xmlextras/xmlhttprequest;1']
				.createInstance(Ci.nsIXMLHttpRequest);
			xhr.mozBackgroundRequest = true;
			return xhr;
		}
		return null;
	}

	function createFormData () {
		var chrome = require('chrome');
		if (!chrome) {
			return null;
		}

		/*
		 * @see https://bugzilla.mozilla.org/show_bug.cgi?id=672690#c4
		 */
		var Cc = chrome.Cc, Ci = chrome.Ci;
		var formData = Cc["@mozilla.org/files/formdata;1"]
			.createInstance(Ci.nsIDOMFormData);
		if (!formData) {
			return null;
		}

		if (arguments.length) {
			// TODO: When the argument is specified, it must be Form Element
			// and will be necessary to add all the form items of form
			// manually.
			throw new Error('kosian: Creating FormData with argument is not implemented yet on Firefox');
		}

		return formData;
	}

	function createBlob () {
		// TODO
		throw new Error('kosian: Creating Blob is not implemented yet on Firefox');
	}

	function postMessage () {
		var id, message;

		switch (arguments.length) {
		case 1:
			message = arguments[0];
			break;
		default:
			id = arguments[0];
			message = arguments[1];
			break;
		}

		if (!message) {
			return;
		}

		for (var i in this.workers) {
			var worker = this.workers[i];
			if (id === undefined && worker.tab == tabs.activeTab
			||  id !== undefined && (worker.tab.id == id || i == id)) {
				try {
					worker.postMessage({payload: message});
				}
				catch (e) {}
				break;
			}
		}
	}

	function broadcast (message, exceptId) {
		for (var i in this.workers) {
			var worker = this.workers[i];
			if (exceptId !== undefined) {
				if (worker.tab.id == exceptId || i == exceptId) continue;
			}

			try {
				worker.postMessage({payload: message});
			}
			catch (e) {}
		}
	}

	function getMessageCatalogPath () {
		var prefered = l10n.getPreferedLocales();
		if (!prefered) {
			return undefined;
		}

		prefered = prefered.filter(function (l) {
			return /^([^-]{2})(-[^-]+)*$/.test(l);
		});

		if (!prefered || prefered.length == 0) {
			return undefined;
		}

		var availables = this.utils
			.parseJson(self.data.load('xlocale/locales.json'))
			.map(function (l) {
				return l.replace(/_/g, '-').toLowerCase();
			});

		var result = l10n.findClosestLocale(availables, prefered);
		if (!result) {
			return undefined;
		}

		return 'xlocale/' + result + '/messages.json';
	}

	function PseudoRegexRule (name, includes, excludes) {
		this.__kosian_name = name;
		this.__kosian_includes = includes;
		this.__kosian_excludes = excludes;
		this.__kosian_cache = {};
	}

	PseudoRegexRule.prototype = {
		constructor: RegExp,
		__isMatch: function (list, url) {
			return list ? list.some(function (pat) {
				return typeof pat == 'function' ?
					pat(url, this.__local) :
					(new MatchPattern(pat)).test(url);
			}, this) : false;
		},
		__local: function (url) {
			return self.data.url(url);
		},
		test: function (url) {
			if (url in this.__kosian_cache) {
				return this.__kosian_cache[url];
			}

			// console.log('testing ' + this.__kosian_name + ' for ' + url);

			var included = this.__isMatch(this.__kosian_includes, url);
			var excluded = this.__isMatch(this.__kosian_excludes, url);
			var result = included && !excluded;

			return this.__kosian_cache[url] = result;
		},
		exec: function (url) {
			return this.test(url) ? [url] : null;
		},
		toString: function () {
			return '[object PseudoRegexRule_' + this.__kosian_name + ']';
		}
	};
	
	function FirefoxImpl (global, options) {
		var that = this;
		var workers = {};

		function removeWorker (worker) {
			for (var i in workers) {
				if (workers[i] == worker) {
					delete workers[i];
					break;
				}
			}
		}

		function registerWorker (worker) {
			worker.on('detach', handleWorkerDetach);
			worker.on('message', handleWorkerMessage);
		}

		function handleWorkerDetach () {
			// 'this' points Worker here
			removeWorker(this);
		}

		function handleWorkerMessage (req) {
			// 'this' points Worker here
			if (!that.receiver) return;

			var theWorker = this;
			var tabId = -1;
			if (tabId == -1 && 'internalId' in req) {
				tabId = req.internalId;
			}
			if (tabId == -1 && this.tab) {
				tabId = this.tab.id;
			}

			if (/^init\b/.test(req.command)) {
				workers[req.internalId] = this;
			}

			that.receiver(req.command, req.data, tabId, function (res) {
				var message = {
					payload: res || {}
				};

				if ('messageId' in req) {
					message.messageId = req.messageId;
				}

				try {
					theWorker.postMessage(message);
				}
				catch (e) {}
			});
		}

		base.apply(this, arguments);

		require('sdk/simple-prefs').on('optionsOpener', function () {
			tabs.open(self.data.url('options.html'));
		});

		Object.defineProperty(this, 'workers', {value: workers});
		(options.contentScripts || []).forEach(function (spec) {
			PageMod({
				include: new PseudoRegexRule(
					spec.name,
					spec.matches,
					spec.exclude_matches
				),
				contentScriptWhen: spec.run_at || 'end',
				contentScriptFile: spec.js.map(function (file) {
					return self.data.url(file);
				}),
				contentScriptOptions:{extensionId:self.id},
				attachTo: ['existing', 'top', 'frame'],
				onAttach: registerWorker
			});
		});
	}

	FirefoxImpl.prototype = Object.create(base.prototype, {
		kind: {value: 'Firefox'},
		isDev: {value: self.version == '0.0.1'},
		version: {value: self.version},
		id: {value: self.id},
		messageCatalogPath: {get: getMessageCatalogPath},

		receive: {value: receive},
		openTabWithUrl: {value: openTabWithUrl},
		openTabWithFile: {value: openTabWithFile},
		isTabExist: {value: isTabExist},
		closeTab: {value: closeTab},
		focusTab: {value: focusTab},
		getTabTitle: {value: getTabTitle},
		broadcastToAllTabs: {value: broadcastToAllTabs},
		createTransport: {value: createTransport},
		createFormData: {value: createFormData},
		createBlob: {value: createBlob},
		postMessage: {value: postMessage},
		broadcast: {value: broadcast}
	});
	FirefoxImpl.prototype.constructor = base;

	base.register(function (global, options) {
		return new FirefoxImpl(global, options);
	});
})();

// vim:set ts=4 sw=4 fenc=UTF-8 ff=unix ft=javascript fdm=marker :

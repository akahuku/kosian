/**
 * Firefox extension wrapper
 *
 * @author akahuku@gmail.com
 */

(function () {
	'use strict';

	var self = require('sdk/self');
	var tabs = require('sdk/tabs');
	var l10n = require('sdk/l10n/locale');
	var XMLHttpRequest = require('sdk/net/xhr').XMLHttpRequest;
	var MatchPattern = require('sdk/util/match-pattern').MatchPattern;
	var base = require('kosian/Kosian').Kosian;

	function receive (callback) {
		this.receiver = callback;
	}

	function openTabWithUrl (url, selfUrl, callback) {
		tabs.open({
			url: url,
			onReady: function (tab) {
				callback && emit(callback, tab.id, tab.url);
				callback = null;
			}
		});
	}

	function openTabWithFile (file, callback) {
		tabs.open({
			url: self.data.url(file),
			onReady: function (tab) {
				callback && emit(callback, tab.id, tab.url);
				callback = null;
			}
		});
	}

	function isTabExist (id) {
		return Array.prototype.some.call(tabs, function (tab) {
			return tab.id == id;
		});
	}

	function closeTab (id) {
		Array.prototype.some.call(tabs, function (tab) {
			if (tab.id == id) {
				tab.close();
				return true;
			}
		});
	}

	function focusTab (id) {
		Array.prototype.some.call(tabs, function (tab) {
			if (tab.id == id) {
				tab.activate();
				return true;
			}
		});
	}

	function getTabTitle (id, callback) {
		Array.prototype.some.call(tabs, function (tab) {
			if (tab.id == id) {
				this.emit(callback, tab.title);
				return true;
			}
		}, this);
	}

	function createTransport () {
		return new XMLHttpRequest;
	}

	function createFormData () {
		switch (arguments.length) {
		case 0:
			return new FormData;
		default:
			return new FormData(arguments[0]);
		}
	}

	function createBlob () {
		switch (arguments.length) {
		case 0:
			return new Blob;
		case 1:
			return new Blob(arguments[0]);
		default:
			return new Blob(arguments[0], arguments[1]);
		}
	}

	function sendRequest () {
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

		this.workers.some(function (worker) {
			if (id === undefined && worker.tab == tabs.activeTab
			||  id !== undefined && worker.tab.id == id) {
				try {
					worker.postMessage({payload: message});
				}
				catch (e) {}
				return true;
			}
		});
	}

	function broadcast (message, exceptId) {
		this.workers.forEach(function (worker) {
			if (exceptId !== undefined && worker.tab.id == exceptId) return;

			try {
				worker.postMessage({payload: message});
			}
			catch (e) {}
		});
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

	function FirefoxImpl (global, options) {
		var that = this;
		var workers = [];

		function removeWorker (worker) {
			var index = workers.indexOf(worker);
			index >= 0 && workers.splice(index, 1);
		}

		function registerWorker (worker) {
			worker.on('detach', handleWorkerDetach);
			worker.on('message', handleWorkerMessage);
			workers.push(worker);
		}

		function handleWorkerDetach () {
			removeWorker(this);	// 'this' points Worker here
		}

		function handleWorkerMessage (req) {
			if (!that.receiver) return;

			var theWorker = this;
			that.receiver(req.command, req.data, this.tab.id, function (res) {
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

		function applyContentScript (tab) {
			(options.contentScripts || []).forEach(function (spec) {
				var matched = false;
				var excluded = false;

				if ('matches' in spec) {
					matched = spec.matches.some(function (pattern) {
						return typeof pattern == 'function' ?
							pattern(tab.url) :
							(new MatchPattern(pattern)).test(tab.url);
					});
				}

				if ('exclude_matches' in spec) {
					excluded = spec.exclude_matches.some(function (pattern) {
						return typeof pattern == 'function' ?
							pattern(tab.url) :
							(new MatchPattern(pattern)).test(tab.url);
					});
				}

				if (matched && !excluded && 'js' in spec) {
					registerWorker(tab.attach({
						contentScriptWhen: spec.run_at || 'start',
						contentScriptFile: spec.js.map(function (file) {
							return self.data.url(file);
						}),
						contentScriptOptions:{extensionId:self.id}
					}));
				}
			});
		}

		base.apply(this, arguments);

		Object.defineProperty(this, 'workers', {value: workers});
		Array.prototype.forEach.call(tabs, applyContentScript);
		tabs.on('ready', applyContentScript);
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
		createTransport: {value: createTransport},
		createFormData: {value: createFormData},
		createBlob: {value: createBlob},
		sendRequest: {value: sendRequest},
		broadcast: {value: broadcast}
	});
	FirefoxImpl.prototype.constructor = base;

	base.register(function (global, options) {
		return new FirefoxImpl(global, options);
	});
})();

// vim:set ts=4 sw=4 fenc=UTF-8 ff=unix ft=javascript fdm=marker :

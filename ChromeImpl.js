/**
 * chrome extension wrapper
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

	var base = require('kosian/Kosian').Kosian;

	function receive (callback) {
		chrome.runtime.onMessage.addListener(function (req, sender, res) {
			/*
			console.log('received a message, and sender is:\n' +
				[
				' sender.tab.id: ' + sender.tab.id,
				'sender.tab.url: ' + sender.tab.url,
				'     sender.id: ' + (sender.id || '?'),
				'    sender.url: ' + (sender.url || '?'),
				'       command: ' + req.command
				].join('\n'));
			 */
			var data = req.data;
			delete req.data;
			return !!callback(req, data, sender.tab.id, res);
		});
	}

	function openTabWithUrl (url, selfUrl, callback) {
		var that = this;
		chrome.tabs.create({url:url}, function (tab) {
			that.emit(callback, tab.id, url);
		});
	}

	function openTabWithFile (file, callback) {
		var that = this;
		chrome.tabs.create({url:chrome.runtime.getURL(file)}, function (tab) {
			that.emit(callback, tab.id, url);
		});
	}

	function isTabExist (id) {
		return id in this.tabIds;
	}

	function closeTab (id) {
		chrome.tabs.get(id, function () {
			chrome.tabs.remove(id);
		});
	}

	function focusTab (id) {
		chrome.tabs.get(id, function () {
			chrome.tabs.update(id, {active:true});
		});
	}

	function getTabTitle (id, callback) {
		var that = this;
		chrome.tabs.get(id, function (tab) {
			that.emit(callback, tab.title);
		});
	}

	function broadcastToAllTabs (message, exceptId) {
		chrome.tabs.query({}, function (tabs) {
			tabs.forEach(function (tab) {
				if (exceptId !== undefined && tab.id == exceptId) return;

				try {
					chrome.tabs.sendRequest(tab.id, message);
				}
				catch (e) {}
			});
		});
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

		if (id === undefined) {
			chrome.tabs.query({active: true}, function (tabs) {
				try {
					chrome.tabs.sendRequest(tabs[0].id, message);
				}
				catch (e) {}
			});
		}
		else {
			try {
				chrome.tabs.sendRequest(id, message);
			}
			catch (e) {}
		}
	}

	function broadcast (message, exceptId) {
		for (var id in this.tabIds) {
			if (id == exceptId) continue;
			try {
				chrome.tabs.sendRequest(id, message);
			}
			catch (e) {}
		}
	}

	function ChromeImpl () {
		var tabIds = {};

		base.apply(this, arguments);

		chrome.tabs.query({}, function (tabs) {
			tabs.forEach(function (tab) {
				tabIds[tab.id] = 1;
			});
		});
		chrome.tabs.onCreated.addListener(function (tab) {
			tabIds[tab.id] = 1;
		});
		chrome.tabs.onRemoved.addListener(function (id) {
			delete tabIds[id];
		});
		Object.defineProperty(this, 'tabIds', {value: tabIds});
	}

	ChromeImpl.prototype = Object.create(base.prototype, {
		kind: {value: 'Chrome'},
		isDev: {value: chrome.app.getDetails().version == '0.0.1'},
		version: {value: chrome.app.getDetails().version},
		id: {value: chrome.app.getDetails().id},

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
	ChromeImpl.prototype.constructor = base;

	base.register(function (global, options) {
		return new ChromeImpl(global, options);
	});
})();

// vim:set ts=4 sw=4 fenc=UTF-8 ff=unix ft=javascript fdm=marker :

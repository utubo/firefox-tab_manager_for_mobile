const KEY_AND_DEFAULT_VALUES = {
	activeTabId: null,
	tabs: {},
	recent: [],
	theme: 'default',
	css: '',
	autoClose: false,
	thresholdConfirmClosing: 2,
	listDiscardedTabs: false,
	version: '1.17.2'
};

(() => {
	'use strict';

	const TAB_MANAGER_URL = chrome.extension.getURL('tab_manager.html');
	const RECENT_MAX_COUNT = 20;
	let browserActionClicked;
	let ini = {};

	const openiniagerPage = () => {
		browserActionClicked = true;
		browser.tabs.create({ url: TAB_MANAGER_URL, active: true });
	};

	browser.browserAction.onClicked.addListener(openiniagerPage);

	browser.runtime.onMessage.addListener(async (req, sender, res) => {
		let arg = {};
		if (req[0] === '{') {
			arg = JSON.parse(req);
			req = arg.command;
		}
		if (req === 'updateIni') {
			const oldTheme = ini.theme;
			for (let key in arg.updateParams) {
				ini[key] = arg.updateParams[key];
			}
			saveIni().then(() => {
				if (oldTheme !== ini.theme) {
					openiniagerPage();
				}
			});
		} else {
			ini.activeTabId = await browser.storage.session.get('activeTabId').activeTabId;
			res(ini);
		}
	});

	const saveIni = async () => {
		await browser.storage.local.set({ 'tab_manager': ini });
	};

	const loadIni = async () => {
		const res = await browser.storage.local.get('tab_manager');
		if (!res) return;
		if (!res.tab_manager) return;
		for (let key in KEY_AND_DEFAULT_VALUES) {
			ini[key] = res.tab_manager[key] || KEY_AND_DEFAULT_VALUES[key];
		}
	};

	// save tabs ----------------------
	const refleshTabs = async () => {
		const tabs = await browser.tabs.query({});
		const newTabs = {};
		for (let tab of tabs) {
			if (!tab.title && tab.url === 'about:blank' && ini.tabs[tab.id]) {
				newTabs[tab.id] = ini.tabs[tab.id];
			} else {
				newTabs[tab.id] = { title: tab.title, url: tab.url };
			}
		}
		if (ini.listDiscardedTabs) {
			Object.assign(ini.tabs, newTabs);
		} else {
			ini.tabs = newTabs;
		}
		saveIni();
	};
	let refleshTabsTimer;
	const refleshTabsLezy = () => {
		clearTimeout(refleshTabsTimer);
		refleshTabsTimer = setTimeout(refleshTabs, 300);
	};

	let saveIniTimer;
	const saveIniLezy = () => {
		clearTimeout(saveIniTimer);
		saveIniTimer = setTimeout(saveIni, 300);
	};

	const applyNewTabInfo = (id, _, tab) => {
		const t = ini.tabs[id] || {};
		t.url = tab.url;
		t.title = tab.title;
		ini.tabs[id] = t;
		saveIniLezy();
	};

	browser.tabs.onUpdated.addListener(applyNewTabInfo);

	browser.tabs.onRemoved.addListener(refleshTabsLezy);

	browser.tabs.onCreated.addListener(tab => {
		refleshTabsLezy(tab.id, null, tab);
	});

	// recent tabs ---------------------
	browser.tabs.onRemoved.addListener((tabId, _) => {
		const tab = ini.tabs[tabId];
		if (!tab) return;
		if (!tab.url) return;
		if (tab.url === TAB_MANAGER_URL) return;
		if (!tab.url.startsWith('http')) return;
		const index = ini.recent.findIndex(elm => elm.url === tab.url);
		if (index === 0) return;
		if (index !== -1) {
			ini.recent.splice(index, 1);
		}
		ini.recent.unshift({ title: tab.title, url: tab.url });
		ini.recent.splice(RECENT_MAX_COUNT);
		saveIni();
	});

	// keep last activate --------------
	browser.tabs.onActivated.addListener(async info => {
		const tab = await browser.tabs.get(info.tabId);
		if (tab.url !== TAB_MANAGER_URL) {
			browser.storage.session.set({ activeTabId: tab.id });
		}
	});

	// START HERE ! -------------------
	loadIni();
	browser.tabs.query({active: true, currentWindow: true}).then(tabs => {
		browser.storage.session.set({ activeTabId: tabs[0].id });
	});
})();


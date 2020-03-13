const KEY_AND_DEFAULT_VALUES = {
	activeTabId: null,
	tabs: {},
	recent: [],
	theme: 'default',
	css: '',
	autoClose: false,
	thresholdConfirmClosing: 2
};

var ini = ini || JSON.parse(JSON.stringify(KEY_AND_DEFAULT_VALUES));

(() => {
	'use strict';

	const TAB_MANAGER_URL = chrome.extension.getURL('tab_manager.html');
	const RECENT_MAX_COUNT = 20;
	let pageActionClicked;

	const openiniagerPage = () => {
		pageActionClicked = true;
		browser.tabs.create({ url: TAB_MANAGER_URL, active: true });
	};

	browser.pageAction.onClicked.addListener(openiniagerPage);

	browser.runtime.onMessage.addListener((req, sender, res) => {
		let arg = {};
		if (req[0] === '{') {
			arg = JSON.parse(req);
			req = arg.command;
		}
		if (req === 'updateIni') {
			let oldTheme = ini.theme;
			for (let key in arg.updateParams) {
				ini[key] = arg.updateParams[key];
			}
			saveIni().then(() => {
				if (oldTheme !== ini.theme) {
					openiniagerPage();
				}
			});
		} else {
			res(ini);
		}
	});

	const saveIni = async () => {
		await browser.storage.local.set({ 'tab_manager': ini });
	};

	const loadIni = async () => {
		let res = await browser.storage.local.get('tab_manager');
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
		let index = -1;
		for (let tab of tabs) {
			index ++;
			if (!tab.title && tab.url === 'about:blank' && ini.tabs[tab.id]) {
				newTabs[tab.id] = ini.tabs[tab.id];
			} else {
				newTabs[tab.id] = { title: tab.title, url: tab.url };
			}
		}
		ini.tabs = newTabs;
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
	const applyNewTabInfo = (id, info, tab) => {
		let t = ini.tabs[id] || {};
		t.url = tab.url;
		t.title = tab.title;
		ini.tabs[id] = t;
		saveIniLezy();
	};

	browser.tabs.onUpdated.addListener(applyNewTabInfo);

	browser.tabs.onRemoved.addListener(refleshTabsLezy);

	browser.tabs.onCreated.addListener(tab => {
		browser.pageAction.show(tab.id);
		refleshTabsLezy(tab.id, null, tab);
	});

	// recent tabs ---------------------
	browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
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
	browser.tabs.onActivated.addListener(info => {
		if (pageActionClicked) {
			pageActionClicked = false;
			return;
		}
		browser.tabs.get(info.tabId).then(tab => {
			if (tab.url !== TAB_MANAGER_URL) {
				ini.activeTabId = tab.id;
				browser.pageAction.show(tab.id);
			}
		});
	});

	// START HERE ! -------------------
	loadIni();
	browser.tabs.query({active: true, currentWindow: true}).then(tabs => {
		ini.activeTabId = tabs[0].id;
		browser.pageAction.show(tabs[0].id);
	});
})();


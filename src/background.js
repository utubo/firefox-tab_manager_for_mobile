var TabMan = TabMan || {
	activeTabId: null,
	tabs: {},
	recent: [],
	theme: 'default',
	autoClose: false
};
(() => {
	'use strict';

	const TAB_MANAGER_URL = chrome.extension.getURL('tab_manager.html');
	const RECENT_MAX_COUNT = 20;
	let pageActionClicked;

	const openTabManagerPage = () => {
		pageActionClicked = true;
		browser.tabs.create({ url: TAB_MANAGER_URL, active: true });
	};

	browser.pageAction.onClicked.addListener(openTabManagerPage);

	browser.runtime.onMessage.addListener((req, sender, res) => {
		let arg = {};
		if (req[0] === '{') {
			arg = JSON.parse(req);
			req = arg.command;
		}
		if (req === 'updateIni') {
			let oldTheme = TabMan.theme;
			for (let key in arg.updateParams) {
				TabMan[key] = arg.updateParams[key];
			}
			saveIni().then(() => {
				if (oldTheme !== TabMan.theme) {
					openTabManagerPage();
				}
			});
		} else {
			res({
				activeTabId: TabMan.activeTabId,
				tabs: TabMan.tabs,
				recent: TabMan.recent,
				theme: TabMan.theme,
				css: TabMan.css,
				autoClose: TabMan.autoClose
			});
		}
	});

	const saveIni = async () => {
		await browser.storage.local.set({ 'tab_manager': {
			tabs: TabMan.tabs,
			recent: TabMan.recent,
			theme: TabMan.theme,
			css: TabMan.css,
			autoClose: TabMan.autoClose
		} });
	};

	const loadIni = async () => {
		let res = await browser.storage.local.get('tab_manager');
		if (!res) return;
		if (!res.tab_manager) return;
		TabMan.tabs = res.tab_manager.tabs;
		TabMan.recent = res.tab_manager.recent || [];
		TabMan.theme = res.tab_manager.theme;
		TabMan.css = res.tab_manager.css || '';
		TabMan.autoClose = res.tab_manager.autoClose;
	};

	// save tabs ----------------------
	const refleshTabs = async () => {
		const tabs = await browser.tabs.query({});
		const newTabs = {};
		let index = -1;
		for (let tab of tabs) {
			index ++;
			if (!tab.title && tab.url === 'about:blank' && TabMan.tabs[tab.id]) {
				newTabs[tab.id] = TabMan.tabs[tab.id];
			} else {
				newTabs[tab.id] = { title: tab.title, url: tab.url };
			}
		}
		TabMan.tabs = newTabs;
		saveIni();
	};
	let refleshTabsTimer;
	const refleshTabsLezy = () => {
		window.clearTimeout(refleshTabsTimer);
		refleshTabsTimer = window.setTimeout(refleshTabs, 300);
	};

	let saveIniTimer;
	const saveIniLezy = () => {
		window.clearTimeout(saveIniTimer);
		saveIniTimer = window.setTimeout(saveIni, 300);
	};
	const applyNewTabInfo = (id, info, tab) => {
		let t = TabMan.tabs[id] || {};
		t.url = tab.url;
		t.title = tab.title;
		TabMan.tabs[id] = t;
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
		const tab = TabMan.tabs[tabId];
		if (!tab) return;
		if (!tab.url) return;
		if (tab.url === TAB_MANAGER_URL) return;
		if (!tab.url.startsWith('http')) return;
		const index = TabMan.recent.findIndex(elm => elm.url === tab.url);
		if (index === 0) return;
		if (index !== -1) {
			TabMan.recent.splice(index, 1);
		}
		TabMan.recent.unshift({ title: tab.title, url: tab.url });
		TabMan.recent.splice(RECENT_MAX_COUNT);
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
				TabMan.activeTabId = tab.id;
				browser.pageAction.show(tab.id);
			}
		});
	});

	// START HERE ! -------------------
	loadIni();
	browser.tabs.query({active: true, currentWindow: true}).then(tabs => {
		TabMan.activeTabId = tabs[0].id;
		browser.pageAction.show(tabs[0].id);
	});
})();


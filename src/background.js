var TabMan = TabMan || {
	activeTabId: null,
	tabs: {},
	recent: [],
	recentMaxCount: 10,
	theme: 'default'
};
(() => {
	'use strict';

	const TAB_MANAGER_URL = chrome.extension.getURL('tab_manager.html');
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
				recentMaxCount: TabMan.recentMaxCount,
				theme: TabMan.theme,
				css: TabMan.css
			});
		}
	});

	const saveIni = async () => {
		await browser.storage.local.set({ 'tab_manager': {
			tabs: TabMan.tabs,
			recent: TabMan.recent,
			recentMaxCount: TabMan.recentMaxCount,
			theme: TabMan.theme,
			css: TabMan.css
		} });
	};

	const loadIni = async () => {
		let res = await browser.storage.local.get('tab_manager');
		if (!res) return;
		if (!res.tab_manager) return;
		TabMan.tabs = res.tab_manager.tabs;
		TabMan.recent = res.tab_manager.recent || [];
		TabMan.recentMaxCount = res.tab_manager.recentMaxCount || 10;
		TabMan.theme = res.tab_manager.theme;
		TabMan.css = res.tab_manager.css;
	};

	// save tabs ----------------------
	const refleshTabs = () => {
		browser.tabs.query({}).then(tabs => {
			const newTabs = {};
			for (let tab of tabs) {
				if (tab.url === TAB_MANAGER_URL) continue;
				if (!tab.title && tab.url === 'about:blank' && TabMan.tabs[tab.id]) {
					newTabs[tab.id] = TabMan.tabs[tab.id];
				} else {
					newTabs[tab.id] = { title: tab.title, url: tab.url };
				}
			}
			TabMan.tabs = newTabs;
		});
		saveIni();
	};
	let refleshTabsTimer;
	const refleshTabsLezy = (id, info, tab) => {
		window.clearTimeout(refleshTabsTimer);
		refleshTabsTimer = window.setTimeout(refleshTabs, 1000);
	};

	browser.tabs.onUpdated.addListener(refleshTabsLezy);

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
		TabMan.recent.splice(TabMan.recentMaxCount);
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


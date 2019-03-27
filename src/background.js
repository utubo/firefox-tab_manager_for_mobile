var TabMan = TabMan || { activeTabId: null, tabs: {}, recent: [] };
(() => {
	'use strict';

	let MAX_RECENT = 10;
	let TAB_MANAGER_URL = chrome.extension.getURL('tab_manager.html');
	let pageActionClicked;

	browser.runtime.onMessage.addListener((m, s, r) => {
		r({
			activeTabId: TabMan.activeTabId,
			tabs: TabMan.tabs,
			recent: TabMan.recent
		});
	});

	browser.pageAction.onClicked.addListener(tab => {
		pageActionClicked = true;
		browser.tabs.create({ url: TAB_MANAGER_URL, active: true });
	});

	let saveIni = () => {
		browser.storage.local.set({ 'tab_manager': { tabs: TabMan.tabs, recent: TabMan.recent } });
	};

	// save tabs ----------------------
	let refleshTabs = () => {
		browser.tabs.query({}).then(tabs => {
			let newTabs = {};
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
	let refleshTabsLezy = (id, info, tab) => {
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
	browser.tabs.onRemoved.addListener(tab => {
		if (tab.url === TAB_MANAGER_URL) return;
		if (!tab.url.startsWith('http')) return;
		let index = null;
		for (let i = TabMan.recent.length - 1; 0 <= i; i--) {
			if (TabMan.recent[i].url === tab.url) {
				index = i;
				break;
			}
		}
		if (index === 0) return;
		if (index) {
			TabMan.recent.unshift(TabMan.recent[index]);
		} else {
			TabMan.recent.unshift({ title: tab.title, url: tab.url });
			TabMan.recent.splice(MAX_RECENT);
		}
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
	browser.storage.local.get('tab_manager').then(res => {
		if (res && res.tab_manager) {
			TabMan.tabs = res.tab_manager.tabs;
		}
	});
	browser.tabs.query({active: true, currentWindow: true}).then(tabs => {
		TabMan.activeTabId = tabs[0].id;
		browser.pageAction.show(tabs[0].id);
	});
})();


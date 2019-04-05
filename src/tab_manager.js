(() => {
	'use strict';

	// utils (basic) ------------------
	let byId = id => document.getElementById(id);
	let byClass = (p, clazz) => p.getElementsByClassName(clazz)[0];
	let copyToClipbd = text => {
		let work = document.createElement('TEXTAREA');
		work.value = text;
		document.body.appendChild(work);
		work.select();
		document.execCommand('copy');
		document.body.removeChild(work);
	};

	// const -------------------------
	let FLOAT_TRIGGER = 32;
	let DELETE_TRIGGER = 80;
	let CLOSE_WAIT_MSEC = 600;
	let LONG_TAP_MSEC = 400;

	// fields -------------------------
	let TAB_MANAGER_URL = chrome.extension.getURL('tab_manager.html');
	let TAB_MANAGER_ID = null;
	let activeTabId;
	let savedTabs = {};
	let recent = {};
	let touchmoved = false;

	// DOM cache ---------------------
	let tabs = []; // <li>
	let tabList = byId('tabList'); // <ul>
	let tabMenu = byId('tabMenu'); // <ul>
	let recentList = byId('recentList'); // <ul>

	// utils for tab manager ---------
	let tabId = li => li.id.replace(/^tab_/, '') | 0;

	let checked = li => byClass(li, 'checkbox').classList.contains('checked');

	let remove = li => {
		tabs.splice(tabs.indexOf(li), 1);
		browser.tabs.remove(tabId(li));
		li.classList.add('removing');
		window.setTimeout(() => { li.parentNode.removeChild(li); }, 510);
	};

	// tools --------------------------
	let floater = {
		tab: null,
		div: byId('floater'),
		hide: () => {
			if (floater.div.classList.contains('slideout')) return;
			floater.div.classList.add('hide');
			if (floater.div.firstChild) {
				floater.div.removeChild(floater.div.firstChild);
			}
			if (floater.tab) {
				floater.tab.parentNode.classList.remove('float-target-parent');
				floater.tab.classList.remove('float-target');
				floater.tab = null;
			}
		},
		slideout: () => {
			floater.div.classList.add('slideout');
			window.setTimeout(() => {
				floater.div.style.left = (floater.dx < 0 ? '-' : '') +  window.innerWidth + 'px';
			});
			window.setTimeout(() => {
				floater.div.classList.remove('slideout');
				remove(floater.tab);
				floater.hide();
			}, 350);
		},
		show: () => {
			if (floater.div.firstChild) floater.div.removeChild(floater.div.firstChild);
			floater.div.appendChild(floater.tab.cloneNode(true));
			floater.div.classList.remove('transparent');
			floater.div.classList.remove('hide');
			floater.tab.classList.add('float-target');
			floater.tab.parentNode.classList.add('float-target-parent');
		},
		setPosition: (x, y, force) => {
			if (x !== floater.dx || force) floater.div.style.left = x + 'px';
			if (y !== floater.dy || force) floater.div.style.top = (y  + floater.offsetTop) + 'px';
			floater.dx = x;
			floater.dy = y;
		}
	};

	// actions ------------------------
	let toolButtons = {
		reloadSelectedTabs: () => {
			for (let tab of tabs) {
				if (checked(tab)) {
					tab.classList.add('reloading');
					browser.tabs.reload(tabId(tab));
				}
			}
		},
		closeSelectedTabs: () => {
			for (let tab of [].concat(tabs)) {
				if (checked(tab)) remove(tab);
			}
		},
		closeAllTabs: () => {
			for (let tab of [].concat(tabs)) {
				remove(tab);
			}
		},
		closeUnselectedTabs: () => {
			for (let tab of [].concat(tabs)) {
				if (!checked(tab)) remove(tab);
			}
		},
		closeLeftTabs: () => {
			for (let tab of [].concat(tabs)) {
				if (checked(tab)) return;
				remove(tab);
			}
		},
		closeRightTabs: () => {
			for (let i = tabs.length - 1; 0 <= i; i --) {
				let tab = tabs[i];
				if (checked(tab)) return;
				remove(tab);
			}
		},
		recent: () => {
			popupMenu.popupAsRecent();
		}
	};

	let popupMenu = {
		// long tap to popup -----------
		popuped: false,
		div: byId('popupmenu'),
		popup: () => {
			popupMenu.tab = floater.tab;
			byId('menuTitle').textContent = byClass(popupMenu.tab, 'title').textContent;
			byId('menuUrl').textContent = byClass(popupMenu.tab, 'url').textContent;
			tabMenu.classList.remove('hide');
			recentList.classList.add('hide');
			floater.hide();
			popupMenu.div.classList.add('popuped');
			popupMenu.popuped = true;
		},
		popupAsRecent: async () => {
			let res = await browser.storage.local.get('tab_manager');
			if (!res && !res.tab_manager) return;
			recent = res.tab_manager.recent;
			byId('recentListItems').remove();
			let items = document.createElement('DIV');
			items.id = 'recentListItems';
			let template = byId('recentTemplate');
			for (let r of recent) {
				let li = template.cloneNode(true);
				li.id = 'recent_' + r.url;
				byClass(li, 'title').textContent = r.title;
				byClass(li, 'url').textContent = r.url;
				items.appendChild(li);
			}
			recentList.appendChild(items);
			tabMenu.classList.add('hide');
			recentList.classList.remove('hide');
			floater.hide();
			popupMenu.div.classList.add('popuped');
			popupMenu.popuped = true;
		},
		close: () => {
			if (!popupMenu.popuped) return;
			popupMenu.popuped = false;
			popupMenu.div.classList.remove('popuped');
		},
		popupTimer: null,
		clearTimer: () => {
			window.clearTimeout(popupMenu.popupTimer);
		},
		setTimer: () => {
			popupMenu.popuped = false;
			popupMenu.clearTimer();
			popupMenu.popupTimer = window.setTimeout(popupMenu.popup, LONG_TAP_MSEC);
		},
		// actions --------------------
		closeThisTab: () => {
			remove(popupMenu.tab);
		},
		closeOtherTabs: () => {
			if (tabs.length <= 1) return;
			for (let tab of [].concat(tabs)) {
				if (tab === popupMenu.tab) continue;
				remove(tab);
			}
		},
		cloneThisTab: () => {
			if (browser.tabs.duplicate) {
				browser.tabs.duplicate(tabId(popupMenu.tab));
			} else {
				browser.tabs.create({ url: byClass(popupMenu.tab, 'url').textContent });
			}
			browser.tabs.remove(TAB_MANAGER_ID);
		},
		closeLeftTabsFromThis: () => {
			for (let tab of [].concat(tabs)) {
				if (tab === popupMenu.tab) return;
				remove(tab);
			}
		},
		closeRightTabsFromThis: () => {
			for (let i = tabs.length - 1; 0 <= i; i --) {
				let tab = tabs[i];
				if (tab === popupMenu.tab) return;
				remove(tab);
			}
		},
		titleAndUrl: tab => {
			return byClass(tab, 'title').textContent + '\n' + byClass(tab, 'url').textContent + '\n';
		},
		copyTitleAndUrl: () => {
			copyToClipbd(popupMenu.titleAndUrl(popupMenu.tab));
		},
		copyTitleAndURLofAllCheckedTabs: () => {
			let lines = [];
			for (let tab of tabs) {
				if (!checked(tab)) continue;
				lines.push(popupMenu.titleAndUrl(tab));
			}
			copyToClipbd(lines.join('\n'));
		},
	};

	// others -------------------------
	let slideout = (tab, startX) => {
		tab.style.marginLeft = startX + 'px';
		window.setTimeout(() => { tab.classList.add('slideout'); });
		window.setTimeout(() => { tab.style.marginLeft = (startX < 0 ? '-' : '') +  window.innerWidth + 'px'; });
		window.setTimeout(() => { tab.classList.remove('slideout'); }, 500);
		window.setTimeout(() => { remove(tab); }, 600);
	};

	// setup tab manager page ---------
	let closeOtherTabManagerTabs = _tabs => {
		for (let i = _tabs.length - 1; 0 <= i; i --) {
			let tab = _tabs[i];
			if (tab.active) continue;
			if (tab.url !== TAB_MANAGER_URL) continue;
			browser.tabs.remove(tab.id);
			_tabs.splice(i, 1);
		}
	};

	let listupTabs = _tabs => {
		let activeTab;
		let template = byId('template');
		for (let tab of _tabs) {
			if (tab.url === TAB_MANAGER_URL) {
				TAB_MANAGER_ID = tab.id;
				continue;
			}
			let li = template.cloneNode(true);
			li.id = 'tab_' + tab.id;
			if (!tab.title && tab.url === 'about:blank') {
				if (savedTabs[tab.id]) {
					tab = savedTabs[tab.id];
				} else {
					byClass(li, 'title').classList.add('not-loaded');
					tab = { title: 'Not Loaded', url: '' };
				}
			}
			byClass(li, 'title').textContent = tab.title;
			byClass(li, 'url').textContent = tab.url;
			if (tab.id === activeTabId) {
				activeTab = li;
				li.classList.add('active');
				byClass(li, 'checkbox').classList.add('checked');
			}
			tabs.push(li);
			tabList.appendChild(li);
		}
		activeTab && window.setTimeout(() => { activeTab.scrollIntoView(); });
	};

	browser.runtime.sendMessage('').then(res => {
		activeTabId = res.activeTabId;
		savedTabs = res.tabs;
		browser.tabs.query({}).then(_tabs => {
			closeOtherTabManagerTabs(_tabs);
			listupTabs(_tabs);
		});
	});

	let menuItems = document.getElementsByClassName('menuitem');
	for (let menuItem of menuItems) {
		menuItem.textContent = chrome.i18n.getMessage(menuItem.id);
	}

	window.addEventListener('click', e => {
		popupMenu.close();
		if (e.target.classList.contains('menuitem')) {
			popupMenu[e.target.id]();
			e.preventDefault();
		} else if (e.target.classList.contains('tool-button')) {
			e.preventDefault();
			toolButtons[e.target.id]();
		} else if (e.target.classList.contains('checkbox')) {
			e.target.classList.toggle('checked');
		} else if (e.target.classList.contains('recent')) {
			browser.tabs.create({ url: byClass(e.target, 'url').textContent, active: true });
			browser.tabs.remove(TAB_MANAGER_ID);
		}
	});
	let getXY = e => e.touches ? [e.touches[0].clientX, e.touches[0].clientY] : [e.pageX, e.pageY];
	tabList.addEventListener('ontouchstart' in window ? 'touchstart' : 'mousedown', e => {
		touchmoved = false;
		popupMenu.clearTimer();
		if (!e.target.classList.contains('tab')) return;
		e.preventDefault();
		[floater.startX, floater.startY] = getXY(e);
		floater.offsetTop = e.target.offsetTop + tabList.offsetTop - tabList.scrollTop;
		floater.tab = e.target;
		floater.stickyX = true;
		floater.stickyY = true;
		floater.setPosition(0, 0, true);
		popupMenu.setTimer();
	});
	window.addEventListener('ontouchmove' in window ? 'touchmove' : 'mousemove', e => {
		if (!floater.tab) return;
		popupMenu.clearTimer();
		touchmoved = true;
		let [x, y] = getXY(e);
		let dx = x - floater.startX;
		let dy = y - floater.startY;
		if (floater.stickyX) {
			if (Math.abs(dx) < FLOAT_TRIGGER) return;
			floater.stickyX = false;
			floater.show();
		}
		// these does not work.
		// e.preventDefault();
		// e.stopPropagation();
		// e.stopImmediatePropagation();
		if (floater.stickyY && browser.tabs.move && FLOAT_TRIGGER < Math.abs(dy)) {
			floater.stickyY = false;
		}
		floater.setPosition(dx, floater.stickyY ? 0 : dy);
	});
	window.addEventListener('ontouchend' in window ? 'touchend' : 'mouseup', e => {
		if (!floater.tab) return;
		popupMenu.clearTimer();
		try {
			// ignore when target is not a list item.
			if (e.target.classList.contains('menuitem')) {
				return;
			}
			if (popupMenu.popuped) {
				return;
			}
			e.preventDefault();
			// tap a list item.
			if (!touchmoved) {
				browser.tabs.update(tabId(floater.tab), { active: true });
				browser.tabs.remove(TAB_MANAGER_ID);
				return;
			}
			// swipe a list item.
			if (!floater.stickyY) {
				let y = floater.tab.offsetTop + floater.dy;
				let p = tabs.length;
				for (let i = 0; i < tabs.length - 1; i ++) {
					if (y < tabs[i].offsetTop) {
						if (tabs[i] == floater.tab) return;
						p = i;
						break;
					}
				}
				let targetId = tabId(floater.tab);
				tabs.splice(p, 0, tabs.splice(tabs.indexOf(floater.tab), 1)[0]);
				tabList.insertBefore(floater.tab, tabs[p + 1]);
				if (p < tabs.length - 1) {
					browser.tabs.get(tabId(tabs[p + 1])).then(_tab => {
						browser.tabs.move(targetId, { index: _tab.index });
					});
				} else if (1 < tabs.length) {
					browser.tabs.get(tabId(tabs[tabs.length - 2])).then(_tab => {
						browser.tabs.move(targetId, { index: _tab.index });
					});
				}
			} else if (DELETE_TRIGGER < Math.abs(floater.dx)) {
				floater.slideout();
				window.setTimeout(() => {
					if (!tabs.length) {
						browser.tabs.remove(TAB_MANAGER_ID);
					}
				}, CLOSE_WAIT_MSEC);
			}
		} catch (ex) {
			alert(ex.message);
		} finally {
			floater.hide();
		}
	});

	byId('cover').classList.add('transparent');
})();


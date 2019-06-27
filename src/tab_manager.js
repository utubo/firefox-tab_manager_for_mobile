(() => {
	'use strict';

	browser.runtime.sendMessage('loadIni').then(res => {
		// apply theme fist!
		if (res.theme === 'dark') {
			browser.tabs.insertCSS({ file: chrome.extension.getURL('theme_dark.css') });
		}
		if (res.css) {
			browser.tabs.insertCSS({ code: res.css });
		}
		// other settings
		activeTabId = res.activeTabId;
		savedTabs = res.tabs;
		browser.tabs.query({}).then(_tabs => {
			closeOtherTabManagerTabs(_tabs);
			listupTabs(_tabs);
		});
	});


	// utils (basic) ------------------
	const byId = id => document.getElementById(id);
	const byClass = (p, clazz) => p.getElementsByClassName(clazz)[0];
	const copyToClipbd = text => {
		const work = document.createElement('TEXTAREA');
		work.value = text;
		document.body.appendChild(work);
		work.select();
		document.execCommand('copy');
		document.body.removeChild(work);
	};

	// const -------------------------
	const FLOAT_TRIGGER = 32;
	const DELETE_TRIGGER = 80;
	const CLOSE_WAIT_MSEC = 600;
	const LONG_TAP_MSEC = 400;
	const TAB_MANAGER_URL = chrome.extension.getURL('tab_manager.html');

	// fields -------------------------
	let TAB_MANAGER_ID = null;
	let activeTabId;
	let savedTabs = {};
	let recent = {};
	let touchmoved = false;

	// DOM cache ---------------------
	const tabs = []; // <li>
	const tabList = byId('tabList'); // <ul>
	const tabMenu = byId('tabMenu'); // <ul>
	const recentList = byId('recentList'); // <ul>

	// utils for tab manager ---------
	const tabId = li => li.id.replace(/^tab_/, '') | 0;

	const checked = li => byClass(li, 'checkbox').classList.contains('checked');

	const remove = li => {
		tabs.splice(tabs.indexOf(li), 1);
		browser.tabs.remove(tabId(li));
		li.classList.add('removing');
		window.setTimeout(() => { li.parentNode.removeChild(li); }, 510);
	};

	const titleOrFileName = tab => {
		if (!tab.url) return tab.title; // no filename.
		if (tab.title && tab.title !== tab.url && tab.title !== tab.url.replace(/^https?:\/\//, '')) return tab.title;
		const s = tab.url.replace(/[?#].*/, '').replace(/\/+$/, '');
		if (s.match(/\/([^\/]+)$/)) return RegExp.$1;
		return tab.url;
	};

	// tools --------------------------
	const floater = {
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
		fixOffsetTop: () => {
			if (!floater.tab) return;
			floater.offsetTop = floater.tab.offsetTop + tabList.offsetTop - tabList.scrollTop;
		},
		show: () => {
			floater.fixOffsetTop();
			floater.setPosition(0, 0, true);
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
	const toolButtons = {
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
				const tab = tabs[i];
				if (checked(tab)) return;
				remove(tab);
			}
		},
		recent: () => {
			popupMenu.popupAsRecent();
		}
	};

	const popupMenu = {
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
			const res = await browser.storage.local.get('tab_manager');
			if (!res && !res.tab_manager) return;
			recent = res.tab_manager.recent;
			byId('recentListItems').remove();
			const items = document.createElement('DIV');
			items.id = 'recentListItems';
			const template = byId('recentTemplate');
			for (let tab of recent) {
				const li = template.cloneNode(true);
				li.id = 'recent_' + tab.url;
				byClass(li, 'title').textContent = titleOrFileName(tab);
				byClass(li, 'url').textContent = tab.url;
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
				const tab = tabs[i];
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
			const lines = [];
			for (let tab of tabs) {
				if (!checked(tab)) continue;
				lines.push(popupMenu.titleAndUrl(tab));
			}
			copyToClipbd(lines.join('\n'));
		},
	};

	// others -------------------------
	const slideout = (tab, startX) => {
		tab.style.marginLeft = startX + 'px';
		window.setTimeout(() => { tab.classList.add('slideout'); });
		window.setTimeout(() => { tab.style.marginLeft = (startX < 0 ? '-' : '') +  window.innerWidth + 'px'; });
		window.setTimeout(() => { tab.classList.remove('slideout'); }, 500);
		window.setTimeout(() => { remove(tab); }, 600);
	};

	// setup tab manager page ---------
	const closeOtherTabManagerTabs = _tabs => {
		for (let i = _tabs.length - 1; 0 <= i; i --) {
			const tab = _tabs[i];
			if (tab.active) continue;
			if (tab.url !== TAB_MANAGER_URL) continue;
			browser.tabs.remove(tab.id);
			_tabs.splice(i, 1);
		}
	};

	const listupTabs = _tabs => {
		const template = byId('template');
		let activeTab;
		for (let tab of _tabs) {
			if (tab.url === TAB_MANAGER_URL) {
				TAB_MANAGER_ID = tab.id;
				continue;
			}
			const li = template.cloneNode(true);
			li.id = 'tab_' + tab.id;
			if (!tab.title && tab.url === 'about:blank') {
				if (savedTabs[tab.id]) {
					tab = savedTabs[tab.id];
				} else {
					byClass(li, 'title').classList.add('not-loaded');
					tab = { title: 'Not Loaded', url: '' };
				}
			}
			byClass(li, 'title').textContent = titleOrFileName(tab);
			byClass(li, 'url').textContent = tab.url;
			if (tab.id === activeTabId) {
				activeTab = li;
				li.classList.add('active');
				byClass(li, 'checkbox').classList.add('checked');
			}
			tabs.push(li);
			tabList.appendChild(li);
		}
		tabList.scrollTo(0, byClass(tabList, 'tab').offsetTop);
		activeTab && window.setTimeout(() => { activeTab.scrollIntoView(); });
	};

	const menuItems = document.getElementsByClassName('menuitem');
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

	const slipScroll = {
		timer: null,
		speed: 0,
		lastMoveTime: 0,
		lastScrollTop: 0,
		setLastData: function() {
			this.lastMoveTime = new Date();
			this.lastScrollTop = tabList.scrollTop;
		},
		clearTimer: function() {
			clearTimeout(this.timer);
			this.timer = null;
		},
		start: function() {
			const dt = new Date().getTime() - this.lastMoveTime.getTime();
			if (100 < dt) return;
			const dy = tabList.scrollTop - this.lastScrollTop;
			this.speed = dy * 16 / dt / 4;
			slipScroll.clearTimer();
			slipScroll.scroll();
		},
		scroll: function() {
			slipScroll.speed *= 0.95;
			if (1 <= Math.abs(slipScroll.speed)) {
				tabList.scrollTo(0, tabList.scrollTop + slipScroll.speed);
				slipScroll.clearTimer();
				slipScroll.timer = setTimeout(slipScroll.scroll, 16);
			}
		}
	};

	const resetFloater = e => {
		floater.tab = e.target;
		[floater.startX, floater.startY] = getXY(e);
		floater.dx = 0;
		floater.dy = 0;
		floater.stickyX = true;
		floater.stickyY = true;
		floater.startScrollTop = tabList.scrollTop;
	};

	const getXY = e => e.touches ? [e.touches[0].clientX, e.touches[0].clientY] : [e.pageX, e.pageY];
	tabList.addEventListener('ontouchstart' in window ? 'touchstart' : 'mousedown', e => {
		touchmoved = false;
		popupMenu.clearTimer();
		slipScroll.clearTimer();
		if (!e.target.classList.contains('tab')) return;
		e.preventDefault();
		resetFloater(e);
		popupMenu.setTimer();
	});
	window.addEventListener('ontouchmove' in window ? 'touchmove' : 'mousemove', e => {
		if (!floater.tab) return;
		popupMenu.clearTimer();
		touchmoved = true;
		const [x, y] = getXY(e);
		const dx = x - floater.startX;
		const dy = y - floater.startY;
		if (floater.stickyX) {
			if (dy !== 0) {
				slipScroll.setLastData();
				tabList.scrollTo(0, floater.startScrollTop - dy);
			}
			if (Math.abs(dx) < FLOAT_TRIGGER) return;
			floater.stickyX = false;
			floater.startY = y;
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
			// scroll tablist.
			if (floater.stickyX) {
				slipScroll.start();
			}
			// move tab.
			if (!floater.stickyY) {
				const y = floater.tab.offsetTop + floater.dy;
				let p = tabs.length;
				for (let i = 0; i < tabs.length - 1; i ++) {
					if (y < tabs[i].offsetTop) {
						if (tabs[i] == floater.tab) return;
						p = i;
						break;
					}
				}
				const targetId = tabId(floater.tab);
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
				return;
			}
			// swipe out.
			if (DELETE_TRIGGER < Math.abs(floater.dx)) {
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


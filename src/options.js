(async () => {
	'use strict';

	const theme = document.getElementById('theme');
	const css = document.getElementById('css');
	const autoClose = document.getElementById('autoClose');
	const thresholdConfirmClosing = document.getElementById('thresholdConfirmClosing');
	const listDiscardedTabs = document.getElementById('listDiscardedTabs');
	const NO_CONFIRM = 99999;

	const saveOptions = async () => {
		let msg = {
			command: 'updateIni',
			updateParams: {
				'theme': theme.value,
				'css': css.value,
				'autoClose': autoClose.checked,
				'thresholdConfirmClosing': thresholdConfirmClosing.checked ? 2 : NO_CONFIRM,
				'listDiscardedTabs': listDiscardedTabs.checked,
			}
		};
		await browser.runtime.sendMessage(JSON.stringify(msg));
	};

	let saveTimer;
	const saveOptionsLazy = () => {
		clearTimeout(saveTimer);
		setTimeout(saveOptions, 500);
	};

	const restoreOptions = async () => {
		const ini = await browser.runtime.sendMessage('loadIni');
		if (!ini) return;
		theme.value = ini.theme || 'default';
		css.value = ini.css || '';
		autoClose.checked = ini.autoClose;
		thresholdConfirmClosing.checked = ini.thresholdConfirmClosing != NO_CONFIRM;
		listDiscardedTabs.checked = ini.listDiscardedTabs;
	};

	for (let label of document.getElementsByTagName('LABEL')) {
		label.textContent = chrome.i18n.getMessage(label.textContent) || label.textContent;
	}

	await restoreOptions();

	for (let e of document.getElementsByTagName('INPUT')) {
		e.addEventListener('change', saveOptions);
	}
	for (let e of document.getElementsByTagName('SELECT')) {
		e.addEventListener('change', saveOptions);
	}
	for (let e of document.getElementsByTagName('TEXTAREA')) {
		e.addEventListener('input', saveOptionsLazy);
		e.addEventListener('change', saveOptionsLazy);
	}

})();


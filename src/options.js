(() => {
	'use strict';

	let theme = document.getElementById('theme');
	let css = document.getElementById('css');
	let autoClose = document.getElementById('autoClose');

	const saveOptions = async () => {
		let msg = {
			command: 'updateIni',
			updateParams: {
				'theme': theme.value,
				'css': css.value,
				'autoClose': autoClose.checked
			}
		};
		let ini = await browser.runtime.sendMessage(JSON.stringify(msg));
	};

	let saveTimer;
	const saveOptionsLazy = () => {
		clearTimeout(saveTimer);
		setTimeout(saveOptions, 500);
	};

	const restoreOptions = async () => {
		let ini = await browser.runtime.sendMessage('loadIni');
		if (!ini) return;
		theme.value = ini.theme || 'default';
		css.value = ini.css || '';
		autoClose.checked = ini.autoClose;
	};

	for (let label of document.getElementsByTagName('LABEL')) {
		label.textContent = chrome.i18n.getMessage(label.textContent) || label.textContent;
	}

	autoClose.addEventListener('change', saveOptions);
	theme.addEventListener('change', saveOptions);
	css.addEventListener('change', saveOptionsLazy);
	document.addEventListener('DOMContentLoaded', restoreOptions);

})();


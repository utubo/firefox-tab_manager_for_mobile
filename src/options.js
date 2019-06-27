(() => {
	'use strict';

	let theme = document.getElementById('theme');
	let css = document.getElementById('css');

	const saveOptions = async () => {
		let msg = {
			command: 'updateIni',
			updateParams: {
				'theme': theme.value,
				'css': css.value
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
	};

	document.addEventListener('DOMContentLoaded', restoreOptions);
	theme.addEventListener('change', saveOptions);
	css.addEventListener('change', saveOptionsLazy);
})();


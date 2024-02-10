function listenToKeyboard(preventDefault, mappings){
	document.addEventListener("keydown", e => {
		let mapping = mappings.find(m => m.keys.includes(e.code));
		if (mapping) {
			if (preventDefault) e.preventDefault();
			mapping.action();
		}
	});
}
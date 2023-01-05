function listenToKeyboard(mappings){
	document.addEventListener("keydown", e => {
		let mapping = mappings.find(m => m.keys.includes(e.code));
		if (mapping) {
			e.preventDefault();
			mapping.action();
		}
	});
}
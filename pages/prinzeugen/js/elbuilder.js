function flatten(bulgy){
	return [].concat.apply([], bulgy)
}
function buildElement(className, modifier, children, tagName = "div"){
	let el = document.createElement(tagName);
	if (className) el.className = className;
	if (modifier) modifier(el);
	if (children) for (let c of flatten(children)) if (c) el.appendChild(c);
	return el;
}
function buildTextElement(className, textContent, tagName = "div"){
	return buildElement(className, e => e.textContent = textContent, null, tagName);
}
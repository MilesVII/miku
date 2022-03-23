const EP = {
	LOGIN: "/api/hakase/login",
	VIBE_CHECK: "/api/hakase/login?check=check",
	DASHBOARD: "/api/hakase/hakase"
}

const PRIORITIES = [
	"Lowest",
	"Minor",
	"Low",
	"Normal",
	"Medium",
	"Major",
	"High",
	"Critical",
	"Highest",
	"Show-stopper"
];

function extractAssignees(item, blacklist = ["Рыбин Давид"]){
	let r = [];
	for (let i of item.issues){
		let name = i.assignee;
		if (!r.includes(name) && !blacklist.includes(name)) r.push(name);
	}
	return r;
}
function countStati(item){
	let count = [0, 0, 0];
	let filtered = item.issues.filter(i => i.summary.toLowerCase().includes("dev"));
	for (let i of filtered){
		if (i.resolved) count[1] += 1; else
		if (i.status == "In Progress") count[2] += 1;
	}
	count[0] = filtered.length;
	return count;
}
function countBugStati(item){
	return [
		item.bugs.length, 
		item.bugs.filter(b => b.status == "To Do").length, 
		item.bugs.filter(b => b.status == "In Progress").length, 
		item.bugs.filter(b => b.status == "In QA").length, 
		item.bugs.filter(b => b.status == "Done" || b.status == "Won't fix").length
	];
}

let assigneeFilter = [];
function toggleAssigneeFilter(target){
	if (assigneeFilter.includes(target)){
		assigneeFilter = assigneeFilter.filter(e => e != target);
	} else {
		assigneeFilter.push(target);
	}
	refreshFiltering();
}
function refreshFiltering(){
	for (let filter of document.querySelectorAll(".assigneeFilter")){
		filter.classList.remove("semigreenlighted");
	};
	if (assigneeFilter.length == 0){
		document.querySelectorAll(".itemContainer")
			.forEach(e => e.style.display = "block");
			return;
	}

	for (let container of document.querySelectorAll(".itemContainer")){
		let greenAssignees = Array.from(container.querySelectorAll(".assigneeFilter"))
								.filter(e => assigneeFilter.includes(e.textContent))
		if (greenAssignees.length > 0){
			greenAssignees.forEach(e => e.classList.add("semigreenlighted"));
			container.style.display = "block";
		} else
			container.style.display = "none";
	}
}

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

function buildBar(whole, values, colors, caption){
	let parts = [];
	for (let i in values){
		parts.push({
			value: values[i],
			color: colors[i]
		});
	}
	return buildElement(null, null, [
		buildTextElement("subtext", caption),
		buildElement("bar", null, 
			parts
				.filter(p => p.value > 0)
				.map(p => {
					return buildElement("barpart subtext", part => {
						let percent = Math.round(p.value / whole * 100);
						part.style.width = percent + "%";
						part.textContent = "  " + percent + "%";
						part.style.backgroundColor = p.color;
					}, null)
				})
		),
	]);
}

function builditem(item, role, postponeLink){
	let devBarLine = null;
	let counts = countStati(item);
	if (counts[0] == 0){
		let holder = document.createElement("div");
		holder.textContent = "No DEV tasks";
		devBarLine = holder;
	} else {
		let bar = buildBar(counts[0], counts.slice(1), [
			"hsl(110, 100%, 75%)", 
			"hsl(30, 100%, 75%)"
		], "DEV");
		bar.title = `${counts[1]} resolved; ${counts[2]} in progress; ${counts[0]} total`;
		devBarLine = bar;
	}

	let bugCounts = countBugStati(item);
	let bugBarLine = null;
	if (bugCounts[0] > 0){
		let bar = buildBar(bugCounts[0], bugCounts.slice(1), [
			"hsl(0, 100%, 75%)", 
			"hsl(50, 100%, 75%)", 
			"hsl(85, 100%, 75%)", 
			"hsl(110, 100%, 75%)"
		], "QA");
		bar.title = `${bugCounts[1]} To Do; ${bugCounts[2]} In Progress;${bugCounts[3]} In QA; ${bugCounts[4]} Done; ${bugCounts[0]} total`;
		bugBarLine = bar;
	}
	//if (role == 0 && bugBarLine) bugBarLine = buildTextElement(null, "In QA");
	let isDone = i => i.status == "Done" || i.resolved;

	let backPic = localStorage.getItem("backPic");
	if (backPic && backPic != "null" && backPic != "") backPic = `url("${backPic}")`;

	let assignees = extractAssignees(item).map(a => 
		buildElement("xbutton subtext assigneeFilter", e => {
			e.textContent = a;
			e.onclick = () => toggleAssigneeFilter(a);
			e.onmouseenter = () => {
				document
					.querySelectorAll(".assigneeFilter")
					.forEach(e => {if (e.textContent == a) e.classList.add("xbuttonHover");});
			}
			e.onmouseleave = () => {
				document
					.querySelectorAll(".assigneeFilter")
					.forEach(e => {if (e.textContent == a) e.classList.remove("xbuttonHover");});
			}
		}, null)
	);
	let left = buildElement("left", null, [
		//buildTextElement(null, item.epic, null),
		buildElement("", e => {
			e.textContent = item.epic;
			if (item.link && item.link != ""){
				e.classList.add("xbutton");
				e.href = item.link;
				e.target = "_blank";
				//e.onclick = () => window.open(item.link, '_blank').focus();
			}
		}, null, "a"),
		(item.designLink && item.designLink != "") ? 
			buildElement("subtext xbutton link", e => {
				e.textContent = "Design";
				e.href = item.designLink;
				e.target = "_blank";
			}, null, "a") 
		: null,
		item.additionalLinks.map(link => buildElement("subtext xbutton link", e => {
			e.textContent = "Link";
			e.href = link;
			e.target = "_blank";
			if (postponeLink) postponeLink(e);
		}, null, "a")),
		buildElement("spacing", null, null),
		assignees
	]);

	let issueList = buildElement("details hidden", e => {
		if (backPic) e.style.backgroundImage = backPic;
		e.ondblclick = () => {
			let url = prompt("Set background picture");
			if (url != null)
				localStorage.setItem("backPic", url);
		}
	}, [
		item.issues
			.filter(isDone)
			.map(i => {
				return buildTextElement("greenlighted", i.summary.trim() + ": " + i.status);
			}),
		item.issues
			.filter(i => !isDone(i))
			.sort((a, b) => a.status.localeCompare(b.status))
			.map(i => {
				return buildTextElement("whitelighted", i.summary.trim() + ": " + i.status);
			})
	]);
	let right = buildElement("right", null, [
		devBarLine,
		bugBarLine,
		buildTextElement(null, item.dates),
		buildElement("detailsButton subtext", detailsToggle => {
			detailsToggle.textContent = "Details ▾",
			detailsToggle.onclick = () => detailsToggle.nextElementSibling.classList.toggle("hidden");
		}, null),
		issueList
	]);
	let container = buildElement("itemContainer", null, [left, right]);

	return container;
}

function filterByProject(button, cards){
	let items = document.querySelectorAll(".itemContainer");
	let otherButtons = Array.from(document.querySelector("#projectFilter").children)
	                   	.filter(b => b.dataset.name != button.dataset.name);

	items.forEach(item => item.classList.remove("hidden"));
	otherButtons.forEach(b => {
		b.dataset.enabled = "false";
		b.classList.remove("semigreenlighted");
	});

	if (button.dataset.enabled == "true"){
		button.dataset.enabled = "false";
		button.classList.remove("semigreenlighted");
	} else {
		Array.from(items)
			.filter(item => !cards.includes(item.dataset.name))
			.forEach(item => item.classList.add("hidden"));
		button.dataset.enabled = "true";
		button.classList.add("semigreenlighted");
	}
}

async function loginSucceed(role){
	let loginForm = document.querySelector("#login");
	if (!loginForm.classList.contains("hidden")) loginForm.classList.add("hidden");

	let loaders = [
		"/pages/hakase/loaders/loader_a.gif"
		/*
		"/pages/hakase/loaders/loader_b.gif", 
		"/pages/hakase/loaders/loader_c.gif", 
		"/pages/hakase/loaders/loader_d.gif", 
		"/pages/hakase/loaders/loader_e.gif", 
		"/pages/hakase/loaders/loader_f.gif", 
		"/pages/hakase/loaders/loader_g.gif", 
		"/pages/hakase/loaders/loader_h.gif", 
		"/pages/hakase/loaders/loader_i.gif"
		*/
	];
	let loaderId = Math.floor(Math.random() * loaders.length);
	document.querySelector("#loader").src = loaders[loaderId];
	let response = await fetch(EP.DASHBOARD);
	if (response.status == 401) {
		location.reload();
		return;
	}
	let loader = document.querySelector("#loader");
	loader.style.opacity = 0;
	loader.addEventListener("transitionend", () => {loader.classList.add("hidden");});
	let priorityByName = name => PRIORITIES.findIndex(n => n == name);
	let items = await response.json();
	items.sort((a, b) => {
		return priorityByName(b.card.priority) - priorityByName(a.card.priority);
	});

	let projectsMap = new Map();
	Map.prototype.add = function (k, v){
		if (this.has(k)) 
			this.set(k, [].concat(this.get(k), v));
		else
			this.set(k, [v])
	}
	let linksToFetch = [];
	for (let i of items){
		projectsMap.add(i.project, i.epic);

		let item = builditem(i, role, e => linksToFetch.push(e));
		item.dataset.name = i.epic;
		item.dataset.project = i.project;
		if (priorityByName(i.card.priority) > priorityByName("Normal")) item.classList.add("priority");
		document.querySelector("#content").appendChild(item);
	}
	for (let link of linksToFetch){
		fetch(link.href).then(async r => {
			let source = await r.text();
			let d = new DOMParser().parseFromString(source, "text/html");
			let name = Array.from(d.querySelectorAll("meta")).find(e => e.getAttribute("property") == "og:title")?.content;
			if (name) link.textContent = name;
		})
	}

	let projectsFilter = document.querySelector("#projectFilter");
	projectsMap.forEach((v, k) => {
		projectFilter.appendChild(buildElement("hitem xbutton", e => {
			e.textContent = k;
			e.dataset.name = k;
			e.dataset.enabled = "false";
			e.onclick = () => filterByProject(e, v);
		}, null, "span"));
	})
	if (role == 0 && projectsMap.size <= 1) projectsFilter.classList.add("hidden");

	let delay = 0;
	for (let i of document.querySelectorAll(".itemContainer")){
		setTimeout(()=>i.style.opacity = 1, delay);
		delay += 100;
	}
}

async function sendLogin(e){
	e.preventDefault();

	let input = document.querySelector("#loginInput");
	let password = input.value;
	if (!password) return;

	input.disabled = true;
	let response = await fetch(EP.LOGIN, {
		method: "POST",
		body: password,
		headers: {
			"Content-Type": "text/plain"
		}
	});

	if (response.status == 200){
		let responseBody = await response.json();
		loginSucceed(responseBody.role);
	} else {
		input.disabled = false;
		alert("Wrong password");
	}

	return false;
}

async function start(){
	let loginForm = document.querySelector("#login");

	let loginCheck = await fetch(EP.VIBE_CHECK);
	if (loginCheck.status == 200) {
		let response = await loginCheck.json();
		loginSucceed(response.role);
	} else {
		let input = document.querySelector("#loginInput");
		loginForm.classList.remove("hidden");
		input.focus();
	}

	return;
}
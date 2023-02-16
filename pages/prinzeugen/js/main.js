let pageLock = false;

const AI_SCORES = [3, 1, 0, -1, -3];
const AI_STYLE_CLASSES = ["aivote_4", "aivote_3", "aivote_2", "aivote_1", "aivote_0", "aivote_skip"]
let aiMode = false;

main();

async function main(){
	window.addEventListener("error", (event, source, lineno, colno, error) => {
		report(`${event.message}\n\n${source} ${lineno}:${colno}`);
	});

	const allTabs = document.querySelectorAll(".tab");
	allTabs.forEach(tab => {
		const sibs = Array.from(tab.parentElement.children).filter(t => t.classList.contains("tab"));
		tab.addEventListener("click", () => {
			sibs.forEach(t => t.classList.remove("selected"));
			tab.classList.add("selected");;
			const target = document.querySelector(`#${tab.dataset.target}`);
			if (!target) return;
			const targetSibs = Array.from(target.parentElement.children).filter(e => e.classList.contains("tabtarget"));
			targetSibs.forEach(p => p.classList.add("hidden"))
			target.classList.remove("hidden");
		})
	});
	allTabs[0]?.click();

	const loginData = load("login");
	if (loginData != null){
		pullCurtain(true, "Loading");
		const loginResponse = await callAPI("login", {
			user: loginData.id,
			userToken: loginData.token
		}, false);

		if (loginResponse.status == 200)
			authorize(loginResponse.data);

		pullCurtain(false);
	}

	listenToKeyboard(false, [
		{
			keys: ["Comma"],
			action: () => decide(true)
		},
		{
			keys: ["Period"],
			action: () => decide(false)
		},
		{
			keys: ["Slash"],
			action: () => previewFocused()
		},
		{
			keys: ["Backquote"],
			action: () => decide(5)
		},
		{
			keys: ["Digit1"],
			action: () => decide(4)
		},
		{
			keys: ["Digit2"],
			action: () => decide(3)
		},
		{
			keys: ["Digit3"],
			action: () => decide(2)
		},
		{
			keys: ["Digit4"],
			action: () => decide(1)
		},
		{
			keys: ["Digit5"],
			action: () => decide(0)
		},
		{
			keys: ["Digit0"],
			action: () => document.querySelectorAll(".previewSection").forEach(e => e.querySelector("img").src = `/api/imgproxy?url=${e.dataset.original}`)
		}
	]);
}

async function callAPI(action, data, useLogin = true){
	function safeParse(str){
		try {
			return JSON.parse(str);
		} catch (e) {
			return null;
		}
	}

	let login = null;
	if (useLogin){
		const loginData = load("login");
		login = {
			user: loginData.id,
			userToken: loginData.token
		};
	} 

	const response = await fetch("/api/prinzeugen/main", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(Object.assign({
			action: action
		}, data, login))
	});

	const raw = await response.text();
	const payload = safeParse(raw) || raw;

	if (response.status != 200) report(raw);

	return {
		status: response.status,
		data: payload
	};
}

function pullCurtain(lock, message = "Processing request"){
	const curtain = document.querySelector("#curtain");
	if (lock){
		if (pageLock) return false;
		pageLock = true;

		curtain.textContent = message;
		curtain.classList.remove("hidden");
		curtain.offsetHeight; // force CSS recalculate
		curtain.style.opacity = 1;
		curtain.offsetHeight; // force CSS recalculate
	} else {
		pageLock = false;
		curtain.style.opacity = 0;
		
		let listener;
		listener = () => {
			curtain.classList.add("hidden");
			curtain.removeEventListener("transitionend", listener);
		}
		curtain.addEventListener("transitionend", listener);
	}
	return true;
}

async function authorize(userData){
	document.querySelector("#login").classList.add("hidden");
	document.querySelector("#authorized").classList.remove("hidden");

	document.querySelector("#stg_access").value = "";
	document.querySelector("#stg_tg").value = userData.tg_token;

	loadGrabbers(userData.grabbers);
	loadModerables(userData.moderables);

	report(`You have ${userData.postsScheduled} post${userData.postsScheduled == 1 ? "" : "s"} in pool, ${userData.moderables.length} pending moderation`)
}

async function login(){
	const id = document.querySelector("#login_id").value;
	const token = document.querySelector("#login_token").value;

	if (id == "") return;

	if (!pullCurtain(true)) return;

	const parsedId = safe(() => parseInt(id, 10)) || 0;
	const response = await callAPI("login", {
		user: parsedId,
		userToken: token
	}, false);

	if (response.status == 200) {
		authorize(response.data);
		save("login", {
			id: parsedId,
			token: token
		});
	}

	pullCurtain(false);
}

async function manualGrab(){
	pullCurtain(true);
	const response = await callAPI("grab", {}, true);
	report(`${response.data} new entries`);

	const grabbers = await callAPI("getGrabbers", {}, true);
	if (grabbers.status == 200) loadGrabbers(grabbers.data);

	await reloadModerables(false);

	pullCurtain(false);
}

async function manualPublish(){
	const target = document.querySelector("#dsb_target").value.trim();
	if (target == "") return;

	pullCurtain(true);
	await callAPI("publish", {target: target}, true);
	pullCurtain(false);
}

async function saveGrabbers(){
	const list = document.querySelector("#grabbersList");
	const grabs = Array.from(list.children).map(el => GRABBERS[el.dataset.type].read(el));
	pullCurtain(true);
	const response = await callAPI("setGrabbers", {
		grabbers: grabs
	});
	pullCurtain(false);
}

function loadGrabbers(grabs){
	const list = document.querySelector("#grabbersList");
	list.innerHTML = "";

	for (let g of grabs){
		const meta = GRABBERS[g.type];
		const proto = fromTemplate(meta.template_id);
		proto.dataset.type = g.type;
		meta.fill(g, proto);

		const remover = fromTemplate("remove_grabber");
		remover.querySelector(".button").addEventListener("click", () => {
			proto.remove();
		});
		proto.appendChild(remover);

		list.appendChild(proto);
	}
}

function addGrabber(type){
	const meta = GRABBERS[type];
	if (!meta) return;
	const proto = fromTemplate(meta.template_id);
	proto.dataset.type = type;

	const remover = fromTemplate("remove_grabber");
	remover.querySelector(".button").addEventListener("click", () => {
		proto.remove();
	});
	proto.appendChild(remover);

	const list = document.querySelector("#grabbersList");
	list.appendChild(proto);
}

async function reloadModerables(pullCurtains = true){
	if (pullCurtains) pullCurtain(true);
	const messages = await callAPI("getModerables", null, true);
	loadModerables(messages.data);
	if (pullCurtains) pullCurtain(false);
}

function loadModerables(messages){
	const mod_list = document.querySelector("#mdr_list");
	aiMode = load("login").id == 3;
	mod_list.innerHTML = "";
	messages.forEach(m => {
		if (aiMode)
			mod_list.appendChild(renderAiModerable(m.message, m.id));
		else
			mod_list.appendChild(renderModerable(m.message, m.id));
	});
}

function renderModerable(message, id){
	//Message version 1 expected
	if (message.version != 1){
		console.error("Unsupported message version");
		return;
	}
	const proto = fromTemplate("moderation_item");
	proto.dataset.id = id;
	proto.dataset.original = message.image[0];

	proto.querySelector("a").href = message.image[0];
	proto.querySelector("img").src = message.preview || message.raw?.preview || message.image[1] || message.image[0];

	const tagList = proto.querySelector(".row");
	function renderTag(text, color){
		const e = fromTemplate("moderation_tag");
		e.textContent = text;
		e.style.backgroundColor = color;
		return e;
	}
	if (message?.raw?.nsfw)
		tagList.appendChild(renderTag("NSFW", "rgba(200, 0, 0, .3"));
	if (message?.raw?.artists)
		message.raw.artists.forEach(artist => tagList.appendChild(renderTag(`🎨 ${artist}`, "rgba(250, 250, 250, .7")));

	const buttons = proto.querySelectorAll(".button");
	buttons[0].textContent = "Approve";
	buttons[0].addEventListener("click", () => {
		proto.classList.remove("rejected");
		proto.classList.add("approved");
	});
	buttons[1].textContent = "Reject";
	buttons[1].addEventListener("click", () => {
		proto.classList.add("rejected");
		proto.classList.remove("approved");
	});

	proto.addEventListener("focusin", e => proto.scrollIntoView({/*behavior: "smooth", */block: "center"}));
	proto.addEventListener("mousedown", e => e.preventDefault());

	return proto;
}

function renderAiModerable(message, id){
	//Message version 1 expected
	if (message.version != 1){
		console.error("Unsupported message version");
		return;
	}
	const proto = fromTemplate("moderation_ai");
	proto.dataset.id = id;
	proto.dataset.original = message.image[0];

	proto.querySelector("a").href = message.image[0];
	proto.querySelector("img").src = message.preview || message.raw?.preview || message.image[1] || message.image[0];

	const buttons = proto.querySelectorAll(".button");
	AI_STYLE_CLASSES.forEach((c, i) => {
		const score = AI_SCORES[i];
		buttons[i].textContent = score == undefined ? "S" : score;
		buttons[i].addEventListener("click", () => {
			AI_STYLE_CLASSES.forEach(cl => proto.classList.remove(cl));
			proto.classList.add(c);

			buttons.forEach(b => b.classList.remove("aivote_selected"))
			buttons[i].classList.add("aivote_selected");
		});
	});

	proto.addEventListener("focusin", e => proto.scrollIntoView({/*behavior: "smooth", */block: "center"}));
	proto.addEventListener("mousedown", e => e.preventDefault());

	return proto;
}

function decide(approve){
	const focused = document.activeElement;
	if (!focused.classList.contains("previewSection")) return;
	if (typeof approve == "boolean")
		focused.querySelectorAll(".button")[approve ? 0 : 1].click();
	else
		focused.querySelectorAll(".button")[approve].click();

	const nextSib = focused.nextElementSibling;
	if (nextSib?.classList.contains("previewSection")) 
		nextSib.focus();
	else
		document.querySelector("#moderateButton").scrollIntoView({behavior: "smooth", block: "center"});
}

function previewFocused(){
	const focused = document.activeElement;
	if (!focused.classList.contains("previewSection")) return;
	//focused.querySelector("a").click();
	focused.querySelector("img").src = `/api/imgproxy?url=${focused.dataset.original}`;
}

async function moderate(){
	if (aiMode){
		function getScoreByCL(list){
			const selected = list.filter(cn => AI_STYLE_CLASSES.includes(cn))[0];
			if (!selected) return 0;
			const score = AI_SCORES[AI_STYLE_CLASSES.indexOf(selected)];
			return score == undefined ? -5 : score;
		}
		decisions = Array.from(document.querySelectorAll(".previewSection"))
			.filter(e => Array.from(e.classList).some(cn => AI_STYLE_CLASSES.includes(cn)))
			.map(e => ({
				id: parseInt(e.dataset.id, 10),
				approved: !e.classList.contains("aivote_skip"),
				score: getScoreByCL(Array.from(e.classList))
			}));
	} else {
		decisions = Array.from(document.querySelectorAll(".previewSection"))
			.filter(e => e.classList.contains("approved") || e.classList.contains("rejected"))
			.map(e => ({
				id: parseInt(e.dataset.id, 10),
				approved: e.classList.contains("approved")
			}));
	}

	if (decisions.length == 0) return;

	pullCurtain(true);
	const newModerables = await callAPI("moderate", {decisions: decisions}, true);
	
	loadModerables(newModerables.data);
	pullCurtain(false);
}

async function postManual(){
	const raw = document.querySelector("#manual_post").value;
	const blocks = 
		raw
			.trim()
			.split("\n\n")
			.map(
				b => b.split("\n").map(line => line.trim())
			);

	function lineToLink(line){
		const parts = line.split("\t");
		return {
			text: parts[0],
			url: parts[1]
		}
	}
	const posts = blocks.map((block, i) => {
		const links = block.filter(line => line.includes("\t")).map(line => lineToLink(line));
		const image = block.filter(line => !line.includes("\t")).filter(line => line.trim());

		let target = image.find(line => line.startsWith("glb://")) || image.find(line => line.startsWith("twt://"));
		if (target) return {
			grab: target,
			links: links
		};

		target = image.filter(line => line.startsWith("http"));
		if (target.length > 0) return {
			images: target,
			links: links
		};

		report(`No valid image sources found for block ${i}`);
		return null;
	}).filter(b => b);

	if (posts.length == 0) return;

	pullCurtain(true);
	const response = await callAPI("manual", {posts: posts}, true);
	if (response.status == 200) document.querySelector("#manual_post").value = "";
	pullCurtain(false);
}

async function saveSettings(){
	const newPassword = document.querySelector("#stg_access").value.trim() || null;
	const tgToken = document.querySelector("#stg_tg").value || null;

	pullCurtain(true);
	await callAPI("saveSettings", {
		newUserToken: newPassword,
		newTgToken: tgToken
	}, true);
	if (newPassword) signOut();
	pullCurtain(false);
}

function signOut(){
	save("login", null);
	document.querySelector("#login").classList.remove("hidden");
	document.querySelector("#authorized").classList.add("hidden");
}

function report(msg){
	let message = document.createElement("div");
	message.textContent = msg;

	document.querySelector("#statuslog").prepend(message);

	Array.from(document.querySelector("#statuslog").children).forEach((c, i) => c.style.opacity = (100 / (i + 1)) + "%");
}
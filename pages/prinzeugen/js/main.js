let pageLock = false;

main();

async function main(){
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

	// listenToKeyboard([
	// 	{
	// 		keys: ["KeyQ"],
	// 		action: () => movePost(SWIPE.REJECT)
	// 	},
	// 	{
	// 		keys: ["KeyW"],
	// 		action: () => movePost(SWIPE.SKIP)
	// 	},
	// 	{
	// 		keys: ["KeyE"],
	// 		action: () => movePost(SWIPE.APPROVE)
	// 	},
	// 	{
	// 		keys: ["KeyS"],
	// 		action: () => renderNextBatch()
	// 	},
	// 	{
	// 		keys: ["KeyR"],
	// 		action: () => resetSelector()
	// 	}
	// ])
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

	document.querySelector("#stg_tg").value = userData.tg_token;

	loadGrabbers(userData.grabbers);
	loadModerables(userData.moderables);
}

async function login(){
	const id = document.querySelector("#login_id").value;
	const token = document.querySelector("#login_token").value;

	if (id == "" || token == "") return;

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

async function reloadModerables(){
	pullCurtain(true);
	const messages = await callAPI("getModerables", null, true);
	loadModerables(messages.data);
	pullCurtain(false);
}

function loadModerables(messages){
	const mod_list = document.querySelector("#mdr_list");
	mod_list.innerHTML = "";
	messages.forEach(m => {
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

	proto.querySelector("a").href = message.image[0];
	proto.querySelector("img").src = message.raw?.preview || message.image[1] || message.image[0];

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

	return proto;
}

async function moderate(){
	const decisions = Array.from(document.querySelectorAll(".previewSection"))
		.filter(e => e.classList.contains("approved") || e.classList.contains("rejected"))
		.map(e => ({
			id: parseInt(e.dataset.id, 10),
			approved: e.classList.contains("approved")
		}));

	if (decisions.length == 0) return;

	pullCurtain(true);
	const newModerables = await callAPI("moderate", {decisions: decisions}, true);
	
	loadModerables(newModerables.data);
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
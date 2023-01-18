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

	loadGrabbers(userData.grabbers)
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
	});

	if (response.status == 200) {
		authorize(response.data);
		save("login", {
			id: parsedId,
			token: token
		});
	}

	pullCurtain(false);
}

async function saveGrabbers(){
	const list = document.querySelector("#grabbersList");
	const grabs = Array.from(list.children).map(el => GRABBERS[el.dataset.type].read(el));
	pullCurtain(true);
	const response = await callAPI("setGrabbers", {
		grabbers: grabs
	});
	if (response.status != 200)
		report(`Failed to save: ${JSON.stringify(response.data)}`)
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








function renderNextBatch(){
	const oldPreviews = () => Array.from(document.querySelectorAll(".preview"));
	for (let i = 0; i < PREVIEWS_PER_CHUNK; ++i){
		let post = state.pending.find(post => !oldPreviews().find(pre => pre.dataset.id == post.id));
		if (!post) break;
		renderPost(post, document.querySelector("#pdg"));
	}
}

function resetSelector(){
	document.querySelectorAll(".previewSelected").forEach(e => e.classList.remove("previewSelected"));
	const selected = document.querySelector("#pdg").querySelector(".preview");
	if (selected){
		selected.classList.add("previewSelected");
	}
}

function movePost(swipe){
	let selected = document.querySelector(".previewSelected");
	if (!selected) {
		report("No previews selected");
		return;
	}

	let nextSelected = selected.nextElementSibling;

	if (!nextSelected){
		renderNextBatch();
		nextSelected = selected.nextElementSibling;
	}
	if (!nextSelected){
		report("Reached the end of the queue");
	} else {
		nextSelected.classList.add("previewSelected");
	}
	selected.classList.remove("previewSelected");

	if (swipe != SWIPE.SKIP){
		const approved = swipe == SWIPE.APPROVE;
		const target = document.querySelector(approved ? "#apd" : "#rjd");
		target.appendChild(selected);

		const post = state.pending.find(p => p.id == selected.dataset.id);
		state.pending = state.pending.filter(p => p.id != post.id);
		if (approved)
			state.approved.push(post);
		else
			state.rejected.push(post);
	}
}

function renderPost(post, page){
	page.appendChild(createPreviewElement(post.id, post.preview_url, post.score, post.file_url, post.tags.includes("animated")))
}

function renderState(){
	const pdg = document.querySelector("#pdg");
	const apd = document.querySelector("#apd");
	const rjd = document.querySelector("#rjd");

	const pages = [pdg, apd, rjd];
	pages.forEach(p => p.innerHTML = "");

	function render(posts, page){
		posts.forEach(p => renderPost(p, page));
	}

	render(state.pending.slice(0, PREVIEWS_PER_CHUNK), pdg);
	//render(state.approved, apd);
	render(state.rejected, rjd);

	if (!pdg.querySelector(".previewSelected") && pdg.children[0])
		pdg.children[0].classList.add("previewSelected");
}

function loadState(){
	const source = document.querySelector("#exchange");
	const raw = JSON.parse(source.value);

	if (Array.isArray(raw)){
		state.pending = raw;
		state.approved = [];
		state.rejected = [];
		renderState();
		source.value = "";
		report("Loaded all raw posts as pending");
	} else if (raw.pending && raw.approved && raw.rejected){
		state = raw;
		renderState();
		source.value = "";
		report("Loaded state");
	} else {
		report("Malformed source, ignored");
	}
}

function saveState(){
	document.querySelector("#exchange").value = JSON.stringify(state);
	report("State saved to exchanger")
}

function createPreviewElement(id, img, rating, file, animated){
	const link = `https://gelbooru.com/index.php?page=post&s=view&id=${id}`;
	return buildElement(`button wideButton preview${animated ? " previewAnimated" : ""}`, e => e.dataset.id = id, [
		buildElement("button", e => {e.href = link; e.target="_blank";}, [
			buildElement(null, e => e.src = img, null, "img")
		], "a"),
		buildElement(null, null, [
			buildElement(null, e => e.textContent = rating + " ", null, "span"),
			buildElement("button wideButton", e => {e.textContent = "Src"; e.href = file;}, null, "a")
		], "div")
	]);
}

function compileQuery(raw){
	const tags = raw.tags.join(" ~ ");
	const black = raw.black.join(" ~ ");
	const white = raw.white.join(" ");

	return `{${tags}} -{${black}} ${white}`;
}

let downloadingFlicker = false;
async function downloadPosts(){
	if (downloadingFlicker) return;
	downloadingFlicker = true;

	const creds = loadCreds();
	if (!creds.key || !creds.user) {
		report("Credentials are not set");
		return null;
	}

	const raw = readConfig();
	const query = compileQuery(raw);
	let allPosts = [];

	for (let p = 0;; ++p) {
		const response = await fetch("/api/prinzeugen/retrieve", {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				key: creds.key,
				user: creds.user,
				query: query,
				page: p
			})
		});

		const data = await response.json();

		if (!data.post) break;
		if (data.post.length == 0) break;

		allPosts = allPosts.concat(data.post);

		const pagesTotal = Math.ceil(data["@attributes"].count / data["@attributes"].limit);
		report(`Page ${p} / ${pagesTotal} completed`);

		await sleep(1000);
	}

	report(`Downloading complete`);

	document.querySelector("#exchange").value = JSON.stringify(allPosts);
	downloadingFlicker = false;

	// const previews = document.querySelector("#previews");
	// previews.innerHTML = "";
	// data.post.forEach(p => {
	// 	previews.appendChild(createPreviewElement(p.preview_url, p.score,  p.file_url));
	// });
}

function readConfig(){
	return {
		tags: sanitizeTags(document.querySelector("#main_tags").value),
		black: sanitizeTags(document.querySelector("#main_black").value),
		white: sanitizeTags(document.querySelector("#main_white").value)
	};
}

function loadConfig(){
	const raw = load("dl_config");

	document.querySelector("#main_tags").value = raw?.tags?.join("\n") || "";
	document.querySelector("#main_black").value = raw?.black?.join("\n") || "";
	document.querySelector("#main_white").value = raw?.white?.join("\n") || "";
}

function saveConfig(){
	const raw = readConfig();
	save("dl_config", raw);
	report("Config saved");
}

function loadCreds(){
	return load("gelbooru_creds");
}

function saveCreds(key, user){
	save("gelbooru_creds", {
		key: key,
		user: user
	});
}

function report(msg){
	let message = document.createElement("div");
	message.textContent = msg;

	document.querySelector("#statuslog").prepend(message);

	Array.from(document.querySelector("#statuslog").children).forEach((c, i) => c.style.opacity = (100 / (i + 1)) + "%");
}
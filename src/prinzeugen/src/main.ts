import { callAPI, safe, sleep, setElementValue, load, save } from "./utils/utils";
import { Grabbers } from "./utils/grabbers";
import type { GrabberType } from "./utils/grabbers"
import { listenToKeyboard } from "./utils/io";
import { updateTabListeners, switchTabContent } from "./utils/tabs";
import { pullCurtain, updateCurtainMessage } from "./utils/curtain";
import { genericFlickerUpdate } from "./utils/flicker";

import { addGrabber, saveGrabbers, showGrabbers } from "./grabbing";

const PLACEHOLDER_URL = "placeholder.png";

main();

async function main(){
	updateTabListeners();

	// window.addEventListener("error", (event, source, lineno, colno, error) => {
	// 	report(`${event.message}\n\n${source} ${lineno}:${colno}`);
	// });
	document.querySelector("#form-login")?.addEventListener("submit", e => login(e));

	const loginData = load("login");
	if (loginData != null){
		pullCurtain(true, "Loading");
		const loginResponse = await callAPI("login", {
			user: loginData.id,
			userToken: loginData.token
		}, false);

		pullCurtain(false);

		if (loginResponse.status == 200)
			authorize(loginResponse.data);
	}

	// listenToKeyboard(false, [
	// 	{
	// 		keys: ["Comma"],
	// 		action: () => decide(true)
	// 	},
	// 	{
	// 		keys: ["Period"],
	// 		action: () => decide(false)
	// 	},
	// 	{
	// 		keys: ["Digit0"],
	// 		action: () => upscalePreview()
	// 	},
	// 	{
	// 		keys: ["ShiftRight", "KeyM"],
	// 		action: () => fixFocus()
	// 	}
	// ]);
}

async function authorize(userData: any){
	switchTabContent("state", "online");

	setElementValue("#settings-password", "");
	setElementValue("#settings-tg-token", userData.tg_token);
	setElementValue("#settings-additional", userData.additional);
	document
		.querySelector<HTMLTextAreaElement>("#settings-additional")
		?.addEventListener("input", updateSettingsFlicker);
	updateSettingsFlicker();

	document
		.querySelectorAll<HTMLElement>("[data-add-grabber]")
		.forEach(b =>
			b.addEventListener("click", () => {
				if (b.dataset.addGrabber === undefined) return;
				addGrabber(b.dataset.addGrabber as GrabberType)
			})
		);
	document
		.querySelector<HTMLElement>("#grabbers-save")
		?.addEventListener("click", () => saveGrabbers());


	showGrabbers(userData.grabbers);
	// loadModerables(userData.moderables);

	// report(`Welcome back, ${userData.name}. You have ${userData.postsScheduled} post${userData.postsScheduled == 1 ? "" : "s"} in pool, ${userData.moderables.length} pending moderation`)
}

async function login(e: Event){
	e.preventDefault();
	const id = document.querySelector<HTMLInputElement>("#login-id")?.value;
	const token = document.querySelector<HTMLInputElement>("#login-token")?.value ?? "";

	if (!id) return;

	if (!pullCurtain(true)) return;

	const parsedId = safe(() => parseInt(id, 10)) || 0;
	const response = await callAPI("login", {
		user: parsedId,
		userToken: token
	}, false);

	pullCurtain(false);
	if (response.status == 200) {
		save("login", {
			id: parsedId,
			token: token
		});
		authorize(response.data);
	}

	return false;
}



// async function manualCache(){
// 	pullCurtain(true);
	
// 	const status = await callAPI("linkCache", {}, true);
// 	if (status.status != 200){
// 		console.error(status);
// 		pullCurtain(false);
// 		return;
// 	}

// 	let counter = 0;
// 	const targets = status.data.leftUncached;
// 	for (let target of targets){
// 		updateCurtainMessage(`Downloading images: ${counter} / ${targets.length} done`);
// 		++counter;
		
// 		const r = await callAPI("downloadCache", {
// 			id: target.id
// 		}, true);
// 		if (r.status != 201)
// 			console.warn(r);
// 	}

// 	const newStatus = await callAPI("linkCache", {}, true);
// 	report(`Caching complete. ${newStatus.data?.leftUncached?.length} left uncached.`);
// 	console.log(newStatus);

// 	updateCurtainMessage(`Updating moderables`);
// 	await reloadModerables(false);

// 	pullCurtain(false);
// }

// async function reloadModerables(pullCurtains = true){
// 	if (pullCurtains) pullCurtain(true);
// 	const messages = await callAPI("getModerables", null, true);
// 	loadModerables(messages.data);
// 	if (pullCurtains) pullCurtain(false);
// }

// function loadModerables(messages){
// 	const mod_list = document.querySelector("#mdr_list");
// 	aiMode = load("login").id == 3;
// 	mod_list.innerHTML = "";
// 	messages.forEach(m => {
// 		if (aiMode)
// 			mod_list.appendChild(renderAiModerable(m.message, m.id));
// 		else
// 			mod_list.appendChild(renderModerable(m.message, m.id));
// 	});
// }

// function renderModerable(message, id){
// 	if (message.version != 3){
// 		console.error("Unsupported message version");
// 		return;
// 	}
// 	const proto = fromTemplate("moderation_item");
// 	proto.dataset.id = id;
// 	proto.dataset.original = message.content;
// 	if (message.cached) proto.dataset.upscaled = "weewee";

// 	const preview = message.cached ? message.cachedContent.preview : message.preview;
// 	const source = message.links[0].url;

// 	proto.querySelector("a").href = source;
// 	proto.querySelector("img").src = preview;

// 	const tagList = proto.querySelector(".row");
// 	function renderTag(text, color){
// 		const e = fromTemplate("moderation_tag");
// 		e.textContent = text;
// 		e.style.backgroundColor = color;
// 		return e;
// 	}
// 	if (message.nsfw)
// 		tagList.appendChild(renderTag("NSFW", "rgba(200, 0, 0, .3"));
// 	if (message.tags?.includes("animated"))
// 		tagList.appendChild(renderTag("animated", "rgba(50, 50, 200, .3"));
// 	if (message.tags?.includes("animated_gif"))
// 		tagList.appendChild(renderTag("GIF", "rgba(50, 50, 200, .3"));
// 	if (message.tags?.includes("video"))
// 		tagList.appendChild(renderTag("video", "rgba(50, 50, 200, .3"));
// 	if (message.artists)
// 		message.artists.forEach(artist => tagList.appendChild(renderTag(`🎨 ${artist}`, "rgba(250, 250, 250, .7")));

// 	const buttons = proto.querySelectorAll(".button");
// 	buttons[0].textContent = "Approve";
// 	buttons[0].addEventListener("click", () => {
// 		proto.classList.remove("rejected");
// 		proto.classList.add("approved");
// 	});
// 	buttons[1].textContent = "Reject";
// 	buttons[1].addEventListener("click", () => {
// 		proto.classList.add("rejected");
// 		proto.classList.remove("approved");
// 	});

// 	proto.addEventListener("focusin", e => proto.scrollIntoView({/*behavior: "smooth", */block: "center"}));
// 	proto.addEventListener("mousedown", e => e.preventDefault());

// 	return proto;
// }

// const UPSCALE_RETRY_COUNT = 3;
// async function upscalePreview(){
// 	async function upscale(e, retriesLeft = UPSCALE_RETRY_COUNT){
// 		if (e.dataset.upscaled === "weewee" && retriesLeft === UPSCALE_RETRY_COUNT) return;
// 		e.dataset.upscaled = "weewee";

// 		const url = `/api/imgproxy?j=1&w=0&url=${e.dataset.original}`;
// 		const response = await fetch(url);
// 		if (response.status === 504) {
// 			if (retriesLeft <= 0) return;
// 			await sleep(Math.random() * 5000);
// 			await upscale(e, retriesLeft - 1);
// 			return;
// 		}
// 		if (!response.ok) return;
// 		if (!response.headers.get("content-type").startsWith("image/")) return;
// 		const data = await response.arrayBuffer();
// 		const blob = new Blob([data]);
// 		e.querySelector("img").src = URL.createObjectURL(blob);
// 	}

// 	const targets = Array.from(document.querySelectorAll(".previewSection"));
// 	const chomnks = chunk(targets, 7);
// 	for (const chonk of chomnks) {
// 		const scaleJobs = chonk.map(e => upscale(e));
// 		await Promise.allSettled(scaleJobs);
// 		console.log("chonk done");
// 	};
// 	scalingLock = false;
// }

// function fixFocus(){
// 	const previews =  Array.from(document.querySelectorAll(".previewSection"));
// 	if (previews.length === 0) return;
// 	const target = previews.find(p => !(p.classList.contains("approved") || p.classList.contains("rejected")));
// 	if (target)
// 		target.focus();
// 	else
// 		previews[0].focus();
// }

// function decide(approve){
// 	const focused = document.activeElement;
// 	if (!focused.classList.contains("previewSection")) return;
// 	if (typeof approve == "boolean")
// 		focused.querySelectorAll(".button")[approve ? 0 : 1].click();
// 	else
// 		focused.querySelectorAll(".button")[approve].click();

// 	const nextSib = focused.nextElementSibling;
// 	if (nextSib?.classList.contains("previewSection")) 
// 		nextSib.focus();
// 	else
// 		document.querySelector("#moderateButton").scrollIntoView({behavior: "smooth", block: "center"});
// }

// async function moderate(){
// 	if (decisions.length == 0) return;

// 	pullCurtain(true);
// 	const newModerables = await callAPI("moderate", {decisions: decisions}, true);
	
// 	loadModerables(newModerables.data);
// 	pullCurtain(false);
// }

// function setPreviewPost(row){
// 	const main = document.querySelector("#poolPostMain");
// 	const preview = main.querySelector("img");
// 	if (row.message.version == 3){
// 		preview.src = row.message.cached ? row.message.cachedContent.preview : row.message.preview;
// 	} else {
// 		preview.src = row ? row.message.raw.preview || row.message.image[0] : PLACEHOLDER_URL;
// 	}
	

// 	const links = main.querySelector("#poolPostLinks");
// 	links.innerHTML = "";
// 	for (let link of row.message?.links || []){
// 		const proto = fromTemplate("poolPostLink");
// 		proto.href = link.url;
// 		proto.textContent = link.text;
// 		links.appendChild(proto);
// 	}

// 	const controls = main.querySelector("#poolPostControls");
// 	controls.innerHTML = "";

// 	if (row){
// 		const unsch = fromTemplate("poolButton");
// 		unsch.textContent = "Unschedule";
// 		unsch.addEventListener("click", () => unschedulePost(row));

// 		const copyd = fromTemplate("poolButton");
// 		copyd.textContent = "Show row data in console";
// 		copyd.addEventListener("click", () => console.log(row));

// 		controls.appendChild(unsch);
// 		controls.appendChild(copyd);
// 	}

// 	preview.scrollIntoView({behavior: "smooth", block: "center"})
// }

// async function unschedulePost(row){
// 	if (!row?.id) return;
// 	pullCurtain(true);
// 	const response = await callAPI("unschedulePost", {
// 		id: row.id
// 	}, true);

// 	if (response.status < 300){
// 		setPreviewPost(null);
// 		const remTarget = Array.from(document.querySelectorAll(".poolPreviewItem")).find(e => e.dataset.id == row.id);
// 		remTarget.remove();
// 	}
// 	pullCurtain(false);
// }

// async function loadMessagePool(page = 0){
// 	const STRIDE = 64;
// 	const container = document.querySelector(".poolPreviewContainer");
// 	container.innerHTML = "";

// 	pullCurtain(true);
// 	const rows = await callAPI("getPoolPage", {
// 		page: page,
// 		stride: STRIDE
// 	}, true);

// 	for (let row of rows.data.rows){
// 		const proto = fromTemplate("poolPreviewItem");
// 		proto.dataset.id = row.id;
// 		const img = proto.querySelector("img");
// 		if (row.message.version == 1){
// 			img.src = row.message.raw?.preview || row.message.image[0];
// 		} else if (row.message.version == 3) {
// 			img.src = row.message.cached ? row.message.cachedContent.preview : row.message.preview;
// 		} else {
// 			img.src = PLACEHOLDER_URL;
// 		}
// 		img.addEventListener("click", () => setPreviewPost(row));
		
// 		container.appendChild(proto);
// 	}

// 	const pager = document.querySelector("#poolPageControls");
// 	pager.innerHTML = "";
// 	const postCount = rows.data.count;
// 	const pageCount = Math.ceil(postCount / STRIDE);
// 	for (let i = 0; i < pageCount; ++i){
// 		const pageSelector = fromTemplate("poolButton");
// 		pageSelector.textContent = i + 1;
// 		pageSelector.addEventListener("click", () => loadMessagePool(i));
// 		pager.appendChild(pageSelector);
// 	}

// 	pullCurtain(false);
// }

let wipeLock = true;
async function wipePool(){
	if (wipeLock){
		wipeLock = false;
		console.log("safety off. call function again to wipe current pool");
	} else {
		wipeLock = true;
		pullCurtain(true);
		const wipeResponse = await callAPI("wipePool", {}, true);
		pullCurtain(false);
		if (wipeResponse.status === 200)
			location.reload();
	}
}

function updateSettingsFlicker(){
	genericFlickerUpdate("#settings-additional", "#settings-flicker",
		contents => {
			if (contents){
				const parsed = safe(() => JSON.parse(contents));
				if (parsed === null){
					return ["Not JSON", "hsla(20, 72%, 23%, .42)"];
				} else {
					return ["JSON", "hsla(100, 72%, 23%, .42)"];
				}
			} else {
				return ["Empty", "hsla(0, 0%, 60%, .42)"];
			}
		}
	);
}

async function saveSettings(){
	const newPassword = document.querySelector<HTMLInputElement>("#stg_access")?.value.trim() || null;
	const tgToken = document.querySelector<HTMLInputElement>("#stg_tg")?.value || null;
	const additionals = document.querySelector<HTMLTextAreaElement>("#stg_additional")?.value;

	pullCurtain(true);
	await callAPI("saveSettings", {
		newUserToken: newPassword,
		newTgToken: tgToken,
		additionalData: additionals
	}, true);
	if (newPassword) signOut();
	pullCurtain(false);
}

function signOut(){
	save("login", null);
	switchTabContent("state", "login");
}

// function report(msg){
// 	let message = document.createElement("div");
// 	message.textContent = msg;

// 	document.querySelector("#statuslog").prepend(message);

// 	Array.from(document.querySelector("#statuslog").children).forEach((c, i) => c.style.opacity = (100 / (i + 1)) + "%");
// }
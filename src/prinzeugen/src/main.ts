import { callAPI, safe, sleep, setElementValue, load, save } from "./utils/utils";
import { Grabbers } from "./utils/grabbers";
import type { GrabberType } from "./utils/grabbers"
import { listenToKeyboard } from "./utils/io";
import { updateTabListeners, switchTabContent } from "./utils/tabs";
import { pullCurtain, updateCurtainMessage } from "./utils/curtain";
import { genericFlickerUpdate } from "./utils/flicker";
import { init as initConsole, report } from "./utils/console";

import { addGrabber, saveGrabbers, displayGrabbers, batchGrab } from "./grabbing";
import { decide, fixFocus, upscalePreviews, displayModerables, moderate, reloadModerables } from "./moderation";

const PLACEHOLDER_URL = "placeholder.png";

main();

async function main(){
	updateTabListeners();

	window.addEventListener("error", (event) => {
		report(`${event.message}\n\n${event.filename} ${event.lineno}:${event.colno}`);
	});
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
			keys: ["Digit0"],
			action: () => upscalePreviews()
		},
		{
			keys: ["ShiftRight", "KeyM"],
			action: () => fixFocus()
		}
	]);
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

	function addClick(query: string, action: () => void) {
		document
			.querySelector<HTMLElement>(query)
			?.addEventListener("click", action);
	}
	addClick("#dashboard-grab", batchGrab);
	addClick("#grabbers-save", saveGrabbers);
	addClick("#moderables-reload", reloadModerables);
	addClick("#moderables-upscale", upscalePreviews);
	addClick("#moderables-submit", moderate);
	addClick("#settings-save", saveSettings);
	addClick("#settings-signout", signOut);

	initConsole();

	displayGrabbers(userData.grabbers);
	displayModerables(userData.moderables);

	report(`Welcome back, ${userData.name}. You have ${userData.postsScheduled} post${userData.postsScheduled == 1 ? "" : "s"} in pool, ${userData.moderables.length} pending moderation`);
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
	const newPassword = document.querySelector<HTMLInputElement>("#settings-password")?.value.trim() || null;
	const tgToken = document.querySelector<HTMLInputElement>("#settings-tg-token")?.value || null;
	const additionals = document.querySelector<HTMLTextAreaElement>("#settings-additional")?.value ?? "";

	pullCurtain(true);
	await callAPI("saveSettings", {
		newUserToken: newPassword,
		newTgToken: tgToken,
		additionalData: additionals
	}, true);
	pullCurtain(false);
	if (newPassword) signOut();
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
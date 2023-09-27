
import { validate } from "arstotzka"; 
import { phetchV2, safeParse, tg, tgReport } from "./utils.js";

export function sleep(ms){
	return new Promise(resolve => setTimeout(resolve, ms));
}

const VK_BATCH = 100;
async function vk(token, group, offset = 0){
	function result(success, data) {
		return {success, data}
	}
	function requestLink (accessToken, groupId, offset) {
		return `https://api.vk.com/method/wall.get?access_token=${accessToken}&owner_id=${groupId}&offset=${offset}&count=${VK_BATCH}&v=5.131`
	}

	const url = requestLink(token, group, offset);

	const response = await phetchV2(url);
	if (response.body?.response?.items)
		return result(true, response.body.response);
	else
		return result(false, response);
}

async function getStorage(binId, mKey){
	return await phetchV2(`https://api.jsonbin.io/v3/b/${binId}/latest?meta=false `, {
		method: "GET",
		headers: {
			"X-Master-Key": mKey
		}
	});
}

async function setStorage(binId, mKey, data){
	return await phetchV2(`https://api.jsonbin.io/v3/b/${binId}`, {
		method: "PUT",
		headers: {
			"Content-Type": "application/json",
			"X-Master-Key": mKey
		}
	}, JSON.stringify(data));
}

function cleansing(vkPosts){
	function extractPhotoURL(sizes){
		const type = ["z", "y", "x", "w"].find(t => sizes.find(s => s.type === t));
		if (type)
			return sizes.find(s => s.type === type).url;
		else
			return null;
	}

	//console.log(vkPosts[0])
	return vkPosts.map(p => ({
		id: p.id,
		caption: p.text,
		photos: p.attachments
			?.filter(a => a.type == "photo")
			?.map(a => extractPhotoURL(a.photo.sizes)) ?? [],
		videos: p.attachments
			?.filter(a => a.type == "video")
			?.map(a => a.video.image.url) ?? [],
		otherAttachments: p.attachments?.some(a => !(a.type === "photo" || a.type === "video"))
	}));
}

async function publish(post, target, token){
	function button(text, url){
		return {text, url};
	}
	function tgParams(post){
		const pics = [
			...post.photos,
			...post.videos
		];
		const buttons = [
			[button("View Post", `https://vk.com/wall-137762094_${post.id}`)]
		];
		const hasVideo = post.videos.length > 0 ? "\n\nThis post has video attached" : "";
		
		const captionLimit = 3200;
		const slicedCaption = post.caption.slice(0, captionLimit) + (post.caption.length > captionLimit ? "..." : "");
		const caption = slicedCaption + hasVideo;

		switch(pics.length){
			case(0): return ["sendMessage", {
				chat_id: target,
				text: caption || "/",
				reply_markup: {inline_keyboard: buttons}
			}];
			case(1): return ["sendPhoto", {
				chat_id: target,
				photo: pics[0],
				...(caption.length > 0 ? {caption: caption} : {}),
				reply_markup: {inline_keyboard: buttons}
			}];
			default: return ["sendMediaGroup", {
				chat_id: target,
				media: pics.map((url, i) => ({
					type: "photo",
					media: url,
					...((i === 0 && caption.length > 0) ? {caption: caption} : {})
				})),
				reply_markup: {inline_keyboard: buttons}
			}]
		}
	}

	const [command, params] = tgParams(post);
	if (command === "sendMessage" && params.text === "/") return;
	const re = safeParse(await tg(command, params, token));
	if (!re?.ok){
		await tgReport(`GayDev: publishing for #${post.id} failed\n${re}`)
	}
}

export default async function handler(request, response) {
	if (request.method != "POST" || !request.body){
		response.status(400).send("Malformed request. Content-Type header and POST required.");
		return;
	}
	const errors = validate(request.body, {
		vkAccessToken: "string",
		vkGroupId: "number",
		storageBin: "string",
		storageKey: "string",
		tgToken: "string",
		tgTarget: "number"
	});
	if (errors.length > 0){
		response.status(400).send(errors);
		return;
	}

	const [{body:{lastId: lastId}}, page] = await Promise.all([
		getStorage(request.body.storageBin, request.body.storageKey),
		vk(request.body.vkAccessToken, request.body.vkGroupId, 0)
	]);

	const cleanPage = cleansing(page.data.items).filter(p => p.id > lastId).sort((a, b) => a.id - b.id);
	
	if (cleanPage.length > 0){
		//console.log(`setting bin to ${cleanPage[0].id}`);
		await Promise.all([
			publish(cleanPage[0], request.body.tgTarget, request.body.tgToken),
			setStorage(request.body.storageBin, request.body.storageKey, {lastId: cleanPage[0].id})
		]);
	}
	response.status(200).send(cleanPage);
	return;
}
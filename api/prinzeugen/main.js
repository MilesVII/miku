import { chunk, safe, tg, tgReport, phetch, phetchV2, safeParse, hashPassword, parseTelegramTarget, wegood, escapeMarkdown, processImage } from "../utils.js";
import { grabbersMeta } from "./grabbers.js";
import { validate, ARRAY_OF, OPTIONAL, DYNAMIC } from "arstotzka"; 

const GRAB_INTERVAL_MS = 0 * 60 * 60 * 1000; // 1hr
const NINE_MB = 9 * 1024 * 1024;
const PUB_FLAGS = {
	ALLOW_IMG_ONLY: "imgonly",
	USE_PROXY: "useproxy",
	NO_SIZE_LIMIT: "nosizelimit",
	KEEP_AFTER_POST: "keep",
	CUSTOM_BUTTONS: "custombuttons",
	MARKDOWN_LINKS: "markdownlinks",
	DOUBLE_TAP: "doubletap"
};
const imageProxy = url => `https://mikumiku.vercel.app/api/imgproxy?j=2&url=${url}`;

const TG_BUTTON_SCHEMA = {
	text: "string",
	url: "string"
};

const schema = {
	debug:{},
	login: {
		user: "number",
		userToken: "string"
	},
	saveSettings: {
		user: "number",
		userToken: "string",
		newUserToken: [],
		newTgToken: [],
		additionalData: "string"
	},
	setGrabbers: {
		user: "number",
		userToken: "string",
		grabbers: ARRAY_OF([
			DYNAMIC(x => grabbersMeta[x?.type]?.schema),
			{
				type: "string"
			}
		])
	},
	getGrabbers: {
		user: "number",
		userToken: "string"
	},
	grab: {
		user: "number",
		userToken: "string",
		id: [OPTIONAL, "number"],
		batchSize: [OPTIONAL, "number"]
	},
	linkCache: {
		user: "number",
		userToken: "string"
	},
	optimizeCache: {
		user: "number",
		userToken: "string"
	},
	downloadCache: {
		user: "number",
		userToken: "string",
		id: "number"
	},
	getModerables: {
		user: "number",
		userToken: "string"
	},
	getPool: {
		user: "number"
	},
	getPoolPage: {
		user: "number",
		page: "number"
	},
	wipePool: {
		user: "number",
		userToken: "string"
	},
	moderate: {
		user: "number",
		userToken: "string",
		decisions: ARRAY_OF({
			id: "number",
			approved: "boolean",
			score: [OPTIONAL, "number"]
		})
	},
	unschedulePost: {
		user: "number",
		userToken: "string",
		id: "number"
	},
	manual: {
		user: "number",
		userToken: "string",
		posts: ARRAY_OF({
			images: ARRAY_OF("string"),
			links: ARRAY_OF(TG_BUTTON_SCHEMA)
		})
	},
	publish: {
		user: "number",
		userToken: "string",
		target: "string",
		id: [OPTIONAL, "number"],
		flags: [OPTIONAL, ARRAY_OF(["string", x => Object.values(PUB_FLAGS).includes(x)])],
		count: [OPTIONAL, "number"],
		extras: OPTIONAL
	}
};

const messageSchema = [
	{//0, deprecated version, publisher depends on it's 'raw' property to convert to newer version
		version: ["number", x => x == 0],
		attachments: "array",
		caption: "string"
	},
	{//1
		version: ["number", x => x == 1],
		image: ARRAY_OF("string"),
		links: ARRAY_OF(TG_BUTTON_SCHEMA)
	},
	{//2, telegram preuploaded
		version: ["number", x => x == 2],
		id: "string",
		type: "string",
		links: "array"
	},
	{//3, no raw
		version: ["number", x => x == 3],
		raw: [OPTIONAL, x => false],
		tags: [OPTIONAL, ARRAY_OF("string")],
		artists: [OPTIONAL, ARRAY_OF("string")],
		nsfw: [OPTIONAL, "boolean"],
		cached: [OPTIONAL, "boolean"],
		notCacheable: [OPTIONAL, "boolean"],
		cachedContent: [OPTIONAL, {
			content: "string",
			preview: "string",
		}],
		content: "string",
		preview: "string",
		links: ARRAY_OF(TG_BUTTON_SCHEMA)
	}
];

async function db(url, method, headers, body){
	return safeParse(
		await phetch(`${process.env.PE_DB_URL}${url}`, {
			method: method || "GET",
			headers: Object.assign({
				"apikey": process.env.PE_SUPABASE_KEY,
				"Authorization": `Bearer ${process.env.PE_SUPABASE_KEY}`,
				"Content-Type": "application/json"
			}, headers || {})
		}, body ? JSON.stringify(body) : null)
	);
}

function db2(url, method, headers, body){
	return phetchV2(`${process.env.PE_DB_URL}${url}`, {
		method: method || "GET",
		headers: Object.assign({
			"apikey": process.env.PE_SUPABASE_KEY,
			"Authorization": `Bearer ${process.env.PE_SUPABASE_KEY}`,
			"Content-Type": "application/json"
		}, headers || {})
	}, body ? JSON.stringify(body) : null);
}

function storage(url, method, headers, body){
	return phetchV2(`${process.env.PE_DB_URL}${url}`, {
		method: method || "GET",
		headers: Object.assign({
			"apikey": process.env.PE_SUPABASE_KEY,
			"Authorization": `Bearer ${process.env.PE_SUPABASE_KEY}`
		}, headers || {})
	}, body || null);
}

function uploadToStorage(bucket, path, data){
	return storage(`/storage/v1/object/${bucket}/${path}`, "POST", null, data);
}

function getStorageLink(bucket, path){
	return `${process.env.PE_DB_URL}/storage/v1/object/public/${bucket}/${path}`;
}

async function listStorageContents(bucket, path){
	const PAGE_SIZE = 1000;
	function fwoosh(page){
		return storage(`/storage/v1/object/list/${bucket}`, "POST", {
			"Content-Type": "application/json"
		}, JSON.stringify({
			prefix: path,
			limit: PAGE_SIZE,
			offset: page * PAGE_SIZE
		}));
	}

	const first = await fwoosh(0);
	if (!wegood(first.status)) return first;

	let lastLength = first.body.length;
	for (let i = 1; lastLength == PAGE_SIZE; ++i){
		const aux = await fwoosh(i);
		if (!wegood(aux.status)) return aux;
		lastLength = aux.body.length;
		first.body.push(...aux.body);
	}

	return first.body;
}

function removeStorageContents(bucket, names){
	const payload = JSON.stringify({
		prefixes: names,
	});
	return storage(`/storage/v1/object/${bucket}`, "DELETE", {
		"Content-Type": "application/json",
		"Content-Length": payload.length //won't work without length specified. will fail if there are unicode characters in names
	}, payload);
}

async function getAllRows(table, queryParameters){
	function result(success, data){
		return {success, data};
	}
	const url = `/rest/v1/${table}?${queryParameters.join("&")}`;

	const first = await db2(url, "GET", {"Prefer": "count=exact"});
	if (!wegood(first.status)) 
		return result(false, first);

	const rows = first.body;

	const rng = parseContentRange(first.headers["content-range"]);
	const stride = rng.to - rng.from;

	while (rng.count > rng.to){
		rng.from += stride;
		rng.to += stride;
		const amndmnt = await db2(url, "GET", {
			"Prefer": "count=exact",
			"Range": rng.renderRange()
		});
		if (wegood(amndmnt.status)) {
			rows.push(...amndmnt.body);
		} else {
			return result(false, amndmnt);
		}
	}

	return result(true, 200, rows);
}

function renderContentRange(from, to){
	return `${from}-${to - 1}`;
}

function parseContentRange(range){
	try {
		const parts = range.split("/");
		const leftParts = parts[0].split("-");
		const proto = {
			from: parseInt(leftParts[0], 10),
			to: parseInt(leftParts[1], 10) + 1,
			count: parseInt(parts[1], 10)
		};
		proto.renderRange = () => `${proto.from}-${Math.min(proto.to, proto.count) - 1}`;
		return proto;
	} catch(e){
		return null;
	}
}

async function grab(user, token, id, batchSize){
	function flatten(arr){
		return arr.reduce((p, c) => p.concat(c), []);
	}

	const now = Date.now();

	const grabbers = await getGrabbers(user, token);
	if (grabbers.length == 0) return [];
	if (grabbers == null) return null;

	let selection = grabbers;
	if (id || id === 0){
		if (id >= 0 && id < grabbers.length)
			selection = [grabbers[id]];
		else
			return null;
	}

	const options = {
		skipArtists: user == 3,
		batchSize: batchSize
	};

	let moderated = [];
	let approved = [];
	for (const grabber of selection){
		grabber.state.lastGrab = grabber.state.lastGrab || 0;
		if (now - grabber.state.lastGrab > GRAB_INTERVAL_MS){
			grabber.state.lastGrab = now;
			const prom = grabbersMeta[grabber.type].action(grabber, options);

			if (grabber.config.moderated) 
				moderated.push(prom);
			else
				approved.push(prom);
		}
	}
	
	const entries0 = flatten(await Promise.all(moderated)).map(message => ({
		message: message,
		user: user,
		failed: false,
		approved: null
	}));
	
	const entries1 = flatten(await Promise.all(approved)).map(message => ({
		message: message,
		user: user,
		failed: false,
		approved: true
	}));

	const newEntries = entries0.concat(entries1);

	const response = await db("/rest/v1/pool", "POST", {"Prefer": "return=representation"}, newEntries);
	if (grabbers.length > 0)
		await setGrabbers(user, token, grabbers);

	return response;
}

async function getGrabbers(user, token){
	const response = await db(
		`/rest/v1/users?id=eq.${user}&access_token=eq.${token}&select=grabbers`,
		"GET",
		null,
		null
	);
	if (response[0]?.grabbers)
		return response[0].grabbers || [];
	else
		return null;
}

async function setGrabbers(user, token, grabbers){
	for (let grabber of grabbers)
		if (!grabber.state.lastGrab) grabber.state.lastGrab = 0;
	const response = await db2(
		`/rest/v1/users?id=eq.${user}&access_token=eq.${token}&select=grabbers`,
		"PATCH",
		{"Prefer": "return=representation"},
		{grabbers: grabbers}
	);

	if (wegood(response.status))
		return true;
	else {
		tgReport(JSON.stringify(response));
		return false;
	}
}

function getModerables(user){
	return db(
		`/rest/v1/pool?approved=is.null&user=eq.${user}&select=*`,
		"GET",
		{"Range": "0-199"},
		null
	);
}

async function getScheduledPostCount(user){
	const response = await db2(`/rest/v1/pool?user=eq.${user}`, "HEAD", {"Prefer": "count=exact"});
	return response.headers["content-range"]?.split("/")[1];
}

async function userAccessAllowed(id, token){
	const user = await db(`/rest/v1/users?id=eq.${id}&select=access_token`, "GET", null, null);
	return user && user[0] && (user[0]["access_token"] == token || user[0]["access_token"] == null);
}

async function pingContentUrl(url){
	const meta = await phetchV2(url, {method: "HEAD"});
	if (meta.status != 200) return null;

	const typeRaw = meta.headers["content-type"] || "image/dunno";
	let type;
	if (typeRaw.startsWith("image/") && typeRaw != "image/gif")
		type = "img";
	else if (typeRaw == "image/gif")
		type = "gif";
	else
		type = "vid";
	
	return {
		length: parseInt(meta.headers["content-length"] || "0", 10),
		type: type
	}
}

function linksToMarkdown(links){
	return links
		.map(button => `[${escapeMarkdown(button.text)}](${escapeMarkdown(button.url)})`)
		.join(" ");
}

function linksToMarkup(links){
	return {
		inline_keyboard: chunk(links, 2)
	};
}

//return null on success or any object on error
async function publish2Telegram(message, token, target, extras = {}, flags){
	const validationErrors = validate(message, messageSchema[message.version]);
	if (validationErrors.length > 0){
		return validationErrors;
	}

	function metaSand(type, content, links){
		const useMarkdownLinks = flags.includes(PUB_FLAGS.MARKDOWN_LINKS) || extras.customMarkup;

		const messageData = {
			chat_id: target
		};

		if (useMarkdownLinks){
			messageData.caption = linksToMarkdown(links);
			messageData.parse_mode = "MarkdownV2"
		} else {
			messageData.reply_markup = linksToMarkup(links)
		}

		if (extras.customMarkup){
			messageData.reply_markup = extras.customMarkup
		}

		if (extras.extraLink){
			let appendix = null;
			if (typeof extras.extraLink == "string"){
				appendix = {
					text: "More",
					url: extras.extraLink
				};
			} else if (extras.extraLink.text && extras.extraLink.url){
				appendix = extras.extraLink;
			}

			if (appendix){
				if (useMarkdownLinks){
					const md = linksToMarkdown([appendix]);
					messageData.caption += `\n${md}`;
				} else {
					links.push(appendix);
					messageData.reply_markup = linksToMarkup(links);
				}
			}
		}

		let command;
		switch (type.trim().toLowerCase()){
			case ("img"): {
				messageData.photo = content;
				command = "sendPhoto";
				break;
			}
			case ("gif"): {
				messageData.animation = content;
				command = "sendAnimation";
				break;
			}
			case ("vid"): {
				messageData.video = content;
				command = "sendVideo";
				break;
			}
			case ("doc"): {
				messageData.document = content;
				command = "sendDocument";
				break;
			}
			default: return "Can't detect content type to send to Tg"
		}
		return tg(command, messageData, token);
	}

	if (message.version == 0){
		message.version = 1;
		
		const imageVariants = message.attachments[0]
			.slice(0, 2)
			.filter(l => l.length > 0);

		message.image = imageVariants;

		if (!message.raw.source?.startsWith("http")) message.raw.source = null;
		message.links = [
			{text: "Gelbooru", url: message.raw.link},
			{text: "Source", url: message.raw.source || null},
		].filter(i => i.url).concat(message.raw.artists.map(a => ({
			text: `🎨 ${a}`,
			url: `https://gelbooru.com/index.php?page=post&s=list&tags=${a}`
		})));
	}
	if (message.version == 1){
		if (message.image.length > 0){
			const meta = await pingContentUrl(message.image[0]);
			if (!meta) return "No head?";
			let usingProxy = flags.includes(PUB_FLAGS.USE_PROXY);

			let content = message.image[0];
			if (meta.type == "img" && usingProxy) content = imageProxy(content);
			if (meta.type == "img" && !usingProxy && meta.length > NINE_MB){
				if (message.image[1]){
					content = message.image[1];
				} else {
					content = imageProxy(content);
					usingProxy = true;
				}
			}

			const report = {};

			report.tg = await metaSand(meta.type, content, message.links);
			if (safeParse(report.tg)?.ok) return null;

			if (meta.type != "img" || usingProxy)
				return report;
			content = imageProxy(content);
			report.retry = await metaSand(meta.type, content, message.links);
			if (safeParse(report.retry)?.ok) 
				return null;
			else
				return report;
		} else {
			return "No attachments";
		}
	}
	if (message.version == 2){
		const report = await metaSand(message.type, message.id, message.links);
		if (safeParse(report)?.ok) return null;
		return report;
	}
	if (message.version == 3){
		const meta = await pingContentUrl(message.content);
		if (!meta) return "No head?";
		
		const report = {};

		report.direct = await metaSand(meta.type, message.content, message.links);
		if (safeParse(report.direct)?.ok) return null;

		if (message.cached){
			report.fromCache = await metaSand(meta.type, imageProxy(message.cachedContent.content), message.links);
			if (safeParse(report.fromCache)?.ok) return null;
		}
		if (meta.type == "img") {
			report.proxy = await metaSand(meta.type, imageProxy(message.content), message.links);
			if (safeParse(report.proxy)?.ok) return null;
		}
		return report;
	}
	
	return "WTF is that message version, how did you pass validation";
}

const CACHING_ERROR_NOT_IMAGE = "not image";
async function saveCache(id, content){
	const meta = await pingContentUrl(content);
	if (meta?.type != "img") return CACHING_ERROR_NOT_IMAGE;
	
	const raw = await phetchV2(content);
	if (!wegood(raw.status)) return "failed to download";
	
	const [original, preview] = await Promise.all([
		processImage(raw.raw, {format: "avif", resize: {w: 2048, h: 2048}}),
		processImage(raw.raw, {format: "avif", resize: {w: 1024, h: 1024}})
	]);
	if (!original || !preview) return [null, null];
	
	const [r0, r1] = await Promise.all([
		uploadToStorage("images", `${id}.avif`, original.data),
		uploadToStorage("images", `${id}_p.avif`, preview.data)
	]);

	const wefine = 
		r => wegood(r.status) || 
		(
			r.status == 400 && 
			r.body.statusCode == "409" && 
			r.body.error == "Duplicate"
		);

	if (wefine(r0) && wefine(r1)){
		return [
			getStorageLink("images", `${id}.avif`),
			getStorageLink("images", `${id}_p.avif`)
		]
	} else return "failed to upload";
}

export default async function handler(request, response) {
	if (request.method != "POST" || !request.body){
		response.status(400).send("Malformed request. Content-Type header and POST required.");
		return;
	}
	if (!schema[request.body?.action]){
		response.status(400).send(`Unknown action: ${request.body?.action}\nRqBody: ${JSON.stringify(request.body)}`);
		return;
	}
	const validationErrors = validate(request.body, schema[request.body.action]);
	if (validationErrors.length > 0){
		response.status(400).send(validationErrors);
		return;
	}
	if (request.body.userToken) request.body.userToken = hashPassword(request.body.userToken);

	const PUBLIC_ACTIONS = ["debug", "login"];

	if (!PUBLIC_ACTIONS.includes(request.body.action)){
		if (!await userAccessAllowed(request.body.user, request.body.userToken)){
			response.status(401).send("Wrong user id or access token");
			return;
		}
	}

	switch (request.body.action){
		case ("debug"): {
			response.status(200).send();
			return;
		}
		case ("login"): {
			const userData = await db(`/rest/v1/users?id=eq.${request.body.user}`);
			if (userData?.length > 0 && (userData[0]["access_token"] == request.body.userToken || userData[0]["access_token"] == null)){
				userData[0]["access_token"] = null;

				const lickTheTongue = await Promise.all([
					getModerables(request.body.user, request.body.userToken),
					getScheduledPostCount(request.body.user)
				]);
				userData[0].moderables = lickTheTongue[0];
				userData[0].postsScheduled = lickTheTongue[1];
				response.status(200).send(userData[0]);
			} else {
				response.status(401).send(null);
			}
			return;
		}
		case ("saveSettings"): {
			const delta = {
				additional: request.body.additionalData
			};
			if (request.body.newUserToken) delta.access_token = hashPassword(request.body.newUserToken);
			if (request.body.newTgToken) delta.tg_token = request.body.newTgToken;
			
			await db(`/rest/v1/users?id=eq.${request.body.user}`, "PATCH", {"Prefer": "return=minimal"}, delta);
			response.status(200).send();
			return;
		}
		case ("getGrabbers"): {
			const grabs = await getGrabbers(request.body.user, request.body.userToken);
			if (grabs)
				response.status(200).send(grabs);
			else
				response.status(401).send("Wrong user id or access token");
			return;
		}
		case ("grab"): {
			const newRows = await grab(request.body.user, request.body.userToken, request.body.id, request.body.batchSize);
			if (newRows == null){
				response.status(400).send("Wrong ID specified (out of range)");
				return;
			}
			response.status(200).send(newRows);
			return;
		}
		case ("linkCache"): {
			const storageList = await listStorageContents("images", "");
			if (!Array.isArray(storageList)){
				response.status(502).send(storageList);
				return;
			}

			const allRows = await db2(`/rest/v1/pool?user=eq.${request.body.user}&message->version=eq.3&message->cached=eq.false&select=id,message`, "GET", {"Prefer": "count=exact"});
			if (!wegood(allRows.status)){
				response.status(502).send(allRows);
				return;
			}
			const rows = allRows.body.filter(r => !r.message.notCacheable); //TODO: Potential issue if pool has more than 1000 not cacheable posts

			const targets = rows.filter(r => storageList.find(s => s.name == `${r.id}.avif`));
			targets.forEach(r => {
				r.message.cached = true;
				r.message.cachedContent = {
					content: getStorageLink("images", `${r.id}.avif`),
					preview: getStorageLink("images", `${r.id}_p.avif`)
				}
			});

			let update = "No rows updated";
			if (targets.length > 0)
				update = await db2(`/rest/v1/pool?user=eq.${request.body.user}`, "POST", {"Prefer": "resolution=merge-duplicates"}, targets);

			response.status(200).send({
				leftUncached: rows.filter(r => !targets.includes(r)),
				linked: targets,
				updateStatus: update
			});
			return;
		}
		case ("downloadCache"): {
			//Only single post can be cached due to timeout issue
			//The goal is to save cached version to storage
			const rows = await db2(`/rest/v1/pool?user=eq.${request.body.user}&id=eq.${request.body.id}`, "GET");
			if (!wegood(rows.status)){
				response.status(502).send(rows);
				return;
			}
			if (rows.body?.length != 1){
				response.status(404).send(rows);
				return;
			}

			const post = rows.body[0];
			if (post.message.version != 3){
				response.status(400).send("Invalid message format version");
				return;
			}
			if (post.message.cached){
				response.status(200).send("Cached already");
				return;
			}
			if (post.message.notCacheable){
				response.status(202).send("Post not cacheable");
				return;
			}

			const links = await saveCache(post.id, post.message.content);
			if (!Array.isArray(links)){
				if (links == CACHING_ERROR_NOT_IMAGE){
					post.message.notCacheable = true;
					await db(
						`/rest/v1/pool?id=eq.${post.id}`,
						"PATCH",
						{"Prefer": "return=minimal"},
						{message: post.message}
					);
				}
				response.status(502).send(links);
				return;
			}
			response.status(201).send();
			return;
		}
		case ("optimizeCache"): {
			if (request.body.user != 1) {
				response.status(401).send("shoo");
				return;
			}
			const [storageList, posts] = await Promise.all([
				listStorageContents("images", ""),
				getAllRows("pool", [
					"message->cached=eq.true"
				])
			]);
			if (!Array.isArray(storageList)){
				response.status(502).send(storageList);
				return;
			}
			if (!posts.success){
				response.status(502).send(posts.data);
				return;
			}

			const targets = storageList
				.filter(item => !posts.data.some(post => post.id == parseInt(item.name)))
				.filter(item => !item.name.startsWith("."));

			if (targets.length > 0){
				const deletionResponse = await removeStorageContents("images", targets.map(t => t.name));
				response.status(deletionResponse.status).send(deletionResponse);
			} else {
				response.status(204).send();
			}
			return;
		}
		case ("setGrabbers"): {
			const success = await setGrabbers(request.body.user, request.body.userToken, request.body.grabbers);
			response.status(success ? 200 : 401).send();
			return;
		}
		case ("getModerables"): {
			const messages = await getModerables(request.body.user, request.body.userToken);
			response.status(200).send(messages);
			return;
		}
		case ("getPool"): {
			const rows = getAllRows("pool", [
				`user=eq.${request.body.user}`,
				"approved=eq.true"
			]);

			response.status(rows.success ? 200 : 502).send(rows.data);
			return;
		}
		case ("getPoolPage"): {
			const stride = request.body.stride || 100;
			const page = request.body.page;
			const rows = await db2(`/rest/v1/pool?user=eq.${request.body.user}&approved=eq.true`, "GET", {
				"Prefer": "count=exact",
				"Range": renderContentRange(page * stride, (page + 1) * stride)
			});
			if (wegood(rows.status)) {
				response.status(200).send({
					count: parseContentRange(rows.headers["content-range"]).count,
					rows: rows.body
				});
				return;
			} else {
				response.status(502).send();
				return;
			}
		}
		case ("wipePool"): {
			const re = await db2(
				`/rest/v1/pool?user=eq.${request.body.user}`,
				"DELETE",
				null,
				null
			);
			const status = wegood(re.status) ? 200 : re.status;
			response.status(status).send();
			return;
		}
		case ("moderate"): {
			const decisionSchema = {
				id: "number",
				approved: "boolean"
			};
			const decisions = request.body.decisions.filter(d => validate(d, decisionSchema).length == 0);
			
			await db(`/rest/v1/pool?approved=is.null&user=eq.${request.body.user}`, "POST", {"Prefer": "resolution=merge-duplicates"}, decisions);
			await db(`/rest/v1/pool?approved=eq.false`, "DELETE");
			const newModerables = await getModerables(request.body.user);
			
			response.status(200).send(newModerables);
			return;
		}
		case ("post"): {
			const messages = request.body.messages;
			if (!messages.every(m => validate(m, messageSchema[m.version]).length == 0)){
				response.status(400).send("Invalid messages schema");
				return;
			}

			const entries = messages.map(m => ({
				user: request.body.user,
				message: m,
				failed: false,
				approved: true
			}));

			const r = await db("/rest/v1/pool", "POST", {"Prefer": "return=minimal"}, entries);

			response.status(200).send(r);
			break;
		}
		case ("unschedulePost"): {
			const re = await db2(
				`/rest/v1/pool?user=eq.${request.body.user}&id=eq.${request.body.id}`,
				"DELETE",
				null,
				null
			);
			const status = wegood(re.status) ? 200 : re.status;
			response.status(status).send();
			return;
		}
		case ("manual"): {
			const messages = request.body.posts.map(post => post.grab ? null : {
				version: 1,
				image: post.images,
				links: post.links
			});
			const entries = messages.map(m => ({
				user: request.body.user,
				message: m,
				failed: false,
				approved: true
			}));
			const r = await db("/rest/v1/pool", "POST", {"Prefer": "return=minimal"}, entries);
			response.status(200).send(r);
			break;
		}
		case ("publish"): {
			const flags = request.body.flags?.map(f => f.trim().toLowerCase()) || [];

			const idFilter = request.body.id ? "&id=eq." + request.body.id : "";
			const failFilter = idFilter ? "" : "&failed=eq.false";
			const url = `/rest/v1/pool?approved=eq.true${failFilter}&user=eq.${request.body.user}${idFilter}&select=*,users!inner(tg_token,access_token,additional)`;

			let availablePosts = await db(url);
			if (!availablePosts){
				response.status(502).send("Invalid response from db");
				return;
			}
			if (availablePosts.length == 0){
				response.status(404).send("No scheduled posts for this user");
				return;
			}
			if (availablePosts[0]["users"]["access_token"] != request.body.userToken){
				response.status(401).send("Wrong user access token");
				return;
			}

			const target = parseTelegramTarget(request.body.target);
			if (!target && !flags.includes(PUB_FLAGS.URL_AS_TARGET)){
				response.status(400).send("Can't parse telegram target");
				return;
			}

			const selectedPosts = [];
			const count = safe(() => parseInt(request.body.count, 10)) || 1;
			for (let _ = 0; _ < count && availablePosts.length > 0; ++_){
				const index = Math.floor(availablePosts.length * Math.random());
				selectedPosts.push(availablePosts.splice(index, 1)[0]);
			}

			while (selectedPosts.length > 0){
				const post = selectedPosts.pop();
				const error = /* flags.includes(PUB_FLAGS.URL_AS_TARGET) ?
					await publish2URL(post.message, request.body.target, flags, request.body.extras)
				:
					*/ await publish2Telegram(post.message, post["users"]["tg_token"], target, request.body.extras, flags);

				if (error){
					if (flags.includes(PUB_FLAGS.DOUBLE_TAP) && availablePosts.length > 0){
						selectedPosts.push(availablePosts.pop());
					}
					await Promise.allSettled([
						tgReport(`Failed to publish post #${post.id}.\nResponse:\n${JSON.stringify(error)}`),
						db(
							`/rest/v1/pool?id=eq.${post.id}`,
							"PATCH",
							{"Prefer": "return=minimal"},
							{failed: true}
						)
					]);
				} else {
					if (!flags.includes(PUB_FLAGS.KEEP_AFTER_POST)){
						await db(
							`/rest/v1/pool?id=eq.${post.id}`,
							"DELETE",
							null,
							null
						);
					}
				}
			}

			response.status(200).send();
			return;
		}
		default: {
			response.status(400).send("Malformed request");
			return;
		}
	}
}

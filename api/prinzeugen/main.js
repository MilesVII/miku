import { chunk, safe, tg, tgReport, phetch, safeParse, hashPassword, getFileLength, parseTelegramTarget, SCH, validate, tgUploadPhoto } from "../utils.js";
import { grabbers, grabbersMeta } from "./grabbers.js";

const schema = {
	debug:{},
	login: {
		user: SCH.number,
		userToken: SCH.string
	},
	setGrabbers: {
		user: SCH.number,
		userToken: SCH.string,
		grabbers: SCH.array
	},
	getGrabbers: {
		user: SCH.number,
		userToken: SCH.string
	},
	grab: {
		user: SCH.number,
		userToken: SCH.string
	},
	getModerable: {
		user: SCH.number,
		userToken: SCH.string
	},
	moderate: {
		user: SCH.number,
		userToken: SCH.string,
		decisions: SCH.array
	},
	post: {
		user: SCH.number,
		userToken: SCH.string,
		messages: SCH.array,
		target: SCH.string
	},
	publish: {
		user: SCH.number,
		userToken: SCH.string,
		target: SCH.string
		//id can also be specified
	}
};

const messageSchema = [
	{//0, deprecated version, publisher depends on it's 'raw' property to convert to newer version
		version: SCH.number,
		attachments: SCH.array,
		caption: SCH.string
	},
	{//1
		version: SCH.number,
		image: SCH.array,
		links: SCH.array
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

async function grab(user, token){
	function flatten(arr){
		return arr.reduce((p, c) => p.concat(c), []);
	}

	let grabbers = await getGrabbers(user, token);

	let moderated = [];
	let approved = [];
	for (const grabber of grabbers){
		const prom = grabbersMeta[grabber.type].action(grabber);

		if (grabber.config.moderated) 
			moderated.push(prom);
		else
			approved.push(prom);
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

	await db("/rest/v1/pool", "POST", {"Prefer": "return=minimal"}, newEntries);
	await setGrabbers(user, token, grabbers);

	return newEntries.length;
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
	const response = await db(
		`/rest/v1/users?id=eq.${user}&access_token=eq.${token}&select=grabbers`,
		"PATCH",
		{"Prefer": "return=representation"},
		{grabbers: grabbers}
	);

	if (response?.length > 0)
		return true;
	else
		return false;
}

function validateGrabber(grabber){
	const schema = grabbersMeta[grabber?.type]?.schema;
	return (
		grabber.type && schema &&
		validate(schema, grabber)
	);
}

function getModerables(user){
	return db(
		`/rest/v1/pool?approved=is.null&user=eq.${user}&select=*`,
		"GET",
		{"Range": "0-100"},
		null
	);
}

async function userAccessAllowed(id, token){
	const user = await db(`/rest/v1/users?id=eq.${id}&select=access_token`, "GET", null, null);
	return user && user[0] && user[0]["access_token"] == token;
}

//return null on success or any object on error
async function sendMessage(message, token, target){
	if (!validate(messageSchema[message.version], message)){
		return "Invalid message schema";
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
			const fileLength = await getFileLength(message.image[0]);
			if (fileLength.status != 200) return "Bad status from HEAD to image source";
			let firstSkipped = false;

			let fatto = false;
			let image = message.image[0];
			if (fileLength.length > 5 * 1024 * 1024){
				firstSkipped = true;
				if (message.image[1]){
					image = message.image[1];
				} else {
					fatto = true;
				}
			}

			const report = {};
			if (fatto){
				//Todo: try resizing the fattos on my side
				return "Fatto! Original image too big, no alternative sources";
			} else {
				report.tg = await tg("sendPhoto", {
					chat_id: target,
					photo: image,
					reply_markup: {
						inline_keyboard: chunk(message.links, 2)
					}
				}, token);

				if (safeParse(report.tg)?.ok) return null;

				if (report.tg.includes("ailed to get HTTP URL content")){
					report.retry = await tgUploadPhoto(image, target, {inline_keyboard: chunk(links, 2)}, token);
					if (safeParse(report.retry)?.ok) 
						return null;
					else
						return report;
				} else
					return report;
			}
		} else {
			return "No attachments";
		}
	}
	
	return "WTF is that message version, how did you pass validation";
}

export default async function handler(request, response) {
	if (request.method != "POST" || !request.body){
		response.status(400).send("Malformed request");
		return;
	}
	if (!schema[request.body?.action]){
		response.status(400).send("Unknown action");
		return;
	}
	if (!validate(schema[request.body.action], request.body)){
		response.status(400).send("Invalid action schema");
		return;
	}
	if (request.body.userToken) request.body.userToken = hashPassword(request.body.userToken);

	switch (request.body.action){
		case ("debug"): {
			const r = null;
			response.status(200).send(r);
			return;
		}
		case ("login"): {
			const userData = await db(`/rest/v1/users?id=eq.${request.body.user}`);
			if (userData?.length > 0 && userData[0]["access_token"] == request.body.userToken){
				userData[0]["access_token"] = null;
				userData[0].moderables = await getModerables(request.body.user, request.body.userToken);
				response.status(200).send(userData[0]);
			} else {
				response.status(401).send(null);
			}
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
			const count = await grab(request.body.user, request.body.userToken);
			response.status(200).send(count);
			return;
		}
		case ("setGrabbers"): {
			const invalidGrabbers = request.body.grabbers.filter(g => !validateGrabber(g));
			if (invalidGrabbers.length > 0) {
				response.status(400).send(invalidGrabbers);
				return;
			}
			
			const success = await setGrabbers(request.body.user, request.body.userToken, request.body.grabbers);
			response.status(success ? 200 : 401).send();
			return;
		}
		case ("getModerables"): {
			const messages = await getModerables(request.body.user, request.body.userToken);
			response.status(200).send(messages);
			return;
		}
		case ("moderate"): {
			if (!await userAccessAllowed(request.body.user, request.body.userToken)){
				response.status(401).send("Wrong user id or access token");
				return;
			}
			
			const decisionSchema = {
				id: SCH.number,
				approved: SCH.bool
			};
			const decisions = request.body.decisions.filter(d => validate(decisionSchema, d));
			//console.log(`${request.body.decisions.length - decisions.length} decisions rejected`);

			await db(`/rest/v1/pool?approved=is.null&user=eq.${request.body.user}`, "POST", {"Prefer": "resolution=merge-duplicates"}, decisions);
			await db(`/rest/v1/pool?approved=eq.false`, "DELETE");
			const newModerables = await getModerables(request.body.user);
			
			response.status(200).send(newModerables);
			return;
		}
		case ("post"): {
			if (!await userAccessAllowed(request.body.user, request.body.userToken)){
				response.status(401).send("Wrong user id or access token");
				return;
			}

			//const r = await db("/rest/v1/pool", "POST", {"Prefer": "return=minimal"}, payload);

			response.status(200).send(r);
			break;
		}
		case ("publish"): {
			//User can inject filters by abusing target or id properties, but the result of query will be processed on server anyways
			const idFilter = request.body.id ? "&id=eq." + request.body.id : "";
			const failFilter = idFilter ? "" : "&failed=eq.false";
			const url = `/rest/v1/pool?approved=eq.true${failFilter}&user=eq.${request.body.user}${idFilter}&select=*,users!inner(tg_token,access_token)`;

			const target = parseTelegramTarget(request.body.target);
			if (!target){
				response.status(400).send("Can't parse telegram target");
				return;
			}

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

			const selectedPosts = [];
			const count = safe(() => parseInt(request.body.count, 10)) || 1;
			for (let _ = 0; _ < count && availablePosts.length > 0; ++_){
				const index = Math.floor(availablePosts.length * Math.random());
				selectedPosts.push(availablePosts[index]);
				availablePosts = availablePosts.filter((v, i) => i != index);
			}

			for (const post of selectedPosts){
				const error = await sendMessage(post.message, post["users"]["tg_token"], target);

				if (error){
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
					await db(
						`/rest/v1/pool?id=eq.${post.id}`,
						"DELETE",
						null,
						null
					);
				}
			}

			response.status(200).send();
			break;
		}
		default: {
			response.status(400).send("Malformed request");
			return;
		}
	}
}

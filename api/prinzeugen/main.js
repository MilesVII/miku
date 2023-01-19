import { chunk, tg, tgReport, phetch, safeParse, hashPassword, getFileLength, parseTelegramTarget, SCH, validate, tgUploadPhoto } from "../utils.js";
import { grabbers, grabbersMeta } from "./grabbers.js";

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
	let grabbers = await getGrabbers(user, token);
	console.log(grabbers[0].state.lastSeen);

	const results = await Promise.all(grabbers.map(g => grabbersMeta[g.type].action(g)));
	const messages = results.reduce((p, c) => p.concat(c), []);
	
	console.log(grabbers[0].state.lastSeen);
	console.log(messages.length);
}

async function getGrabbers(user, token){
	const response = await db(
		`/rest/v1/users?id=eq.${user}&access_token=eq.${token}&select=grabbers`,
		"GET",
		null,
		null
	);
	console.log(response)
	if (response?.length > 0 && Object.hasOwn(response[0], "grabbers"))
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
		messages: SCH.array
	},
	post: {
		user: SCH.number,
		userToken: SCH.string,
		messages: SCH.array,
		target: SCH.string
	},
	publish: {
		user: SCH.number,
		userToken: SCH.string
		//target and id can also be specified
	}
};

const messageSchema = [
	{
		version: SCH.number,
		attachments: SCH.array,
		caption: SCH.string
	}
];

function validateGrabber(grabber){
	const schema = grabbers[grabber?.type]?.schema;
	return (
		grabber.type && schema &&
		validate(schema, grabber)
	);
}

async function userAccessAllowed(id, token){
	const user = safeParse(
		await db(`/rest/v1/users?id=eq.${id}&select=access_token`, "GET", null, null)
	);
	return user && user[0] && user[0]["access_token"] == token;
}

async function sendMessage(message, token, target){
	async function slowFind(src, searchlight){
		for (let i of src)
			if (await searchlight(i)) return i;
		return null;
	}

	let sent = false;
	let tgResponse;

	if (message.version == 0){
		const imageVariants = 
			message.attachments[0]
			.slice(0, 2)
			.filter(l => l.length > 0);
		
		if (imageVariants.length > 0){
			const status = {debug: null};
			const l = await getFileLength(imageVariants[0], status);
			let firstSkipped = false;

			let fatto = false;
			let image = imageVariants[0];
			if (l > 5 * 1024 * 1024){
				firstSkipped = true;
				if (imageVariants[1]){
					image = imageVariants[1];
				} else {
					fatto = true;
				}
			}

			if (!message.raw.source?.startsWith("http")) message.raw.source = null;

			const links = [
				{text: "Gelbooru", url: message.raw.link},
				{text: "Source", url: message.raw.source || null},
			].filter(i => i.url).concat(message.raw.artists.map(a => ({
				text: `🎨 ${a}`,
				url: `https://gelbooru.com/index.php?page=post&s=list&tags=${a}`
			})));

			if (fatto){
				//Todo: try resizing the fattos on my side
				tgResponse = {e: "Fatto!"};
			} else {
				tgResponse = safeParse(await tg("sendPhoto", {
					chat_id: target,
					photo: image,
					reply_markup: {
						inline_keyboard: chunk(links, 2)
					}
				}, token)) || {};

				if (JSON.stringify(tgResponse).includes("failed to get HTTP URL content")){
					const result = await Promise.all([
						tgReport(`Retried`),
						tgUploadPhoto(image, target, {inline_keyboard: chunk(links, 2)}, token)
					]);
					const retryResponse = safeParse(result[1]) || {};
					if (retryResponse?.ok) tgResponse.ok = true;
					tgResponse.retried = retryResponse;
				}
			}
			tgResponse.prinz = {
				length: l,
				firstSkipped: firstSkipped,
				status: status.debug
			}
			sent = !!tgResponse?.ok;
		} else if (message.attachments.length == 0){
			tgResponse = safeParse(await tg("sendMessage", {
				chat_id: target,
				text: message.caption,
				parse_mode: "MarkdownV2"
			}, token)) || {};
			sent = !!tgResponse?.ok;
		} else {
			tgResponse = "No attachments approved";
			sent = false;
		}
	}
	
	if (sent) return null;
	return tgResponse;
}

export default async function handler(request, response) {
	if (request.method != "POST" || !request.body){
		response.status(400).send("Malformed request");
		return;
	}
	if (!schema[request.body.action]){
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
			await grab(request.body.user, request.body.userToken);
			response.status(200).send();
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
			const messages = await db(
				`/rest/v1/pool?approved=eq.false&user=eq.${request.body.user}&users!inner(access_token)=eq.${request.body.userToken}&select=*`,
				"GET",
				{"Range": "0-100"},
				null
			);
			response.status(200).send(messages);
			return;
		}
		case ("moderate"): {
			response.status(501).send();
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
			const targetFilter = request.body.target ? "&target=eq." + request.body.target : "";
			const idFilter = request.body.id ? "&id=eq." + request.body.id : "";
			const failFilter = idFilter ? "" : "&failed=eq.false";
			const url = `/rest/v1/pool?approved=eq.true${failFilter}&user=eq.${request.body.user}${targetFilter}${idFilter}&select=*,users!inner(tg_token,access_token)`;

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
			const count = request.body.count || 1;
			for (let _ = 0; _ < count && availablePosts.length > 0; ++_){
				const index = Math.floor(availablePosts.length * Math.random());
				selectedPosts.push(availablePosts[index]);
				availablePosts = availablePosts.filter((v, i) => i != index);
			}

			for (const post of selectedPosts){
				let success = false;
				let tgResponse = null;

				const target = parseTelegramTarget(post.target);
				if (target != null) {
					tgResponse = await sendMessage(post.message, post["users"]["tg_token"], target);
					if (tgResponse == null)
						success = true;
				} else {
					tgReport(`Failed to parse target id for post #${post.id}`);
				}

				if (success){
					await db(
						`/rest/v1/pool?id=eq.${post.id}`,
						"DELETE",
						null,
						null
					);
				} else {
					await Promise.allSettled([
						tgReport(`Failed to publish post #${post.id}.\nTelegram response:\n${JSON.stringify(tgResponse)}`),
						db(
							`/rest/v1/pool?id=eq.${post.id}`,
							"PATCH",
							{"Prefer": "return=minimal"},
							{failed: true}
						)
					])
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
	
	/*const queryOptions = Object.assign({
				query: "sort:score",
				page: 0
			}, request.body);
			
		
			if (queryOptions.key && queryOptions.user){
				const r = await gelbooruPosts(queryOptions.key, queryOptions.user, queryOptions.query, queryOptions.page);
				response.status(200).send(r);
			} else {
				response.status(400).send("key and user properties should be set");
			}
			break;*/
}

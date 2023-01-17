import { tg, tgReport, phetch, safeParse, getFileLength, parseTelegramTarget } from "../utils.js";
import { grabbers } from "./grabbers.js";

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

	const results = await Promise.allSettled(grabbers.map(g => g.action()));
	const messages = results.reduce((p, c) => p.concat(c), []);
	
	console.log(grabbers);
	console.log(messages);
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

const SCH = {
	any: 0,
	string: 1,
	number: 2,
	bool: 3,
	array: 4
};
const schema = {
	debug:{},
	login: {
		user: SCH.number,
		userToken: SCH.string
	},
	setGrabbers: {
		user: SCH.number,
		userToken: SCH.string,
		grabbers: SCH.any
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

const grabberSchemas = {
	gelbooru: {
		credentials: {
			user: SCH.number,
			token: SCH.string
		},
		config: {
			tags: SCH.array,
			white: SCH.array,
			blacks: SCH.array,
			moderated: SCH.bool
		},
		state: {
			lastSeen: SCH.number
		}
	}
};

const messageSchema = [
	{
		version: SCH.number,
		attachments: SCH.array,
		caption: SCH.string
	}
];

function validate(schema, obj){
	const objProperties = Object.keys(obj);
	return Object.keys(schema).every(skey => {
		if (!objProperties.includes(skey)) return false;
		if (typeof schema[skey] == "object") return validate(schema[skey], obj[skey]);
		switch (schema[skey]){
			case (SCH.any):    return true;
			case (SCH.string): return typeof obj[skey] == "string";
			case (SCH.number): return typeof obj[skey] == "number";
			case (SCH.bool):   return typeof obj[skey] == "boolean";
			case (SCH.array):  return Array.isArray(obj[skey]);
			default: return true;
		}
	});
}

function validateGrabber(grabber){
	return (
		grabber.type && grabber.schema &&
		validate(grabber.schema, grabber)
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
		message.attachments = message.attachments.slice(0, 2).filter(l => l.length > 0);

		const attachments = (await Promise.all(message.attachments.map(linkSet =>
			slowFind(linkSet, async link => (await getFileLength(link)) < 9*1024*1024)
		))).filter(link => link);

		if (attachments.length > 0){
			console.log(attachments);
			const mediaGroup = attachments.map(link => ({
				type: "photo",
				media: link
			}));
			mediaGroup[0].caption = message.caption;
			mediaGroup[0].parse_mode = "MarkdownV2";
			
			tgResponse = safeParse(await tg("sendMediaGroup", {
				chat_id: target,
				media: mediaGroup
			}, token)) || {};
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
	switch (request.body.action){
		case ("debug"): {
			//const r = await db(`/rest/v1/pool?failed=eq.true`, "PATCH", null, {failed: false});
			const r = await db(`/rest/v1/pool?user=eq.1`, "PATCH", null, {target: "-1001599644614"});
			
			response.status(200).send(r);
			return;
		}
		case ("login"): {
			const success = await userAccessAllowed(request.body.user, request.body.userToken);
			response.status(success ? 200 : 401).send();
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
			if (!Array.isArray(request.body.grabbers)) {
				response.status(400).send("Invalid action schema: 'grabbers' must be an array");
				return;
			}
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
			console.log(messages);
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
			const url = `/rest/v1/pool?failed=eq.false&approved=eq.true&user=eq.${request.body.user}${targetFilter}${idFilter}&select=*,users!inner(tg_token,access_token)`;

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

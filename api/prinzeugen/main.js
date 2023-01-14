import { tg, tgReport, phetch, last, safeParse, escapeMarkdown } from "../utils.js";

function buildURLParams(params){
	return Object.keys(params)
		.map(k => `${k}=${encodeURIComponent(params[k])}`)
		.join("&");
}

async function db(url, method, headers, body){
	return safeParse(
		await phetch(`${process.env.PE_DB_URL}${url}`, {
			method: method || "GET",
			headers: Object.assign({
				"apikey": process.env.PE_SUPABASE_KEY,
				"Authorization": `Bearer ${process.env.PE_SUPABASE_KEY}`,
				"Content-Type": "application/json"
			}, headers || {})
		}, JSON.stringify(body) || null)
	);
}

async function grab(user, token){
	let grabbers = await getGrabbers(id, token);

	const grabs = grabbers.map(grabber => GRABBERS[grabber.type]);
	await Promise.allSettled(grabs);


}

const GRABBERS = {
	"gelbooru": async grabber => {
		const lastSeen = grabber.state.lastSeen || 0;
		const mandatoryFilter = ["sort:id:asc", `id:>${lastSeen}`];

		const tags = grabber.config.tags.join(" ~ ");
		const black = grabber.config.black.join(" ~ ");
		const white = mandatoryFilter.concat(grabber.config.white).join(" ");
		const query = `{${tags}} -{${black}} ${white}`;

		const params = buildURLParams({
			page: "dapi",
			s: "post",
			q: "index",
			tags: query,
			pid: 0,
			json: 1,
			api_key: key,
			user_id: user
		});
		const url = `https://gelbooru.com/index.php?${params}`;

		const response = safeParse(await phetch(url)) || {};
		const posts = (response?.post || []).map(raw => ({
			links: [
				raw.file_url,
				raw.sample_url,
				raw.preview_url,
			],
			id: raw.id,
			link: `https://gelbooru.com/index.php?page=post&s=view&id=${raw.id}`,
			source: raw.source?.startsWith("http") ? raw.source : null,
			tags: raw.tags.split(" "),
			rating: raw.score,
			nsfw: !(raw.rating == "general" || raw.rating == "sensitive"),
			artists: tags.filter(a => raw.tags.includes(a))
		}));

		if (posts.length > 0) grabber.state.lastSeen = last(posts).id;

		function caption(post){
			const emd = escapeMarkdown;
			const gbSource = `[gb](${post.link})`;
			const originalSource = post.source ? ` [src](${emd(post.source)})` : "";
			const artists = post.artists
				.map(
					a => `[${emd(a)}](https://gelbooru.com/index.php?page=post&s=list&tags=${emd(encodeURIComponent(raw))})`
				)
				.join(" & ");
			return `${gbSource}${originalSource}\n${artists}`;
		}

		const messages = posts.map(p => ({
			raw: p,
			attachments: [p.links],
			caption: caption(p)
		}));

		return messages;
	}
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

function setGrabbers(user, token, grabbers){
	return db(
		`/rest/v1/users?id=eq.${user}&access_token=eq.${token}&select=grabbers`,
		"PATCH",
		null,
		{grabbers: grabbers}
	);
}

const SCH = {
	any: 0,
	string: 1,
	number: 2,
	bool: 3,
	array: 4
};
const schema = {
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
		grabber.type && 
		grabberSchemas[grabber.type] && 
		validate(grabberSchemas[grabber.type], grabber)
	);
}

async function userAccessAllowed(id, token){
	const user = safeParse(
		await db(`/rest/v1/users?id=eq.${id}&select=access_token`, "GET", null, null)
	);
	return user && user[0] && user[0]["access_token"] == token;
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
			
			await setGrabbers(request.body.user, request.body.userToken, request.body.grabbers);
			response.status(200).send();
			return;
		}
		case ("post"): {
			if (!await userAccessAllowed(request.body.user, request.body.userToken)){
				response.status(401).send("Wrong user id or access token");
				return;
			}

			const r = await db("/rest/v1/pool", "POST", {"Prefer": "return=minimal"}, payload);

			response.status(200).send(r);
			break;
		}
		case ("publish"): {
			//User can inject filters by abusing target or id properties, but the result of query will be processed on server anyways
			const targetFilter = request.body.target ? "&target=eq." + request.body.target : "";
			const idFilter = request.body.id ? "&id=eq." + request.body.id : "";
			const url = `/rest/v1/pool?failed=eq.false&approved=eq.true&user=eq.${request.body.user}${targetFilter}${idFilter}&select=*,users!inner(tg_token,access_token)`;

			let availablePosts = safeParse(await db(url));

			if (!availablePosts){
				response.status(500).send("Invalid response from db");
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
				let sent = true;
				let tgResponse;
				if (post.message.links.length > 0){
					const mediaGroup = post.message.links.map(link => ({
						type: "photo",
						media: link
					}));
					mediaGroup[0].caption = post.message.caption;
					mediaGroup[0].parse_mode = "MarkdownV2"
					tgResponse = safeParse(await tg("sendMediaGroup", {
						chat_id: post.target,
						media: mediaGroup
					}, post["users"]["tg_token"])) || {};
					sent = !!tgResponse?.ok;
				}
				if (sent){
					//Remove post from db
					await db(
						`/rest/v1/pool?id=eq.${post.id}`,
						"DELETE",
						null,
						null
					);

				} else {
					//something is fucked up, mark message as broken or dunno
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

			/**/
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

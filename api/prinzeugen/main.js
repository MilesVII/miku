import { tg, tgReport, phetch, safeParse } from "../utils.js";

function buildURLParams(params){
	return Object.keys(params)
		.map(k => `${k}=${encodeURIComponent(params[k])}`)
		.join("&");
}

function gelbooruPosts(key, user, query, page){
	const params = buildURLParams({
		page: "dapi",
		s: "post",
		q: "index",
		tags: query,
		pid: page,
		json: 1,
		api_key: key,
		user_id: user
	});
	const url = `https://gelbooru.com/index.php?${params}`;
	
	return phetch(url);
}


const schema = {
	add: {
		user: true,
		userToken: true,
		messages: true, //[]
		target: true
	},
	publish: {
		user: true,
		userToken: true
		//target and id can also be specified
	}
}

function validate(schema, obj){
	const objProperties = Object.keys(obj);
	return Object.keys(schema).every(skey =>
		objProperties.includes(skey) && (schema[skey] == true || validate(schema[skey], obj[skey]))
	);
}

async function userAccessAllowed(id, token){
	const url = `${process.env.PE_DB_URL}/rest/v1/users?id=eq.${id}&select=access_token`;
	const headers = {
		"apikey": process.env.PE_SUPABASE_KEY,
		"Authorization": `Bearer ${process.env.PE_SUPABASE_KEY}`,
		"Content-Type": "application/json"
	};
	let user;
	try {
		user = JSON.parse(
			await phetch(url, {
				method: "GET",
				headers: headers
			}, null)
		);
	} catch(e){
		return false;
	}
	
	return user[0] && user[0]["access_token"] == token;
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
		case ("add"): {
			if (!await userAccessAllowed(request.body.user, request.body.userToken)){
				response.status(401).send("Wrong user id or access token");
				return;
			}

			const url = `${process.env.PE_DB_URL}/rest/v1/pool`;
			const headers = {
				"apikey": process.env.PE_SUPABASE_KEY,
				"Authorization": `Bearer ${process.env.PE_SUPABASE_KEY}`,
				"Content-Type": "application/json",
				"Prefer": "return=minimal"
			};
			// const payload = {
			// 	user: request.body.user,
			// 	message: request.body.message,
			// 	target: request.body.target
			// };
			const payload = request.body.messages.map(msg => ({
				user: request.body.user,
				message: {
					links: msg.links,
					caption: msg.caption
				},
				target: request.body.target
			}))
			const r = await phetch(url, {
				method: "POST",
				headers: headers
			}, JSON.stringify(payload));

			response.status(200).send(r);
			break;
		}
		case ("publish"): {
			//User can inject filters by abusing target or id properties, but the result of query will be processed on server anyways
			const targetFilter = request.body.target ? "&target=eq." + request.body.target : "";
			const idFilter = request.body.id ? "&id=eq." + request.body.id : "";
			const url = `${process.env.PE_DB_URL}/rest/v1/pool?user=eq.${request.body.user}${targetFilter}${idFilter}&select=*,users!inner(tg_token,access_token)`;
			const headers = {
				"apikey": process.env.PE_SUPABASE_KEY,
				"Authorization": `Bearer ${process.env.PE_SUPABASE_KEY}`
			};
			let availablePosts = await phetch(url, {
				method: "GET",
				headers
			}, null);

			availablePosts = safeParse(availablePosts);
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
					sent = !!tgResponse.ok;
				}
				if (sent){
					//Remove post from db
					const url = `${process.env.PE_DB_URL}/rest/v1/pool?id=eq.${post.id}`;
					const headers = {
						"apikey": process.env.PE_SUPABASE_KEY,
						"Authorization": `Bearer ${process.env.PE_SUPABASE_KEY}`
					};
					await phetch(url, {
						method: "DELETE",
						headers
					}, null);

				} else {
					//something is fucked up, mark message as broken or dunno
					tgReport(`Failed to publish post #${post.id}.\nTelegram response:\n${JSON.stringify(tgResponse)}`);
				}
				tgReport(post.id + " " + JSON.stringify(tgResponse));
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

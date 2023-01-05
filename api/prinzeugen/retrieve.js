import { phetch } from "../utils.js";

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
	
	console.log(url);
	return phetch(url);
}

export default async function handler(request, response) {
	const queryOptions = Object.assign({
		query: "sort:score",
		page: 0
	}, request.body);
	

	if (queryOptions.key && queryOptions.user){
		const r = await gelbooruPosts(queryOptions.key, queryOptions.user, queryOptions.query, queryOptions.page);
		response.status(200).send(r);
	} else {
		response.status(400).send("key and user properties should be set");
	}
}

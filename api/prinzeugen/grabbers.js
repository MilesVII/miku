import { last, phetch, escapeMarkdown, safeParse, SCH, unique, range, sleep } from "../utils.js";

function buildURLParams(params){
	return Object.keys(params)
		.map(k => `${k}=${encodeURIComponent(params[k])}`)
		.join("&");
}

async function glbFilterArtists(allTags, u, t){
	const paramsPrototype = {
		api_key: t,
		user_id: u,
		page: "dapi",
		s: "tag",
		q: "index",
		pid: 0,
		json: 1,
		names: allTags.join(" ")
	};
	let tagsParams = buildURLParams(paramsPrototype);
	let tagsUrl = `https://gelbooru.com/index.php?${tagsParams}`;

	let tagsResponse = safeParse(await phetch(tagsUrl)) || {};
	if (!tagsResponse["@attributes"]) return null;

	const pageCount = Math.ceil(tagsResponse["@attributes"].count / tagsResponse["@attributes"].limit)
	const pageRange = range(1, pageCount);
	const throttle = pageRange.length > 7;
	const additionals = await Promise.all(pageRange.map(async page => {
		paramsPrototype.pid = page;
		const params = buildURLParams(paramsPrototype);
		const url = `https://gelbooru.com/index.php?${params}`;
		if (throttle) await sleep(Math.random() * 5000);
		return safeParse(await phetch(url));
	}));

	if (additionals.some(pack => !pack)) return null;

	additionals.forEach(pack => tagsResponse.tag = tagsResponse.tag.concat(pack.tag));
	const artists = tagsResponse.tag.filter(t => t?.type == 1).map(t => t.name);

	return artists;
}

async function twtGetUserIdByName(token, username){
	const response = await phetch(`https://api.twitter.com/2/users/by/username/${username}`, {
		method: "GET",
		headers: {
			"Authorization": `Bearer ${token}`
		}
	}, null);
	return safeParse(response)?.data?.id || null;
}

async function twtGetTweets(token, userId, offset, pagination){
	const paginationParameter = pagination ? `pagination_token=${pagination}&` : "";
	const url = `https://api.twitter.com/2/users/${userId}/tweets?${paginationParameter}${[
		"exclude=retweets,replies",
		"expansions=author_id,attachments.media_keys",
		"media.fields=preview_image_url,type,url",
		"user.fields=username",
		"max_results=100",
		`since_id=${offset}`
	].join("&")}`;

	const response = safeParse(await phetch(url, {
		method: "GET",
		headers: {
			"Authorization": `Bearer ${token}`
		}
	}, null));

	if (!response) return null;

	const additionalBatch = response.meta.next_token ? (await twtGetTweets(token, userId, offset, response.meta.next_token)) : [];

	const imagesRaw = (response?.includes?.media || []).filter(m => m.type == "photo");
	const usersRaw = (response?.includes?.users || []);
	const tweetsRaw = (response?.data || []);

	function tweetByMedia(mediaKey){
		return tweetsRaw.find(tweet => tweet.attachments?.media_keys?.includes(mediaKey));
	}
	function usernameByTweet(tweet){
		return usersRaw.find(u => u?.id == tweet?.author_id)?.username;
	}
	function usernameByMedia(mediaKey){
		const tweet = tweetByMedia(mediaKey);
		return usernameByTweet(tweet);
	}
	function tweetLinkByMedia(mediaKey){
		const tweet = tweetByMedia(mediaKey);
		const username = usernameByTweet(tweet);
		if (tweet?.id && username)
			return `https://twitter.com/${username}/status/${tweet.id}`;
		else
			return null;
	}
	function userLinkByMedia(mediaKey){
		const username = usernameByMedia(mediaKey);
		if (username)
			return `https://twitter.com/${username}`;
		else
			return null;
	}

	const lastId = response?.meta?.newest_id;

	return imagesRaw.map(raw => {
		const artistName = `@${usernameByMedia(raw.media_key)}`;
		
		return {
			version: 1,
			raw: {
				lastId: lastId,
				artists: [artistName]
			},
			preview: raw.preview_image_url || `${raw.url}?format=jpg&name=small`,
			image: [
				raw.url,
				`${raw.url}?format=jpg&name=medium`,
				`${raw.url}?format=jpg&name=small`
			].filter(l => l),
			links: [
				{text: "Twitter", url: tweetLinkByMedia(raw.media_key)},
				{text: `🎨 ${artistName}`, url: userLinkByMedia(raw.media_key)}
			].filter(l => l.url)
		}
	}).concat(additionalBatch);
}

async function twtGetMessage(token, tweetId){
	//not implemented
	const url = `https://api.twitter.com/2/tweets/${tweetId}${[
		"expansions=author_id,attachments.media_keys",
		"media.fields=preview_image_url,type,url",
		"user.fields=username"
	].join("&")}`;
	const response = safeParse(await phetch(url, {
		method: "GET",
		headers: {
			"Authorization": `Bearer ${token}`
		}
	}));
	console.log(response)
}

export const manualGrabbers = {
	"twitter": async (postId, token) => {
		return null;
	},
	"gelbooru": async (postId, user, key) => {
		return null;
		const params = buildURLParams({
			page: "dapi",
			s: "post",
			q: "index",
			tags: `id:${postId}`,
			pid: 0,
			json: 1,
			api_key: key,
			user_id: user
		});
		const url = `https://gelbooru.com/index.php?${params}`;
	}
}

export const grabbersMeta = {
	"twitter": {
		schema: {
			credentials: {
				token: SCH.string
			},
			config: {
				username: SCH.string,
				moderated: SCH.bool
			},
			state: {
				lastSeen: SCH.string
			}
		},
		action: async grabber => {
			if (!grabber.config.userId){
				grabber.config.userId = await twtGetUserIdByName(grabber.credentials.token, grabber.config.username);
			}

			const messages = await twtGetTweets(grabber.credentials.token, grabber.config.userId, grabber.state.lastSeen || 0) || [];
			if (messages[0]?.raw?.lastId) grabber.state.lastSeen = messages[0].raw.lastId;

			return messages;
		}
	},
	"gelbooru": {
		schema: {
			credentials: {
				user: SCH.number,
				token: SCH.string
			},
			config: {
				tags: SCH.array,
				whites: SCH.array,
				blacks: SCH.array,
				moderated: SCH.bool
			},
			state: {
				lastSeen: SCH.number
			}
		},
		action: async grabber => {
			const lastSeen = grabber.state.lastSeen || 0;
			const mandatoryFilter = ["sort:id:asc", `id:>${lastSeen}`];

			const tags = grabber.config.tags.join(" ~ ");
			const black = grabber.config.blacks.join(" ~ ");
			const white = mandatoryFilter.concat(grabber.config.whites).join(" ");
			const bq = grabber.config.blacks.length > 0 ? `-{${black}} ` : "";
			const query = `${tags} ${bq}${white}`;

			const params = buildURLParams({
				page: "dapi",
				s: "post",
				q: "index",
				tags: query,
				pid: 0,
				json: 1,
				api_key: grabber.credentials.token,
				user_id: grabber.credentials.user
			});
			const url = `https://gelbooru.com/index.php?${params}`;

			const response = safeParse(await phetch(url)) || {};
			const posts = (response?.post || []).map(raw => ({
				links: [
					raw.file_url,
					raw.sample_url
				].filter(l => l && l != ""),
				id: raw.id,
				link: `https://gelbooru.com/index.php?page=post&s=view&id=${raw.id}`,
				preview: raw.preview_url || null,
				source: raw.source?.startsWith("http") ? raw.source : null,
				tags: raw.tags.split(" "),
				rating: raw.score,
				nsfw: !(raw.rating == "general" || raw.rating == "sensitive"),
				artists: grabber.config.tags.filter(a => raw.tags.includes(a))
			}));

			const allTags = unique(posts.map(p => p.tags).reduce((p, c) => p.concat(c), []));
			if (posts.length > 0){
				const allArtists = await glbFilterArtists(allTags, grabber.credentials.user, grabber.credentials.token);
				if (allArtists)
					posts.forEach(p => p.artists = allArtists.filter(a => p.tags.includes(a)));
				else
					return [];
			}

			if (posts.length > 0) grabber.state.lastSeen = last(posts).id;

			const messages = posts.map(p => ({
				version: 1,
				raw: p,
				image: p.links,
				links: [
						{text: "Gelbooru", url: p.link},
						{text: "Source", url: p.source}
					].filter(l => l.url).concat(
						p.artists.map(a => ({
							text: `🎨 ${a}`,
							url: `https://gelbooru.com/index.php?page=post&s=list&tags=${a}`
						}))
					)
			}));

			return messages;
		}
	}
}

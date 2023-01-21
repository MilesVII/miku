import { last, phetch, escapeMarkdown, safeParse, SCH, unique, range } from "../utils.js";

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
	const additionals = await Promise.all(pageRange.map(async page => {
		paramsPrototype.pid = page;
		const params = buildURLParams(paramsPrototype);
		const url = `https://gelbooru.com/index.php?${params}`;
		return safeParse(await phetch(url)) || {};
	}));

	additionals.forEach(pack => tagsResponse.tag = tagsResponse.tag.concat(pack.tag));
	const artists = tagsResponse.tag.filter(t => t.type == 1).map(t => t.name);

	return artists;
}

export const grabbersMeta = {
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
			const query = `{${tags}} -{${black}} ${white}`;

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
			const allArtists = await glbFilterArtists(allTags, grabber.credentials.user, grabber.credentials.token);
			if (allArtists)
				posts.forEach(p => p.artists = allArtists.filter(a => p.tags.includes(a)));

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

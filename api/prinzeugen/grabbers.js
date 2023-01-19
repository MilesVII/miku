import { last, phetch, escapeMarkdown, safeParse, SCH } from "../utils.js";

function buildURLParams(params){
	return Object.keys(params)
		.map(k => `${k}=${encodeURIComponent(params[k])}`)
		.join("&");
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
				source: raw.source?.startsWith("http") ? raw.source : null,
				tags: raw.tags.split(" "),
				rating: raw.score,
				nsfw: !(raw.rating == "general" || raw.rating == "sensitive"),
				artists: grabber.config.tags.filter(a => raw.tags.includes(a))
			}));

			if (posts.length > 0) grabber.state.lastSeen = last(posts).id;

			// function caption(post){
			// 	const emd = escapeMarkdown;
			// 	const gbSource = `[gb](${post.link})`;
			// 	const originalSource = post.source ? ` [src](${emd(post.source)})` : "";
			// 	const artists = post.artists
			// 		.map(
			// 			a => `[${emd(a)}](https://gelbooru.com/index.php?page=post&s=list&tags=${emd(encodeURIComponent(a))})`
			// 		)
			// 		.join(" & ");
			// 	return `${gbSource}${originalSource}\n${artists}`;
			// }

			// const messages = posts.map(p => ({
			// 	raw: p,
			// 	attachments: [p.links],
			// 	caption: caption(p),
			// 	version: 0
			// }));
			
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
			}))

			return messages;
		}
	}
}

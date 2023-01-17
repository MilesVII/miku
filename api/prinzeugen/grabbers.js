import { phetch, safeParse } from "../utils.js";

function buildURLParams(params){
	return Object.keys(params)
		.map(k => `${k}=${encodeURIComponent(params[k])}`)
		.join("&");
}

export const grabbers = {
	"gelbooru": {
		schema: {

		},
		action: async grabber => {
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
					raw.sample_url/*,
					raw.preview_url*/
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
						a => `[${emd(a)}](https://gelbooru.com/index.php?page=post&s=list&tags=${emd(encodeURIComponent(a))})`
					)
					.join(" & ");
				return `${gbSource}${originalSource}\n${artists}`;
			}

			const messages = posts.map(p => ({
				raw: p,
				attachments: [p.links],
				caption: caption(p),
				version: 0
			}));

			return messages;
		}
	}
}

function tagList(raw){
	return raw
		.split("\n")
		.map(line => line.trim().replaceAll(" ", "_"))
		.filter(tag => tag != "");
}

const GRABBERS = {
	"gelbooru": {
		template_id: "grabber_gelbooru",
		read: el => ({
			type: "gelbooru",
			credentials: {
				user: safe(() => parseInt(el.querySelector("#gb_user").value.trim(), 10)) || 0,
				token: el.querySelector("#gb_key").value.trim()
			},
			config: {
				tags: tagList(el.querySelector("#gb_tags").value),
				whites: tagList(el.querySelector("#gb_whites").value),
				blacks: tagList(el.querySelector("#gb_blacks").value),
				moderated: el.querySelector("#gb_moderated").checked
			},
			state: {
				lastSeen: safe(() => parseInt(el.querySelector("#gb_last").value, 10)) || 0
			}
		}),
		fill: (data, el) => {
			el.querySelector("#gb_user").value = data.credentials.user;
			el.querySelector("#gb_key").value = data.credentials.token;

			el.querySelector("#gb_tags").value = data.config.tags.join("\n");
			el.querySelector("#gb_blacks").value = data.config.blacks.join("\n");
			el.querySelector("#gb_whites").value = data.config.whites.join("\n");
			el.querySelector("#gb_moderated").checked = data.config.moderated;

			el.querySelector("#gb_last").value = data.state.lastSeen;
			return el;
		}
	},
	"twitter": {
		template_id: "grabber_twitter",
		read: el => ({
			type: "twitter",
			credentials: {
				token: el.querySelector("#tw_token").value.trim()
			},
			config: {
				username: el.querySelector("#tw_username").value.trim(),
				moderated: el.querySelector("#tw_moderated").checked
			},
			state: {
				lastSeen: "" + (safe(() => parseInt(el.querySelector("#tw_last").value, 10)) || 0)
			}
		}),
		fill: (data, el) => {
			el.querySelector("#tw_token").value = data.credentials.token;

			el.querySelector("#tw_username").value = data.config.username;
			el.querySelector("#tw_moderated").checked = data.config.moderated;

			el.querySelector("#tw_last").value = data.state.lastSeen;
			return el;
		}
	}
}
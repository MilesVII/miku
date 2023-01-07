const utils = require("./utils.js");

export default function handler(request, response) {
	let m = request.body || "Bodyless request to callmemaybe";
	let targetChat = request.query?.to || process.env.TG_T_ME;
	if (!targetChat.startsWith("@")) targetChat = parseInt(targetChat, 10);
	utils.tg("sendMessage", {
		chat_id: targetChat,
		text: m,
		parse_mode: "MarkdownV2"
	}).then(re => response.status(200).send(re));
	utils.tg("sendMessage", {
		chat_id: targetChat,
		text: m,
		parse_mode: "MarkdownV2"
	}).then(re => response.status(200).send(re));
}

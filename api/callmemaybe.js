
const utils = require("./utils.js");

export default function handler(request, response) {
	let m = JSON.stringify(request.body);
	let targetChat = request.query.to || process.env.TG_TARGET;
	if (!targetChat.startsWith("@")) targetChat = parseInt(targetChat, 10);
	utils.genericTgRequest("sendMessage", {
		chat_id: targetChat,
		text: m
	}).then(re => response.status(200).send(re));
}

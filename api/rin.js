
import * as RedisAccess from "./red.js"
import { tg, tgReport } from "./utils.js";

export default async function handler(request, response) {
	if (!request.body?.message) {
		response.status(400).send();
		return;
	}

	const dbCreds = {
		host: process.env.RIN_REDIS_HOST,
		pwd: process.env.RIN_REDIS_PWD,
		port: process.env.RIN_REDIS_PORT
	};
	const rinToken = process.env.RIN_TG_TOKEN;
	
	//const v = await RedisAccess.get("tk", dbCreds);

	// const tgr = await tg("setWebhook", {
	// 	url: "https://mikumiku.vercel.app/api/rin",
	// 	allowed_updates: "message"
	// }, rinToken);

	const msg = request.body.message.text;

	const tgr = await tg("sendMessage", {
		chat_id: request.body.message.chat.id,
		text: msg,
		reply_to_message_id: request.body.message.message_id
	}, rinToken);

	await tgReport(`intercept\n${typeof request.body}\n${JSON.stringify(request.body)}`, process.env.RIN_TG_TOKEN);

	response.status(200).send();
}
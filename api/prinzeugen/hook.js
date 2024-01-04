import { tg, tgReport } from "../utils.js";

export default async function handler(request, response) {
	const message = request.body?.message;
	if (!message.text){
		response.status(200).send();
		return;
	}

	const me = process.env.TG_T_ME;
	const token = process.env.PE_TG_TOKEN_SUPPORT;

	if (message.from.id == me){
		if (message.reply_to_message){
			// me responding to ticket
			const raw = message.reply_to_message.text?.split("\n");
			await tg("sendMessage", {
				chat_id: parseInt(raw[0], 10),
				text: message.text
			}, token);
		} else {
			await tgReport(JSON.stringify(message));
		}
	} else {
		const sender = `${message.from?.first_name || ""} ${message.from?.last_name || ""} @${message.from?.username || ""}`;
		const wooo = `${message.from.id}\n${sender} be like\n${message.text}`
		await tg("sendMessage", {
			chat_id: me,
			text: wooo
		}, token)
	}
	
	response.status(200).send();
	return;
}

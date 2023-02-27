import { tg, tgReport } from "../utils";

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
			const re = await tg("sendMessage", {
				chat_id: message.forward_from_chat.id,
				text: message.text
			}, token);
			await tgReport(JSON.stringify(re));
		}
	} else {
		const re = await tg("forwardMessage", {
			chat_id: me,
			from_chat_id: message.chat.id,
			message_id: message.message_id
		}, token)
		await tgReport(JSON.stringify(re));
	}
	
	response.status(200).send();
	return;
}

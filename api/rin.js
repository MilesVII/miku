
import * as RedisAccess from "./red.js"
import { tg, tgReport, pickRandom } from "./utils.js";

function roll(threshold) {
	return Math.random() < threshold;
}

function getCommand(message, commands) {
	return commands.find(
		com => com.triggers.some(
			trig => message.includes(trig)
		)
	)?.command;
}

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
	
	const [
		appealsRaw,
		appealedCommandsRaw,
		wats,
		ahs,
		masters,
		badFortunes,
		basicCommandsRaw,
		pezdaStickers
	] = await RedisAccess.get([
		"appeals",
		"appeal_commands",
		"wat",
		"ahs",
		"masters",
		"bad_fortunes",
		"basic_commands",
		"pezda_stickers"
	], dbCreds);

	// const tgr = await tg("setWebhook", {
	// 	url: "https://mikumiku.vercel.app/api/rin",
	// 	allowed_updates: "message"
	// }, rinToken);

	await tgReport(`intercept\n${typeof request.body}\n${JSON.stringify(request.body)}`, process.env.RIN_TG_TOKEN);

	const msg = request.body.message.text.trim();
	const tgCommons = {
		chat_id: request.body.message.chat.id,
		reply_to_message_id: request.body.message.message_id
	};
	const requester = request.body.message.from.id
	const masterSpeaking = masters.split("\n").some(m => requester == m);

	const appeals = JSON.parse(appealsRaw);
	if (appeals.some(a => msg.startsWith(a))){
		const appealedCommands = JSON.parse(appealedCommandsRaw);
		const command = getCommand(msg, appealedCommands);

		switch (command) {
			case ("ah"): {
				const tgr = await tg("sendAudio", {
					...tgCommons,
					audio: pickRandom(wats.split("\n")),
				}, rinToken);
				break;
			}
			case ("fortune"): {
				const tgr = await tg("sendMessage", {
					...tgCommons,
					text: pickRandom(badFortunes.split("\n")),
				}, rinToken);
				break;
			}
			default: {
				const tgr = await tg("sendMessage", {
					...tgCommons,
					text: pickRandom(wats.split("\n")),
				}, rinToken);
				break;
			}
		}
	} else {
		const basicCommands = JSON.parse(basicCommandsRaw);
		const command = getCommand(msg, basicCommands);
		switch (command) {
			case ("pezda"): {
				const tgr = await tg("sendSticker", {
					...tgCommons,
					sticker: pickRandom(pezdaStickers.split("\n")),
				}, rinToken);
				break;
			}
		}
	}

	response.status(200).send();
}
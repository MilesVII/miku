
import * as RedisAccess from "./red.js"
import { tg, tgReport, pickRandom } from "./utils.js";

const LOCAL_MODE = false;

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

async function rinModel(msg, tgCommons, requester, masterSpeaking, prefs){
	const rinToken = process.env.RIN_TG_TOKEN;
	const appeals = prefs.appeals;

	if (appeals.some(a => msg.startsWith(a))){
		const command = getCommand(msg, prefs.appealedCommands);

		switch (command) {
			case ("ah"): {
				const tgr = await tg("sendAudio", {
					...tgCommons,
					audio: pickRandom(prefs.ahs),
				}, rinToken);
				break;
			}
			case ("fortune"): {
				const tgr = await tg("sendMessage", {
					...tgCommons,
					text: pickRandom(prefs.fortunes.bad),
				}, rinToken);
				break;
			}
			default: {
				const tgr = await tg("sendMessage", {
					...tgCommons,
					text: pickRandom(prefs.wats),
				}, rinToken);
				break;
			}
		}
	} else {
		console.log(prefs.basicCommands);
		const command = getCommand(msg, prefs.basicCommands);
		console.log(command);
		switch (command) {
			case ("pezda"): {
				if (msg.length > 4) break;
				const tgr = await tg("sendSticker", {
					...tgCommons,
					sticker: pickRandom(prefs.pezdaStickers),
				}, rinToken);
				break;
			}
		}
	}
}

export default async function handler(request, response) {
	tgReport(`hook call\n${JSON.stringify(request.body)}`);
	if (!LOCAL_MODE && !request.body?.message) {
		tgReport(`rin rejection\n${JSON.stringify(request.body)}`);
		response.status(200).send();
		return;
	}

	const dbCreds = {
		host: process.env.RIN_REDIS_HOST,
		pwd: process.env.RIN_REDIS_PWD,
		port: process.env.RIN_REDIS_PORT
	};
	
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

	const prefs = {
		appeals: JSON.parse(appealsRaw),
		appealedCommands: JSON.parse(appealedCommandsRaw),
		basicCommands: JSON.parse(basicCommandsRaw),
		wats: wats.split("\n"),
		ahs: ahs.split("\n"),
		masters: masters.split("\n"),
		fortunes: {
			bad: badFortunes.split("\n")
		},
		pezdaStickers: pezdaStickers.split("\n")
	}

	// const tgr = await tg("setWebhook", {
	// 	url: "https://mikumiku.vercel.app/api/rin",
	// 	allowed_updates: "message"
	// }, rinToken);

	if (LOCAL_MODE){
		const tgCommons = {
			chat_id: 400944318,
		};
		await rinModel("sample message", tgCommons, 0, false, prefs);
	} else {
		await tgReport(`intercept\n${typeof request.body}\n${JSON.stringify(request.body)}`, process.env.RIN_TG_TOKEN);
	
		const msg = request.body.message.text.trim();
		const tgCommons = {
			chat_id: request.body.message.chat.id,
			reply_to_message_id: request.body.message.message_id
		};
		const requester = request.body.message.from.id
		const masterSpeaking = masters.split("\n").some(m => requester == m);
	
		await rinModel(msg, tgCommons, requester, masterSpeaking, prefs);
	}

	response.status(200).send();
}
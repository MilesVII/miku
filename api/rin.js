
import * as RedisAccess from "./red.js"
import { tg, tgReport, pickRandom, sleep } from "./utils.js";
import seedrandom from "seedrandom";

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

async function rinModel(msg, tgCommons, requester, masterSpeaking, prefs, autoAppeal, dbGetter){
	const rinToken = process.env.RIN_TG_TOKEN;
	const appeals = prefs.appeals;
	const msgOriginal = msg;
	msg = msg.toLowerCase();

	if (autoAppeal || appeals.some(a => msg.startsWith(a))){
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
				const date = new Date().toLocaleDateString();
				const srnd = seedrandom(`${requester}-${date}`);

				const [fortunesRaw] = await dbGetter("fortunes");
				const fortunes = JSON.parse(fortunesRaw);
				const tgr = await tg("sendMessage", {
					...tgCommons,
					text: pickRandom(fortunes, srnd()),
				}, rinToken);
				break;
			}
			case ("potd"): {
				const date = new Date().toLocaleDateString();
				const srnd = seedrandom(date);

				const loaders = pickRandom(prefs.potd.loaders, srnd());
				const members = pickRandom(prefs.potd.members, srnd());
				const name = pickRandom(members, srnd());

				const tgOptions = {...tgCommons};
				delete tgOptions.reply_to_message_id;
				for (let loader of loaders) {
					await tg("sendMessage", {
						...tgOptions,
						parse_mode: "MarkdownV2",
						text: loader.replace("#", `*${name}*`)
					}, rinToken);
					await sleep(1000);
				}

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
	const localMode = request.query?.localmode;

	if (!localMode && !request.body?.message?.text) {
		response.status(200).send();
		return;
	}

	const dbCreds = {
		host: process.env.RIN_REDIS_HOST,
		pwd: process.env.RIN_REDIS_PWD,
		port: process.env.RIN_REDIS_PORT
	};
	
	const dbGetter = keys => RedisAccess.get(keys, dbCreds);
	const [prefsRaw] = await dbGetter("prefs");
	const prefs = JSON.parse(prefsRaw);

	// const tgr = await tg("setWebhook", {
	// 	url: "https://mikumiku.vercel.app/api/rin",
	// 	allowed_updates: "message"
	// }, rinToken);

	if (localMode){
		const tgCommons = {
			chat_id: process.env.TG_T_ME,
		};
		await rinModel("рин повангуй", tgCommons, 0, false, prefs, true, dbGetter);
	} else {
		const requester = request.body.message.from.id;
		const masterSpeaking = prefs.masters.some(m => requester == m);
		const msg = request.body.message.text.trim();
		const tgCommons = {
			chat_id: request.body.message.chat.id,
			reply_to_message_id: request.body.message.message_id
		};
		const autoAppeal = request.body.message?.reply_to_message?.id == prefs.me;
		await tgReport(`${request.body.message?.reply_to_message?.id}\n${prefs.me}`, process.env.RIN_TG_TOKEN);

		if (requester === request.body.message.chat.id)
			await tgReport(`intercept\n${typeof request.body}\n${JSON.stringify(request.body)}`, process.env.RIN_TG_TOKEN);
	
		await rinModel(msg, tgCommons, requester, masterSpeaking, prefs, autoAppeal, dbGetter);
	}

	response.status(200).send();
}
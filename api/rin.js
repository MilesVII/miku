
import * as RedisAccess from "./red.js"
import { tg, pickRandom, sleep, escapeMarkdown } from "./utils.js";
import seedrandom from "seedrandom";

function roll(threshold) {
	return Math.random() < threshold;
}

async function rinModel(msg, requester, replyTo, replyToMsg, dbGetter, dbSetter, say){
	const [prefsRaw] = await dbGetter("prefs");
	const prefs = JSON.parse(prefsRaw);

	const masterSpeaking = prefs.masters.some(m => requester == m);
	const autoAppeal = (replyTo == prefs.me);
	const appeals = prefs.appeals;
	const msgOriginal = msg;
	msg = msg.toLowerCase();

	function getCommand(message, commands) {
		return commands.find(
			com => com.triggers.some(
				trig => message.includes(trig)
			)
		);
	}

	if (autoAppeal || appeals.some(a => msg.startsWith(a))){
		const command = getCommand(msg, prefs.appealedCommands);
		if (command?.protected && !masterSpeaking) {
			await say(pickRandom(prefs.protectedCommandFailResponse));
			return;
		}

		switch (command?.command) {
			case ("draft_on"): {
				prefs.draft = true;
				await dbSetter("prefs", JSON.stringify(prefs));
				await say(pickRandom(command.responses));
				break;
			}
			case ("draft_off"): {
				prefs.draft = false;
				await dbSetter("prefs", JSON.stringify(prefs));
				await say(pickRandom(command.responses));
				break;
			}
			case ("ah"): {
				await say(pickRandom(prefs.ahs));
				if (roll(prefs.blush.chance)){
					await say(pickRandom(prefs.blush.says));
				}
				break;
			}
			case ("fortune"): {
				const date = new Date().toLocaleDateString();
				const srnd = seedrandom(`${requester}-${date}`);

				const [fortunesRaw] = await dbGetter("fortunes");
				const fortunes = JSON.parse(fortunesRaw);
				await say(pickRandom(fortunes, srnd()));
				break;
			}
			case ("potd"): {
				const date = new Date().toLocaleDateString();
				const srnd = seedrandom(date);

				const loaders = pickRandom(prefs.potd.loaders, srnd());
				const members = pickRandom(prefs.potd.members, srnd());
				const name = pickRandom(members, srnd());

				for (let loader of loaders) {
					await say(
						escapeMarkdown(loader).replace("\\#", `*${name}*`),
						false,
						true
					);
					await sleep(1000);
				}

				break;
			}
			case ("help"): {
				const appealsHelp = escapeMarkdown(prefs.appealsTemplate)
					.replace("\\#", `*${prefs.appeals.join(", ")}*`);
				const apCommandsHelp = prefs.appealedCommands.filter(c => !c.protected).map(c =>
					escapeMarkdown(prefs.commandHelpTemplate)
						.replace("\\#", `*${c.command}*`)
						.replace("\\#", `*${c.triggers.join(", ")}*`)
						.replace("\\#", `*${c.description ?? "N/A"}*`)
				).join("\n\n");
				const basicTriggers = prefs.autoResponse
					.map(c => 
						c.triggers
							.map(t => `*${escapeMarkdown(t)}*`)
							.join(", ")
					)
					.join(", ");
				const basicTriggersHelp = escapeMarkdown(prefs.responseTemplate).replace("\\#", `${basicTriggers}`);
				const help = `${appealsHelp}\n\n${apCommandsHelp}\n\n${basicTriggersHelp}`;
				
				await say(help, false, true);
				break;
			}
			default: {
				await say(pickRandom(prefs.wats));
				break;
			}
		}
	} else {
		if (prefs.draft && masterSpeaking) {
			await say(msgOriginal, replyToMsg);
		}
		const command = getCommand(msg, prefs.autoResponse);
		if (command?.chance && !roll(command.chance))
			return;
		if (command) {
			await say(pickRandom(command.responses))
		}
	}
}

function say(commons, message, reply, markdown){
	const rinToken = process.env.RIN_TG_TOKEN;
	const _commons = {
		...commons
	};
	if (reply === false){
		delete _commons.reply_to_message_id;
	} else if (reply !== true) {
		_commons.reply_to_message_id = reply;
	}
	if (message.startsWith(":sticker:")){
		const id = message.split(":sticker:")[1];
		return tg("sendSticker", {
			..._commons,
			sticker: id,
		}, rinToken);
	}
	if (message.startsWith(":audio:")){
		const id = message.split(":audio:")[1];
		return tg("sendAudio", {
			..._commons,
			audio: id,
		}, rinToken);
	}
	if (message.startsWith(":photo:")){
		const id = message.split(":photo:")[1];
		return tg("sendPhoto", {
			..._commons,
			photo: id,
		}, rinToken);
	}
	if (message.startsWith(":animation:")){
		const id = message.split(":animation:")[1];
		return tg("sendAnimation", {
			..._commons,
			animation: id,
		}, rinToken);
	}
	return tg("sendMessage", {
		..._commons,
		...(markdown ? {parse_mode: "MarkdownV2"} : {}),
		text: message,
	}, rinToken);
}

export default async function handler(request, response) {
	const localMode = request.query?.localmode;

	if (request.body.message?.chat?.type === "private")
		await tg(
			"sendMessage",
			{
				chat_id: request.body.message.from.id,
				parse_mode: "MarkdownV2",
				text: `\`\`\`\n${escapeMarkdown(JSON.stringify(request.body))}\n\`\`\``
			},
			process.env.RIN_TG_TOKEN
		);
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
	const dbSetter = (keys, value) => RedisAccess.set(keys, dbCreds, value);

	// const tgr = await tg("setWebhook", {
	// 	url: "https://mikumiku.vercel.app/api/rin",
	// 	allowed_updates: "message"
	// }, rinToken);


	if (localMode){
		const tgCommons = {
			chat_id: process.env.TG_T_ME,
		};
		await rinModel(request.body, 0, 0, 0, dbGetter, dbSetter, (message, reply = true, md = false) => say(tgCommons, message, reply, md));
	} else {
		const requester = request.body.message.from.id;
		const msg = request.body.message.text.trim();
		const tgCommons = {
			chat_id: request.body.message.chat.id,
			reply_to_message_id: request.body.message.message_id
		};
		const replyTo = request.body.message?.reply_to_message?.from?.id;
		const replyToMsg = request.body.message?.reply_to_message?.message_id
	
		await rinModel(msg, requester, replyTo, replyToMsg, dbGetter, dbSetter, (message, reply = true, md = false) => say(tgCommons, message, reply, md));
	}

	response.status(200).send();
}
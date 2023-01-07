const https = require("https");

export function safeParse(str){
	try {
		return JSON.parse(str);
	} catch (e) {
		return null;
	}
}

export function phetch(url, options = {}, payload){
	return new Promise(resolve => {
		options.method = options.method || "GET";

		const req = https.request(url, options, res => {
			let responseData = [];
			res.on('data', chunk => {
				responseData.push(chunk);
			});
			res.on('end', async () => {
				let responseBody = Buffer.concat(responseData).toString();
	
				resolve(responseBody);
			});
		});

		if (payload) req.write(payload);

		req.end()
	});
}

const TG_API = "https://api.telegram.org/bot";
function getTgApiUrl(token, command){
	return `${TG_API}${token}/${command}`;
}

export function tg(command, payload, token = process.env.TG_TOKEN){
	const url = getTgApiUrl(token, command);
	const options = {
		method: "POST",
		headers: {}
	};
	if (payload) {
		options.headers["Content-Type"] = "application/json";
		payload = JSON.stringify(payload);
	}
	return phetch(url, options, payload);
}

export function tgReport(message){
	return tg("sendMessage", {
		chat_id: process.env.TG_T_ME,
		text: message
	});
}
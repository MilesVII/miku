const https = require("https");

export function safeParse(str){
	try {
		return JSON.parse(str);
	} catch (e) {
		return null;
	}
}

export function last(arr){
	return arr[arr.length - 1];
}

export function getFileLength(url){
	return new Promise(resolve => {
		const req = https.request(url, {method: "HEAD"}, res => {
			try {
				resolve(parseInt(res.headers["content-length"], 10) || "0");
			} catch (e) {
				resolve(Infinity);
			}
		});

		req.end()
	});
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

export function tg(command, payload, token = process.env.TG_TOKEN){
	const url = `https://api.telegram.org/bot${token}/${command}`;
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

export function parseTelegramTarget(raw){
	if (raw.startsWith("@")) return raw;
	try {
		return parseInt(raw, 10);
	} catch(e){
		console.error(e);
		return null;
	}
}

//https://github.com/edwmurph/escape-markdown/blob/master/index.js
export function escapeMarkdown(raw){
	const substitutions = {'*': '\\*','#': '\\#','(': '\\(',')': '\\)','[': '\\[',']': '\\]',_: '\\_','\\': '\\\\','+': '\\+','-': '\\-','`': '\\`','<': '&lt;','>': '&gt;','&': '&amp;'};
	return raw.replace(/[\*\(\)\[\]\+\-\\_`#<>]/g, m => substitutions[m]);
}
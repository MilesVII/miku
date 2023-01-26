import * as https from "https";
import FormData from "form-data";
import { pbkdf2Sync } from "node:crypto";

export function hashPassword(raw){
	const key = pbkdf2Sync(raw, "m1ku39", 7000, 64, "sha512");
	return key.toString("hex");
}

export function safe(cb){
	try {
		return cb();
	} catch(e){
		return null;
	}
}

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

export function unique(arr){
	return arr.filter((v, i, a) => !a.slice(i + 1).find(x => x == v))
}

export function range(from, to){
	const r = [];
	for (let i = from; i < to; ++i)
		r.push(i);
	return r;
}

export function chunk(a, chunksize){
	let r = [];
	for (let i = 0; i < a.length; i += chunksize){
		r.push(a.slice(i, i + chunksize));
	}
	return r;
}

export function getFileLength(url){
	return new Promise(resolve => {
		const req = https.request(url, {method: "HEAD"}, res => {
			try {
				resolve({
					length: parseInt(res.headers["content-length"], 10) || "0",
					status: res.statusCode
				});
			} catch (e) {
				resolve({
					length: Infinity,
					status: res.statusCode
				});
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
			res.on('end', () => {
				let responseBody = Buffer.concat(responseData).toString();
	
				resolve(responseBody);
			});
		});

		if (payload) req.write(payload);

		req.end()
	});
}

export function phetchV2(url, options = {}, payload){
	return new Promise(resolve => {
		options.method = options.method || "GET";

		const req = https.request(url, options, res => {
			let responseData = [];
			res.on('data', chunk => {
				responseData.push(chunk);
			});
			res.on('end', () => {
				let responseBody = Buffer.concat(responseData).toString();
	
				resolve({
					status: res.statusCode,
					headers: res.headers,
					body: safeParse(responseBody) || responseBody
				});
			});
		});

		if (payload) req.write(payload);

		req.end()
	});
}

export function dl(url){
	return new Promise(resolve => {
		const req = https.request(url, {method: "GET"}, res => {
			let responseData = [];
			res.on('data', chunk => {
				responseData.push(chunk);
			});
			res.on('end', () => {
				resolve(Buffer.concat(responseData));
			});
		});
		req.end()
	});
}

export async function tgUploadPhoto(image, target, markup, token = process.env.TG_TOKEN){
	const url = `https://api.telegram.org/bot${token}/sendPhoto`;

	const buffer = await dl(image);
	const extension = last(image.split("."));
	
	const fd = new FormData();
	fd.append("chat_id", target);
	if (markup)
		fd.append("reply_markup", JSON.stringify(markup));
	fd.append("photo", buffer, `file.${extension}`);

	return await new Promise(resolve => {
		fd.submit(url, (err, res) => {
			let responseData = [];
			res.on('data', chunk => {
				responseData.push(chunk);
			});
			res.on('end', () => {
				resolve(Buffer.concat(responseData));
			});
		});
	});
}

export function tg(command, payload, token = process.env.TG_TOKEN, useFormData = false){
	const url = `https://api.telegram.org/bot${token}/${command}`;
	const options = {
		method: "POST",
		headers: {}
	};
	if (payload){
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

export const SCH = {
	any: 0,
	string: 1,
	number: 2,
	bool: 3,
	array: 4
};

export function validate(schema, obj){
	const objProperties = Object.keys(obj);
	return Object.keys(schema).every(skey => {
		if (!objProperties.includes(skey)) return false;
		if (typeof schema[skey] == "object") return validate(schema[skey], obj[skey]);
		switch (schema[skey]){
			case (SCH.any):    return true;
			case (SCH.string): return typeof obj[skey] == "string";
			case (SCH.number): return typeof obj[skey] == "number";
			case (SCH.bool):   return typeof obj[skey] == "boolean";
			case (SCH.array):  return Array.isArray(obj[skey]);
			default: return true;
		}
	});
}
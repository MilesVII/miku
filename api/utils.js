const https = require("https");

const TG_API = "https://api.telegram.org/bot";
function getTgApiUrl(token, command){
	return TG_API + token + "/" + command;
}

export function genericTgRequest(command, payload){
	return new Promise((resolve) => {
		let token = process.env.TG_TOKEN;
		let url = getTgApiUrl(token, command);
	
		let options = {
			method: 'POST',
		};
	
		let data = null;
		if (payload){
			data = JSON.stringify(payload);
			options.headers = {};
			options.headers["Content-Type"] = "application/json";
			//options.headers["Content-Length"] = (new TextEncoder().encode(data)).length;
		}

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
	
		req.write(data);
		req.end()
	});
}

export function phetch(url, options = {}, payload){
	return new Promise(resolve => {
		options.method ||= "GET";

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
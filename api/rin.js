
import * as RedisAccess from "./red.js"
import { tgReport } from "./utils.js";

export default async function handler(request, response) {
	// let config = request.body?.config;
	// let key = request.body?.key;

	const dbCreds = {
		host: process.env.RIN_REDIS_HOST,
		pwd: process.env.RIN_REDIS_PWD,
		port: process.env.RIN_REDIS_PORT
	};
	
	//const v = await RedisAccess.get("tk", dbCreds);

	await tgReport(`intercept\n${typeof request.body}\n${JSON.stringify(request.body)}`, process.env.RIN_TG_TOKEN);

	response.status(200).send();
}
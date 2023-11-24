import { safe } from "./utils.js"
import { createClient } from "redis";

function getClient(dbCreds){
	return createClient({
		password: dbCreds.pwd,
		socket: {
			host: dbCreds.host,
			port: parseInt(dbCreds.port || "0", 10)
		}
	});
}

export async function get(key, dbCreds) {
	const client = getClient(dbCreds);
	await client.connect();
	if (!Array.isArray(key)) key = [key];
	const values = await Promise.all(key.map(k => client.get(key)));
	await client.disconnect();
	return values;
}

export async function set(key, dbCreds, value) {
	const client = getClient(dbCreds);
	await client.connect();
	await client.set(key, JSON.stringify(value));
	await client.disconnect();
}
import { initializeApp } from "firebase/app";
import { getDatabase, ref, child, get } from "firebase/database";

async function load(key) {
	const dbRef = ref(getDatabase());
	let snapshot = await get(child(dbRef, key));

	if (snapshot && snapshot.exists()) {
		return snapshot.val();
	} else {
		return null;
	}
}

export default function handler(request, response) {
	response.setHeader('Access-Control-Allow-Credentials', true);
	response.setHeader('Access-Control-Allow-Origin', '*');
	response.setHeader('Access-Control-Allow-Methods', "POST");
	response.setHeader(
		'Access-Control-Allow-Headers',
		'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
	);
	if (request.method === 'OPTIONS') {
		response.status(200).end()
		return
	}

	let config = request.body?.config;
	let key = request.body?.key;

	if (!config || !key){
		response.status(400).send();
	} else {
		const app = initializeApp(config);
		load(key).then(r => response.status(200).send(JSON.stringify(r)));
	}
}
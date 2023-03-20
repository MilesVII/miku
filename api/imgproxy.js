import * as sharp from "sharp";
import { safe, phetchV2 } from "./utils.js";

export default async function handler(request, response) {
	response.setHeader('Access-Control-Allow-Credentials', true);
	response.setHeader('Access-Control-Allow-Origin', '*');
	response.setHeader('Access-Control-Allow-Methods', "POST");
	response.setHeader(
		'Access-Control-Allow-Headers',
		'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
	);
	if (request.method === 'OPTIONS') {
		response.status(200).end();
		return;
	}

	const spi = s => safe(() => parseInt(s, 10));
	const url = request.body?.url || request.query.url;
	const w = request.body?.w || spi(request.query.w) || 1024;
	const h = request.body?.h || spi(request.query.h) || 1024;
	const q = request.body?.q || spi(request.query.q) || 70;
	const j = !!(request.query.jpeg || request.query.j);
	const m = !!(request.query.mirror || request.query.m);
	const r = w == 0;

	const original = await phetchV2(url)
	if (original.status > 299) {
		response.status(503).end(original);
		return;
	}

	const formatOptions = {
		quality: q
	};

	try {
		if (m) throw 0;
		let horns = sharp(original.raw);
		if (!r) horns = horns.resize(w, h, {fit: "inside"});
		if (j){
			horns = horns.jpeg(formatOptions)
			response.setHeader("Content-Type", "image/jpeg");
		} else {
			horns = horns.avif(formatOptions);
			response.setHeader("Content-Type", "image/avif");
		}
		
		const data = await horns.toBuffer()
		
		response.status(200).end(data);
	} catch(e){
		response.status(200).end(original.raw);
	}
	return;
}
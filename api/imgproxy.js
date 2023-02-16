const sharp = require('sharp');//import * as sharp from "sharp";
import { safe, phetchV2 } from "./utils";

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

	const original = await phetchV2(url)
	if (original.status > 299) {
		response.status(503).end(original);
		return;
	}

	const data = await sharp(original.raw)
		.resize(w, h, {fit: "inside"})
		.avif({
			quality: q
		})
		.toBuffer();
	
	response.status(200).end(data);
	return;
}
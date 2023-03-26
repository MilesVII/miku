import { safe, phetchV2, processImage, wegood } from "./utils.js";

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
	const w = request.body?.w || spi(request.query.w) || 2048;
	const h = request.body?.h || spi(request.query.h) || 2048;
	const q = request.body?.q || spi(request.query.q) || 70;
	const j = !!(request.query.jpeg || request.query.j);
	const r = request.query.w === "0";

	const original = await phetchV2(url)
	if (!wegood(original.status)) {
		console.log(original.status)
		response.status(503).end();
		return;
	}

	const options = {
		resize: {
			w: w,
			h: h
		},
		format: j ? "jpeg" : "avif",
		quality: q
	};

	if (r) options.resize = null;

	try {
		const processed = await processImage(original.raw, options)
		response.setHeader("Content-Type", processed.mime);
		response.status(200).end(processed.data);
	} catch(e){
		response.status(204).end(original.raw);
	}
	return;
}
const crypto = require("crypto");
const utils = require("./loginUtils");

const PWD_SP = process.env.HAKASE_PASSWORD_SPECTATOR;
const PWD_ED = process.env.HAKASE_PASSWORD_EDITOR;
const TOK_SP = process.env.HAKASE_ACCESS_TOKEN_SPECTATOR;
const TOK_ED = process.env.HAKASE_ACCESS_TOKEN_EDITOR;


export default function handler(request, response) {
	if (request.query?.check) {
		let role = utils.roleByToken(request.cookies.access);
		//let status = [TOK_SP, TOK_ED].includes(request.cookies.access) ? 200 : 401;
		let status = (role < 0) ? 401 : 200;
		let responseBody = {
			role: role
		}
		response.status(status).send(responseBody); 
		return;
	}
	
	let password = request.body;
	let hash = crypto.createHash("sha512").update(password).digest("hex");
	let role = utils.roleByPassword(hash);
	if (role >= 0) {
		let token = [TOK_SP, TOK_ED][role];
		let responseBody = {
			role: role
		};
		//response.setHeader("Set-Cookie", `access=${token}; Secure;`);
		response.setHeader("Set-Cookie", `access=${token};`);
		response.status(200).send(responseBody);
	} else
		response.status(401).end();
}
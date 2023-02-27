import { tgReport } from "../utils";

export default async function handler(request, response) {
	await tgReport(JSON.stringify(request.body));
	response.status(200).send();
	return;
}

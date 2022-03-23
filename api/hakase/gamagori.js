const https = require('https');
const zlib = require("zlib");
const utils = require("../utils.js");

module.exports = {
	FIELDS_DEFAULT_EPIC: "$type,id,idReadable,description,summary,updated,project(name),subtasks(issues(summary,updated,idReadable,fields(id,name,value(name),projectCustomField($type,bundle(id))),resolved)),fields(id,name,value(name),projectCustomField($type,bundle(id)))&query=Type: Epic Status: {To Do}",
	FIELDS_QA: "idReadable,summary,fields(id,name,value(name),projectCustomField($type,bundle(id)))&query=Type: Bug",
	
	listIssues: async (host, authToken, fields, disablePaging = false)=>{
		let loadedIssues = 0;
		let newBatchSize = 1;
		let result = [];
		while (newBatchSize > 0){
			let ep = restoreEndpoint(host, "/api/issues?$skip=#&fields=" + fields, [loadedIssues]);
			let raw = await genericRequest(METHOD_GET, null, ep, authToken);
			try {
				let newBatch = JSON.parse(raw);
				newBatchSize = newBatch.length;
				loadedIssues += newBatchSize;
				result = result.concat(newBatch);
				if (disablePaging) return result
			} catch(e){
				newBatchSize = 0;
			}
		}
		return result;
	},
	listProjects: async (host, authToken)=>{
		let ep = restoreEndpoint(host, "/api/admin/projects?fields=id,name,shortName", null);
		let raw = await genericRequest(METHOD_GET, null, ep, authToken);
		try {
			return JSON.parse(raw);
		} catch(e){
			return null;
		}
	}
};


function restoreEndpoint(apihostname, endpointSuffix, parameters){
	let e = apihostname + endpointSuffix;
	//Object.assign(e, endpoint);
	if (parameters)
		for (let p of parameters){
			e = e.replace("#", p);
		}
	return e;
}

const METHOD_GET = "GET";
const METHOD_POST = "POST";
const METHOD_PUT = "PUT";

function genericRequest(method, data, endpoint, authToken, timeout = 10000){
	return new Promise(resolve => {
		const options = {
			method: method,
			headers: {
				"Authorization": "Bearer " + authToken,
				"Accept": "application/json",
				"Cache-Control": "no-cache",
				"Content-Type": "application/json"
			},
			timeout: timeout
		}
		//if (additionalHeaders) Object.assign(options.headers, additionalHeaders);
		
		let requestTarget = endpoint;
		const req = https.request(requestTarget, options, res => {
			let responseData = [];
			res.on('data', chunk => {
				responseData.push(chunk);
			});
			res.on('end', async () => {
				let responseBody = Buffer.concat(responseData).toString();
				if (res.headers["content-encoding"] == "gzip"){
					if (method != "POST")
						console.log("WARNING: got gzipped response to " + method + " request.\nEndpoint: " + requestTarget);
					responseBody = zlib.gunzipSync(Buffer.concat(responseData)).toString();
				}

				switch (res.statusCode){
				case (200):
				case (201):
				case (204):
					resolve(responseBody);
					break;
				case (401):
				case (409):
				case (412):
				case (422):
				case (500):
				case (502):
				case (503):
				case (504):
					resolve(null);
					break;
				default:
					console.log(`Unknown status: ${res.statusCode} at ${endpoint}`);
					resolve(responseBody);
					break;
				}
			});
		});

		req.on('timeout', () => {
			console.log("Timeout happened on " + endpoint);
			req.destroy();
			resolve(null);
		});

		req.on('error', error => {
			console.error("Error happened: " + error);
			resolve(null);
		});

		if (data) req.write(data);

		req.end();
	});
}